import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookings, getDrivers, updateBooking, getBookingPhonesByIds } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";
import { sendStatusSms } from "@/lib/sms-notify";
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
  driverName: z.string().max(50).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date 형식이 올바르지 않습니다 (YYYY-MM-DD)").optional(),
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

    const { bookingIds, driverId, date } = parsed.data;

    // 항상 활성 기사 목록 조회 (기사 유효성 검증 + 근무요일 체크에 사용)
    const drivers = await getDrivers(true);
    const driver = drivers.find((d) => d.id === driverId);

    // 기사 유효성 검증: 비활성 또는 존재하지 않는 기사 차단
    if (!driver) {
      return NextResponse.json(
        { error: "기사를 찾을 수 없거나 비활성 상태입니다" },
        { status: 422 }
      );
    }

    // 근무요일 체크: date가 제공된 경우 해당 기사의 근무요일 확인
    if (date && driver.workDays) {
      const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
      const dayOfWeek = KO_DAYS[new Date(date + "T00:00:00").getDay()];
      const workDaySet = new Set(driver.workDays.split(",").map((d) => d.trim()));
      if (!workDaySet.has(dayOfWeek)) {
        return NextResponse.json(
          { error: `${driver.name} 기사는 ${dayOfWeek}요일 휴무입니다 (근무일: ${driver.workDays})` },
          { status: 422 }
        );
      }
    }

    // 모든 주문 업데이트 (Promise.allSettled로 부분 실패 안전 처리)
    // DB에서 가져온 driver.name 사용 (요청 body의 driverName 미사용)
    const results = await Promise.allSettled(
      bookingIds.map((id) =>
        updateBooking(id, { driverId, driverName: driver.name } as Partial<Booking>)
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

    // 고객 SMS 발송 (fire-and-forget: SMS 실패가 배차 실패를 유발하지 않음)
    if (succeeded.length > 0) {
      getBookingPhonesByIds(succeeded)
        .then((phoneMap) => {
          for (const [bookingId, phone] of phoneMap.entries()) {
            if (phone) sendStatusSms(phone, "dispatched", bookingId).catch((err) => {
              console.error("[SMS 발송 실패]", { bookingId, status: "dispatched", error: err?.message });
            });
          }
        })
        .catch(console.error);
    }

    // 적재량 초과 경고: date와 vehicleCapacity가 있을 때 해당 날짜 배차 현황 확인
    let capacityWarning: string | undefined;
    if (date && driver.vehicleCapacity > 0) {
      const dateBookings = await getBookings(date);
      const totalCube = dateBookings
        .filter((b) => b.driverId === driverId)
        .reduce((sum, b) => sum + (b.totalLoadingCube || 0), 0);
      if (totalCube > driver.vehicleCapacity) {
        capacityWarning = `${driver.name} 기사 적재량이 초과되었습니다 (${totalCube.toFixed(1)}m³ / ${driver.vehicleCapacity}m³). 확인 후 조정해주세요.`;
      }
    }

    return NextResponse.json({
      success: true,
      updated: succeeded,
      capacityWarning,
    });
  } catch (e) {
    console.error("[admin/dispatch/POST]", e);
    return NextResponse.json({ error: "배차 실패" }, { status: 500 });
  }
}
