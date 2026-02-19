import { NextRequest, NextResponse } from "next/server";
import { getAllBookings, getBookingsPaginated } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";

export async function GET(req: NextRequest) {
  try {
    // 인증 확인
    if (!validateToken(req)) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200,
    );

    // status가 "all"이면 필터 없이 조회
    const filterStatus = status === "all" ? undefined : status;

    const { bookings, total } = await getBookingsPaginated({
      status: filterStatus,
      dateFrom,
      dateTo,
      search,
      page,
      limit,
    });

    // 상태별 카운트 (전체 기준)
    const allBookings = await getAllBookings();
    const counts: Record<string, number> = {};
    for (const b of allBookings) {
      counts[b.status] = (counts[b.status] || 0) + 1;
    }

    return NextResponse.json({
      bookings,
      counts,
      total,
      page,
      limit,
    });
  } catch (e) {
    console.error("[admin/bookings/GET]", e);
    return NextResponse.json(
      { error: "조회 실패" },
      { status: 500 },
    );
  }
}
