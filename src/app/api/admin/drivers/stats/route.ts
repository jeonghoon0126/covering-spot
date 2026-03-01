import { NextRequest, NextResponse } from "next/server";
import { getBookingsPaginated, getDrivers } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!validateToken(req)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const month = req.nextUrl.searchParams.get("month"); // "YYYY-MM"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month 파라미터 필요 (YYYY-MM)" }, { status: 400 });
    }

    const [year, mon] = month.split("-").map(Number);
    const dateFrom = `${month}-01`;
    const lastDate = new Date(year, mon, 0).getDate();
    const dateTo = `${month}-${String(lastDate).padStart(2, "0")}`;

    const [{ bookings }, drivers] = await Promise.all([
      getBookingsPaginated({ dateFrom, dateTo, limit: 1000 }),
      getDrivers(false),
    ]);

    // 배차된 예약만 집계 (취소/수거불가 제외)
    const activeBookings = bookings.filter(
      (b) => b.status !== "cancelled" && b.status !== "rejected" && b.driverId,
    );

    // driverId → stats 집계
    const statsMap = new Map<string, { bookingCount: number; totalLoadingCube: number }>();
    for (const b of activeBookings) {
      const key = b.driverId!;
      const prev = statsMap.get(key) ?? { bookingCount: 0, totalLoadingCube: 0 };
      statsMap.set(key, {
        bookingCount: prev.bookingCount + 1,
        totalLoadingCube: prev.totalLoadingCube + (b.totalLoadingCube ?? 0),
      });
    }

    const stats = drivers
      .map((d) => {
        const s = statsMap.get(d.id) ?? { bookingCount: 0, totalLoadingCube: 0 };
        return {
          driverId: d.id,
          driverName: d.name,
          vehicleType: d.vehicleType,
          active: d.active,
          bookingCount: s.bookingCount,
          totalLoadingCube: s.totalLoadingCube,
          avgLoadingCube: s.bookingCount > 0
            ? Math.round((s.totalLoadingCube / s.bookingCount) * 10) / 10
            : 0,
        };
      })
      .sort((a, b) => b.bookingCount - a.bookingCount);

    return NextResponse.json({ stats, month });
  } catch (e) {
    console.error("[drivers/stats/GET]", e);
    return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
  }
}
