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
