import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookings, getDrivers, getUnloadingPoints, updateBooking } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { autoDispatch } from "@/lib/optimizer/auto-dispatch";
import { getRouteETA, type RoutePoint } from "@/lib/kakao-directions";
import type { DispatchBooking, DispatchDriver, DispatchUnloadingPoint } from "@/lib/optimizer/types";
import type { Booking } from "@/types/booking";

const AutoDispatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/admin/dispatch-auto
 * 자동배차 실행 (미리보기)
 * - 미배차 주문만 대상
 * - 결과는 제안(plan)만 반환, 실제 적용은 클라이언트에서 별도 호출
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = AutoDispatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "date 파라미터 필요 (YYYY-MM-DD)" }, { status: 400 });
    }

    const { date } = parsed.data;

    // 병렬 조회
    const [allBookings, drivers, unloadingPoints] = await Promise.all([
      getBookings(date),
      getDrivers(true),
      getUnloadingPoints(true),
    ]);

    // 미배차 + 활성 주문만 (취소/거부 제외)
    // 좌표 없는 주문(lat=0 또는 lng=0)은 별도 unassigned 처리 (0,0 = 아프리카 근해)
    const unassignedBookings = allBookings.filter(
      (b) =>
        !b.driverId &&
        b.status !== "cancelled" &&
        b.status !== "rejected" &&
        b.latitude &&
        b.longitude,
    );
    const noCoordBookings = allBookings.filter(
      (b) =>
        !b.driverId &&
        b.status !== "cancelled" &&
        b.status !== "rejected" &&
        (!b.latitude || !b.longitude),
    );

    // 좌표 없는 주문은 unassigned로 분류
    const noCoordUnassigned = noCoordBookings.map((b) => ({
      id: b.id,
      reason: "좌표 없음",
    }));

    if (unassignedBookings.length === 0) {
      return NextResponse.json({
        plan: [],
        unassigned: noCoordUnassigned,
        stats: {
          totalBookings: noCoordBookings.length,
          assigned: 0,
          unassigned: noCoordBookings.length,
          totalDistance: 0,
        },
        message: "미배차 주문이 없습니다",
      });
    }

    // Booking → DispatchBooking 변환 (좌표 검증 완료된 주문만)
    const dispatchBookings: DispatchBooking[] = unassignedBookings.map((b) => ({
      id: b.id,
      lat: b.latitude!,
      lng: b.longitude!,
      totalLoadingCube: b.totalLoadingCube || 0,
      timeSlot: b.timeSlot,
      address: b.address,
      customerName: b.customerName,
    }));

    const dispatchDrivers: DispatchDriver[] = drivers.map((d) => ({
      id: d.id,
      name: d.name,
      vehicleCapacity: d.vehicleCapacity,
      vehicleType: d.vehicleType,
    }));

    const dispatchUnloadingPoints: DispatchUnloadingPoint[] = unloadingPoints.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      name: p.name,
    }));

    // 자동배차 실행
    const result = autoDispatch(dispatchBookings, dispatchDrivers, dispatchUnloadingPoints);

    // 기사별 ETA 병렬 계산 (실패해도 plan은 반환 — graceful degradation)
    const coordMap = new Map<string, RoutePoint>(
      dispatchBookings.map((b) => [b.id, { x: b.lng, y: b.lat }]),
    );

    const etaResults = await Promise.allSettled(
      result.plan.map((dp) => {
        const points = dp.bookings
          .map((b) => coordMap.get(b.id))
          .filter((p): p is RoutePoint => p !== undefined);
        return points.length >= 2 ? getRouteETA(points) : Promise.resolve(null);
      }),
    );

    const planWithETA = result.plan.map((dp, idx) => {
      const etaRes = etaResults[idx];
      const eta = etaRes.status === "fulfilled" ? etaRes.value : null;
      if (!eta) return dp;
      return { ...dp, estimatedDuration: eta.duration, estimatedDistance: eta.distance };
    });

    // 좌표 없는 주문을 unassigned에 합산
    const finalUnassigned = [...result.unassigned, ...noCoordUnassigned];
    return NextResponse.json({
      ...result,
      plan: planWithETA,
      unassigned: finalUnassigned,
      stats: {
        ...result.stats,
        unassigned: result.stats.unassigned + noCoordUnassigned.length,
        totalBookings: result.stats.totalBookings + noCoordUnassigned.length,
      },
    });
  } catch (e) {
    console.error("[dispatch-auto/POST]", e);
    return NextResponse.json({ error: "자동배차 실패" }, { status: 500 });
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ApplySchema = z.object({
  plan: z.array(
    z.object({
      driverId: z.string().uuid(),
      driverName: z.string().min(1).max(50),
      bookings: z.array(
        z.object({
          id: z.string().regex(UUID_REGEX, "올바른 UUID 형식이 아닙니다"),
          routeOrder: z.number().int().positive(),
        }),
      ),
    }),
  ),
});

/**
 * PUT /api/admin/dispatch-auto
 * 자동배차 결과 일괄 적용
 *
 * 보안:
 *  - UUID 형식 검증 (Zod) → injection 방어
 *  - 취소/거부 상태 주문은 덮어쓰기 방지 (DB 레벨 status 체크)
 *  - 기사별 병렬 처리 → 성능 최적화
 */
export async function PUT(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ApplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "잘못된 요청", details: parsed.error.format() }, { status: 400 });
    }

    const { plan } = parsed.data;
    const succeeded: string[] = [];
    const failed: string[] = [];

    // 기사별 병렬 처리 (for...of 직렬 → Promise.allSettled 병렬)
    const driverResults = await Promise.allSettled(
      plan.map((driverPlan) =>
        Promise.allSettled(
          driverPlan.bookings.map((b) =>
            // 취소/거부 상태 주문은 supabase에서 .neq("status", "cancelled") 등으로 보호
            // updateBooking이 조건 불일치 시 null 반환 → failed 처리
            updateBooking(b.id, {
              driverId: driverPlan.driverId,
              driverName: driverPlan.driverName,
              routeOrder: b.routeOrder,
            } as Partial<Booking>),
          ),
        ).then((results) => ({ driverPlan, results })),
      ),
    );

    for (const driverResult of driverResults) {
      if (driverResult.status === "fulfilled") {
        const { driverPlan, results } = driverResult.value;
        results.forEach((result, idx) => {
          const bookingId = driverPlan.bookings[idx].id;
          if (result.status === "fulfilled" && result.value !== null) {
            succeeded.push(bookingId);
          } else {
            failed.push(bookingId);
          }
        });
      } else {
        // 기사 전체 실패
        const planIdx = driverResults.indexOf(driverResult);
        if (planIdx !== -1) {
          plan[planIdx].bookings.forEach((b) => failed.push(b.id));
        }
      }
    }

    if (succeeded.length === 0) {
      return NextResponse.json({ error: "모든 배차 적용 실패", failed }, { status: 500 });
    }

    return NextResponse.json({
      success: failed.length === 0,
      updated: succeeded,
      ...(failed.length > 0 ? { partialFailure: true, failed } : {}),
    });
  } catch (e) {
    console.error("[dispatch-auto/PUT]", e);
    return NextResponse.json({ error: "적용 실패" }, { status: 500 });
  }
}
