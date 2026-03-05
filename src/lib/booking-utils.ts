/**
 * 예약 날짜 마감 유틸리티
 * 정책: 수거 희망일 전날 12시(정오) KST까지 신청 가능
 * 예) 2/17 수거 → 2/16 12:00 KST까지 신청
 */

/** KST 기준 현재 시각 */
function getKSTNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
}

/** 예약 가능한 최소 날짜 (YYYY-MM-DD) */
export function getEarliestBookableDate(): string {
  const kst = getKSTNow();
  // 12시 이전 → 내일부터, 12시 이후 → 모레부터
  const daysToAdd = kst.getHours() < 12 ? 1 : 2;
  const earliest = new Date(kst);
  earliest.setDate(earliest.getDate() + daysToAdd);
  return `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2, "0")}-${String(earliest.getDate()).padStart(2, "0")}`;
}

/** 특정 날짜가 예약 가능한지 검증 */
export function isDateBookable(dateStr: string): boolean {
  return dateStr >= getEarliestBookableDate();
}

/**
 * 수거일 기준 고객 수정/취소 마감 시각
 * 정책: 수거 날짜 + time_slot 기준 24시간 전
 * 예) 03/07 14:00 수거 → 03/06 14:00까지 취소 가능
 */
export function getCustomerDeadline(bookingDate: string, timeSlot: string): Date {
  const pickupDatetime = new Date(`${bookingDate}T${timeSlot}:00+09:00`);
  return new Date(pickupDatetime.getTime() - 24 * 60 * 60 * 1000);
}

/** 수정/취소 가능 여부 */
export function isBeforeDeadline(bookingDate: string, timeSlot: string): boolean {
  return new Date() < getCustomerDeadline(bookingDate, timeSlot);
}

/**
 * 상세주소에서 층수 자동 추출
 * "101동 1502호" → 15, "3층" → 3, "지하1층" → -1, 판별 불가 → 1
 */
export function extractFloor(addressDetail: string): number {
  if (!addressDetail) return 1;

  // 1. 명시적 "N층" 패턴 (지하 포함)
  const floorMatch = addressDetail.match(/(\d+)\s*층/);
  if (floorMatch) {
    const floor = parseInt(floorMatch[1]);
    const beforeMatch = addressDetail.slice(0, addressDetail.indexOf(floorMatch[0]));
    if (/지하/.test(beforeMatch)) return -floor;
    return floor;
  }

  // 2. "XXXX호" → 아파트 호수에서 층수 추출 (3~4자리)
  const unitMatch = addressDetail.match(/(\d{3,4})\s*호/);
  if (unitMatch) {
    const unitNum = parseInt(unitMatch[1]);
    return Math.floor(unitNum / 100);
  }

  // 3. 지하 패턴 (B1, 지하 등)
  if (/지하|[Bb]\d/.test(addressDetail)) return -1;

  // 4. 판별 불가 → 1층 (추가 인력/사다리차 조건 미발동)
  return 1;
}

/**
 * displayName에서 무게(kg) 추출
 * "장롱 - 3자 - 90X60X200 무게: 80kg 54000원" → 80
 */
export function extractWeight(displayName: string): number {
  const match = displayName.match(/무게:\s*(\d+(?:\.\d+)?)\s*kg/i);
  return match ? parseFloat(match[1]) : 0;
}
