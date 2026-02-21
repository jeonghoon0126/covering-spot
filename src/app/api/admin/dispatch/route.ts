import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookings, getDrivers, updateBooking } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import type { Booking } from "@/types/booking";

/**
 * GET /api/admin/dispatch?date=YYYY-MM-DD
 * 특정 날짜의 배차 현황 조회
 */
export async function GET(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const date = req.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date 파라미터가 필요합니다 (YYYY-MM-DD)" }, { status: 400 });
    }

    const [bookings, drivers] = await Promise.all([
      getBookings(date),
      getDrivers(true),
    ]);

    // 기사별 통계 계산
    const driverStatsMap = new Map<string, {
      driverId: string;
      driverName: string;
      vehicleType: string;
      vehicleCapacity: number;
      licensePlate: string | null;
      assignedCount: number;
      totalLoadingCube: number;
    }>();

    // 모든 활성 기사를 초기화
    for (const driver of drivers) {
      driverStatsMap.set(driver.id, {
        driverId: driver.id,
        driverName: driver.name,
        vehicleType: driver.vehicleType,
        vehicleCapacity: driver.vehicleCapacity,
        licensePlate: driver.licensePlate,
        assignedCount: 0,
        totalLoadingCube: 0,
      });
    }

    // 배차된 주문들의 통계 집계
    for (const booking of bookings) {
      if (booking.driverId) {
        const stats = driverStatsMap.get(booking.driverId);
        if (stats) {
          stats.assignedCount += 1;
          stats.totalLoadingCube += booking.totalLoadingCube || 0;
        }
      }
    }

    const driverStats = Array.from(driverStatsMap.values());

    return NextResponse.json({
      bookings,
      drivers,
      driverStats,
    });
  } catch (e) {
    console.error("[admin/dispatch/GET]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

const BatchDispatchSchema = z.object({
  bookingIds: z.array(z.string().min(1)).min(1).max(50),
  driverId: z.string().min(1),
  driverName: z.string().min(1),
});

/**
 * POST /api/admin/dispatch
 * 여러 주문을 한 번에 배차
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BatchDispatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "잘못된 요청", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { bookingIds, driverId, driverName } = parsed.data;

    // 모든 주문 업데이트 (Promise.allSettled로 부분 실패 안전 처리)
    const results = await Promise.allSettled(
      bookingIds.map((id) =>
        updateBooking(id, { driverId, driverName } as Partial<Booking>)
      )
    );

    const succeeded: string[] = [];
    const failed: string[] = [];

    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value !== null) {
        succeeded.push(bookingIds[idx]);
      } else {
        failed.push(bookingIds[idx]);
      }
    });

    if (failed.length > 0) {
      // 데이터 정합성 유지: 부분 실패 시 성공한 건도 원상복구
      if (succeeded.length > 0) {
        await Promise.allSettled(
          succeeded.map((id) =>
            updateBooking(id, { driverId: null, driverName: null } as Partial<Booking>)
          )
        );
      }
      return NextResponse.json(
        {
          error: `배차 처리 실패 (${failed.length}/${bookingIds.length}건). 다시 시도해 주세요.`,
          failed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: succeeded,
    });
  } catch (e) {
    console.error("[admin/dispatch/POST]", e);
    return NextResponse.json({ error: "배차 실패" }, { status: 500 });
  }
}
