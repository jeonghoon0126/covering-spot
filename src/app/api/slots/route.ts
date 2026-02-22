import { NextRequest, NextResponse } from "next/server";
import { getBookings, getBlockedSlots } from "@/lib/db";
import { isDateBookable } from "@/lib/booking-utils";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const DEFAULT_SLOTS = ["10:00", "12:00", "14:00", "16:00"];

// 2시간 단위 슬롯 표시 레이블 (운영시간: 10시~18시)
const SLOT_LABELS: Record<string, string> = {
  "10:00": "10:00~12:00",
  "12:00": "12:00~14:00",
  "14:00": "14:00~16:00",
  "16:00": "16:00~18:00",
};

// 시간대별 최대 예약 수
const MAX_PER_SLOT = 2;

// 30분 단위 시간을 2시간 슬롯으로 매핑
function mapTo2HourSlot(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m;

  // 구 슬롯(09:00~10:00) 호환: 가장 가까운 10:00 슬롯으로 매핑
  if (totalMinutes >= 9 * 60 && totalMinutes < 10 * 60) return "10:00";
  // 10:00~12:00 -> "10:00"
  if (totalMinutes >= 10 * 60 && totalMinutes < 12 * 60) return "10:00";
  // 12:00~14:00 -> "12:00"
  if (totalMinutes >= 12 * 60 && totalMinutes < 14 * 60) return "12:00";
  // 14:00~16:00 -> "14:00"
  if (totalMinutes >= 14 * 60 && totalMinutes < 16 * 60) return "14:00";
  // 16:00~18:00 -> "16:00"
  if (totalMinutes >= 16 * 60 && totalMinutes < 18 * 60) return "16:00";
  // 구 슬롯(18:00~19:00) 호환: 가장 가까운 16:00 슬롯으로 매핑
  if (totalMinutes >= 18 * 60 && totalMinutes < 19 * 60) return "16:00";

  return time; // fallback
}

// 2시간 슬롯이 blocked_slots의 timeStart~timeEnd와 겹치는지 확인
function isSlotBlockedByRange(slotStart: string, timeStart: string, timeEnd: string): boolean {
  // 슬롯의 2시간 범위 계산 (예: "10:00" -> 10:00~12:00)
  const [sh, sm] = slotStart.split(":").map(Number);
  const slotStartMinutes = sh * 60 + sm;
  const slotEndMinutes = slotStartMinutes + 120; // 2시간 = 120분

  // blocked 범위 계산
  const [bh1, bm1] = timeStart.split(":").map(Number);
  const [bh2, bm2] = timeEnd.split(":").map(Number);
  const blockedStartMinutes = bh1 * 60 + bm1;
  const blockedEndMinutes = bh2 * 60 + bm2;

  // 겹침 판정: 슬롯 범위와 blocked 범위가 교집합이 있는지
  return !(slotEndMinutes <= blockedStartMinutes || slotStartMinutes >= blockedEndMinutes);
}

export async function GET(req: NextRequest) {
  try {
    // Rate limiting: 30 requests per IP per 60s
    const ip = getRateLimitKey(req);
    const rl = rateLimit(`${ip}:/api/slots/GET`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해주세요", retryAfter: rl.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfter) },
        },
      );
    }

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
    let blockedTimes: Set<string> = new Set();
    try {
      // 병렬 조회 (성능 최적화)
      const [bookings, blocked] = await Promise.all([
        getBookings(date),
        getBlockedSlots(date),
      ]);
      for (const b of bookings) {
        if (b.confirmedTime && (!excludeId || b.id !== excludeId)) {
          // 기존 30분 단위 예약을 2시간 슬롯으로 변환
          const mapped2HourSlot = mapTo2HourSlot(b.confirmedTime);
          confirmedCounts[mapped2HourSlot] =
            (confirmedCounts[mapped2HourSlot] || 0) + 1;
        }
      }

      for (const bs of blocked) {
        // timeStart ~ timeEnd 범위와 겹치는 2시간 슬롯을 차단
        for (const slot of DEFAULT_SLOTS) {
          if (isSlotBlockedByRange(slot, bs.timeStart, bs.timeEnd)) {
            blockedTimes.add(slot);
          }
        }
      }
    } catch (dbErr) {
      console.error("[slots/GET] DB 조회 실패", dbErr);
      return NextResponse.json(
        { error: "슬롯 조회 중 오류가 발생했습니다" },
        { status: 500 },
      );
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
      const isPast = isToday && slotMinutes < kstMinutes;
      const count = confirmedCounts[time] || 0;
      const isBlocked = blockedTimes.has(time);
      return {
        time,
        label: SLOT_LABELS[time],
        available: count < MAX_PER_SLOT && !isPast && !isBlocked,
        count,
        blocked: isBlocked,
      };
    });

    return NextResponse.json({ slots });
  } catch (e) {
    console.error("[slots/GET]", e);
    return NextResponse.json(
      { error: "슬롯 조회 실패" },
      { status: 500 },
    );
  }
}
