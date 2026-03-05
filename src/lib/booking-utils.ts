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
