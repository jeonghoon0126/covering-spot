import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookings, getDrivers, getUnloadingPoints, updateBooking } from "@/lib/db";
import { updateDriver } from "@/lib/db-drivers";
import { validateToken } from "@/app/api/admin/auth/route";
import { optimizeRoute, insertUnloadingStops } from "@/lib/optimizer/tsp";
import type { DispatchBooking, DispatchUnloadingPoint } from "@/lib/optimizer/types";
import type { Booking } from "@/types/booking";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driverId: z.string().regex(UUID_REGEX, "유효하지 않은 driverId"),
});

/**
 * POST /api/admin/dispatch-auto/optimize-route
 * 특정 기사의 이미 배차된 주문에 TSP 경로 최적화 적용
 * - routeOrder + unloadingStopAfter 재계산 후 DB 저장
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
    }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { date, driverId } = parsed.data;

    const [allBookings, allDrivers, unloadingPoints] = await Promise.all([
      getBookings(date),
      getDrivers(true), // 활성 기사만 조회 (비활성 기사 경로 최적화 방지)
      getUnloadingPoints(true),
    ]);

    const driver = allDrivers.find((d) => d.id === driverId);
    if (!driver) {
      return NextResponse.json({ error: "기사를 찾을 수 없습니다" }, { status: 404 });
    }

    // 해당 기사의 배차된 주문 중 좌표 있는 것만 최적화 대상
    const driverBookings = allBookings.filter(
      (b) => b.driverId === driverId && b.latitude != null && b.longitude != null,
    );

    if (driverBookings.length === 0) {
      return NextResponse.json({ updated: 0, message: "배차된 주문이 없습니다" });
    }

    const dispatchBks: DispatchBooking[] = driverBookings.map((b) => ({
      id: b.id,
      lat: b.latitude!,
      lng: b.longitude!,
      totalLoadingCube: b.totalLoadingCube || 0,
      timeSlot: b.timeSlot,
      address: b.address,
      customerName: b.customerName,
    }));

    const dispatchUnloadingPoints: DispatchUnloadingPoint[] = unloadingPoints.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      name: p.name,
    }));

    // 슬롯 우선순위: 오전 → 오후 → 저녁 → 기타
    // 시간창 역전 방지: 슬롯 내부에서만 TSP, 슬롯 간 순서는 강제
    const SLOT_PRIORITY: Record<string, number> = {
      "오전 (9시~12시)": 0,
      "오후 (13시~17시)": 1,
      "저녁 (18시~20시)": 2,
    };

    // 슬롯별로 분리 → 각 슬롯 내부에서 TSP → 슬롯 순서대로 합산
    const slotGroups = new Map<string, DispatchBooking[]>();
    for (const b of dispatchBks) {
      const slot = b.timeSlot || "기타";
      if (!slotGroups.has(slot)) slotGroups.set(slot, []);
      slotGroups.get(slot)!.push(b);
    }
    const orderedSlots = [...slotGroups.keys()].sort((a, b) =>
      (SLOT_PRIORITY[a] ?? 99) - (SLOT_PRIORITY[b] ?? 99),
    );

    const optimized: DispatchBooking[] = [];
    for (const slot of orderedSlots) {
      const slotBks = slotGroups.get(slot)!;
      optimized.push(...optimizeRoute(slotBks));
    }

    // 하차지 경유 계산 (전체 경로 기준, 전날 미하차 초기 적재량 반영)
    const stops = insertUnloadingStops(
      optimized,
      driver.vehicleCapacity || 0,
      dispatchUnloadingPoints,
      driver.initialLoadCube ?? 0,
    );

    // routeOrder + unloadingStopAfter 일괄 저장
    await Promise.allSettled(
      optimized.map((b, idx) => {
        const routeOrder = idx + 1;
        const stop = stops.find((s) => s.afterRouteOrder === routeOrder);
        return updateBooking(b.id, {
          routeOrder,
          unloadingStopAfter: stop?.pointId ?? null,
        } as Partial<Booking>);
      }),
    );

    // 경로 최적화 완료 후 기사 초기 적재량 갱신 (fire-and-forget)
    const stopSet = new Set(stops.map((s) => s.afterRouteOrder));
    let cumLoad = driver.initialLoadCube ?? 0;
    for (let i = 0; i < optimized.length; i++) {
      cumLoad += optimized[i].totalLoadingCube;
      if (stopSet.has(i + 1)) cumLoad = 0; // routeOrder는 1-based
    }
    updateDriver(driverId, { initialLoadCube: cumLoad }).catch((err) =>
      console.error("[optimize-route] initialLoadCube 갱신 실패:", err),
    );

    return NextResponse.json({ updated: optimized.length });
  } catch (e) {
    console.error("[optimize-route/POST]", e);
    return NextResponse.json({ error: "동선 최적화 실패" }, { status: 500 });
  }
}
