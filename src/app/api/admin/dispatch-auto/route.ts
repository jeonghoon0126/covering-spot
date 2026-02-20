import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookings, getDrivers, getUnloadingPoints, updateBooking } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { autoDispatch } from "@/lib/optimizer/auto-dispatch";
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
    const unassignedBookings = allBookings.filter(
      (b) => !b.driverId && b.status !== "cancelled" && b.status !== "rejected",
    );

    if (unassignedBookings.length === 0) {
      return NextResponse.json({
        plan: [],
        unassigned: [],
        stats: { totalBookings: 0, assigned: 0, unassigned: 0, totalDistance: 0 },
        message: "미배차 주문이 없습니다",
      });
    }

    // Booking → DispatchBooking 변환
    const dispatchBookings: DispatchBooking[] = unassignedBookings.map((b) => ({
      id: b.id,
      lat: b.latitude || 0,
      lng: b.longitude || 0,
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

    return NextResponse.json(result);
  } catch (e) {
    console.error("[dispatch-auto/POST]", e);
    return NextResponse.json({ error: "자동배차 실패" }, { status: 500 });
  }
}

const ApplySchema = z.object({
  plan: z.array(
    z.object({
      driverId: z.string().min(1),
      driverName: z.string().min(1),
      bookings: z.array(
        z.object({
          id: z.string().min(1),
          routeOrder: z.number().int().positive(),
        }),
      ),
    }),
  ),
});

/**
 * PUT /api/admin/dispatch-auto
 * 자동배차 결과 일괄 적용
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

    // 기사별로 일괄 업데이트
    for (const driverPlan of plan) {
      const results = await Promise.allSettled(
        driverPlan.bookings.map((b) =>
          updateBooking(b.id, {
            driverId: driverPlan.driverId,
            driverName: driverPlan.driverName,
            routeOrder: b.routeOrder,
          } as Partial<Booking>),
        ),
      );

      results.forEach((result, idx) => {
        const bookingId = driverPlan.bookings[idx].id;
        if (result.status === "fulfilled" && result.value !== null) {
          succeeded.push(bookingId);
        } else {
          failed.push(bookingId);
        }
      });
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
