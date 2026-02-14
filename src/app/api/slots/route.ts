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

    const bookings = await getBookings(date);
    const bookedTimes = new Set(bookings.map((b) => b.timeSlot));

    const now = new Date();
    const isToday =
      date ===
      now.toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).replace(/\. /g, "-").replace(".", "");

    const kstHour = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    ).getHours();

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
