/* ── 기사 관리 페이지 공유 상수 & 유틸리티 ── */

// 슬롯 차단 관리: 시간대 (10:00 ~ 17:00, 1시간 단위)
export const SLOT_MGMT_HOURS = Array.from({ length: 8 }, (_, i) => {
  const hour = i + 10;
  return `${String(hour).padStart(2, "0")}:00`;
});

export function getToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${weekdays[d.getDay()]})`;
}

export function nextHour(time: string): string {
  const hour = parseInt(time.split(":")[0], 10) + 1;
  return `${String(hour).padStart(2, "0")}:00`;
}

export const ALL_WORK_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const SLOT_ORDER = ["오전 (9시~12시)", "오후 (13시~17시)", "저녁 (18시~20시)"] as const;
export const SLOT_LABELS: Record<string, string> = {
  "오전 (9시~12시)": "오전",
  "오후 (13시~17시)": "오후",
  "저녁 (18시~20시)": "저녁",
};
