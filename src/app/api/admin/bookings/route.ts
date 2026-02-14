import { NextRequest, NextResponse } from "next/server";
import { getAllBookings, getBookingsByStatus } from "@/lib/sheets-db";
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

    const status = req.nextUrl.searchParams.get("status");

    let bookings;
    if (status && status !== "all") {
      bookings = await getBookingsByStatus(status);
    } else {
      bookings = await getAllBookings();
    }

    // 최신순 정렬
    bookings.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // 상태별 카운트 (전체 기준)
    const allBookings = status ? await getAllBookings() : bookings;
    const counts: Record<string, number> = {};
    for (const b of allBookings) {
      counts[b.status] = (counts[b.status] || 0) + 1;
    }

    return NextResponse.json({
      bookings,
      counts,
      total: allBookings.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "조회 실패", detail: String(e) },
      { status: 500 },
    );
  }
}
