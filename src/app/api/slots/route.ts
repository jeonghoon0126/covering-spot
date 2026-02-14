import { NextRequest, NextResponse } from "next/server";
import { getBookings } from "@/lib/sheets-db";

const DEFAULT_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json(
        { error: "date 파라미터가 필요합니다" },
        { status: 400 },
      );
    }

    // Google Sheets에서 기존 예약 조회 (실패 시 빈 배열)
    let bookedTimes = new Set<string>();
    try {
      const bookings = await getBookings(date);
      bookedTimes = new Set(bookings.map((b) => b.timeSlot));
    } catch {
      // DB 미연결 시 모든 슬롯 available로 표시
    }

    // KST 기준 오늘 날짜 계산
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
    const isToday = date === todayStr;
    const kstHour = kst.getHours();

    const slots = DEFAULT_SLOTS.map((time) => {
      const hour = parseInt(time.split(":")[0]);
      const isPast = isToday && hour <= kstHour;
      return {
        time,
        available: !bookedTimes.has(time) && !isPast,
      };
    });

    return NextResponse.json({ slots });
  } catch (e) {
    return NextResponse.json(
      { error: "슬롯 조회 실패", detail: String(e) },
      { status: 500 },
    );
  }
}
