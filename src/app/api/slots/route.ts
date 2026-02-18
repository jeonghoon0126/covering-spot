import { NextRequest, NextResponse } from "next/server";
import { getBookings } from "@/lib/db";
import { isDateBookable } from "@/lib/booking-utils";

const DEFAULT_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

// 시간대별 최대 예약 수
const MAX_PER_SLOT = 2;

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json(
        { error: "date 파라미터가 필요합니다" },
        { status: 400 },
      );
    }

    // 전날 12시 마감 정책 검증
    if (!isDateBookable(date)) {
      return NextResponse.json(
        { error: "예약 가능 기간이 아닙니다. 전날 12시까지 신청 가능합니다." },
        { status: 400 },
      );
    }

    // 자기 자신의 예약 제외 (admin 시간 확정 시 사용)
    const excludeId = req.nextUrl.searchParams.get("excludeId");

    // 해당 날짜의 활성 예약 조회 (cancelled 제외)
    let confirmedCounts: Record<string, number> = {};
    try {
      const bookings = await getBookings(date);
      for (const b of bookings) {
        if (b.confirmedTime && (!excludeId || b.id !== excludeId)) {
          confirmedCounts[b.confirmedTime] =
            (confirmedCounts[b.confirmedTime] || 0) + 1;
        }
      }
    } catch {
      // DB 미연결 시 모든 슬롯 available로 표시
    }

    // KST 기준 오늘 날짜 계산
    const now = new Date();
    const kst = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    );
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
    const isToday = date === todayStr;
    const kstMinutes = kst.getHours() * 60 + kst.getMinutes();

    const slots = DEFAULT_SLOTS.map((time) => {
      const [h, m] = time.split(":").map(Number);
      const slotMinutes = h * 60 + m;
      const isPast = isToday && slotMinutes <= kstMinutes;
      const count = confirmedCounts[time] || 0;
      return {
        time,
        available: count < MAX_PER_SLOT && !isPast,
        count,
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
