import { STATUS_LABELS_SHORT } from "@/lib/constants";
import { haversine } from "@/lib/optimizer/haversine";
import type { BookingItem } from "@/types/booking";

/* ── 타입 ── */

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  vehicleType: string;
  vehicleCapacity: number;
  licensePlate: string | null;
}

export interface DriverStats {
  driverId: string;
  driverName: string;
  vehicleType: string;
  vehicleCapacity: number;
  licensePlate: string | null;
  assignedCount: number;
  totalLoadingCube: number;
}

/* ── 상수 ── */

// 배차 페이지: 좁은 UI → 축약 라벨 + 레거시 confirmed 포함
export const STATUS_LABELS: Record<string, string> = {
  ...STATUS_LABELS_SHORT,
  confirmed: "확정",
};

export const SLOT_ORDER = ["오전 (9시~12시)", "오후 (13시~17시)", "저녁 (18시~20시)"];

export const SLOT_LABELS: Record<string, string> = {
  "오전 (9시~12시)": "09:00~12:00",
  "오후 (13시~17시)": "13:00~17:00",
  "저녁 (18시~20시)": "18:00~20:00",
};

// 슬롯별 기사 1인당 최대 배차 기준 (슬롯 시간 ÷ 20분/건 기준)
export const SLOT_MAX_PER_DRIVER: Record<string, number> = {
  "오전 (9시~12시)": 9,
  "오후 (13시~17시)": 12,
  "저녁 (18시~20시)": 6,
};

export const UNASSIGNED_COLOR = "#3B82F6";

// timeSlot 실제 저장값("10:00", "14:00" 등) → SLOT_ORDER 그룹명 매핑
export function mapTimeToSlotGroup(timeSlot: string | null | undefined): string {
  if (!timeSlot) return "기타";
  const hour = parseInt(timeSlot.split(":")[0], 10);
  if (!isNaN(hour)) {
    if (hour >= 9 && hour <= 12) return "오전 (9시~12시)";
    if (hour >= 13 && hour <= 17) return "오후 (13시~17시)";
    if (hour >= 18 && hour <= 20) return "저녁 (18시~20시)";
  }
  // 레거시: 이미 SLOT_ORDER 한글값인 경우 그대로 반환
  if (SLOT_ORDER.includes(timeSlot)) return timeSlot;
  return "기타";
}

// 동선 시간 계산 상수 (서울 시내 기준)
export const ROUTE_ROAD_FACTOR = 1.4;   // 직선거리 → 도로거리 보정계수
export const ROUTE_AVG_SPEED_KMH = 20;  // 서울 시내 평균 이동속도 (km/h)
export const BASE_SERVICE_MINS = 5;     // 수거지당 기본 수거 시간 (분)
export const CUBE_MINS_PER_M3 = 7;      // 적재량 1m³당 추가 수거 시간 (분)

/* ── 유틸 함수 ── */

/** 수거지 서비스 시간 (분) = 기본 5분 + 적재량별 추가 */
export function calcServiceMins(totalLoadingCube: number | undefined): number {
  return Math.max(1, BASE_SERVICE_MINS + Math.round((totalLoadingCube || 0) * CUBE_MINS_PER_M3));
}

/** 두 좌표 간 예상 이동시간 (분) — 직선거리 × 도로보정 / 평균속도 */
export function calcTravelMins(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const km = haversine(lat1, lng1, lat2, lng2) * ROUTE_ROAD_FACTOR;
  return Math.max(1, Math.round(km / ROUTE_AVG_SPEED_KMH * 60));
}

/**
 * 골든앵글(137.508°) 기반 HSL 색상 생성
 * 기사 수에 관계없이 항상 최대 간격으로 구분되는 고유 색상 반환
 */
export function getDriverColor(idx: number): string {
  const hue = Math.round((idx * 137.508) % 360);
  return `hsl(${hue}, 65%, 50%)`;
}

export function getToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export function formatDateShort(dateStr: string): string {
  // KST 기준 명시적 파싱 (서버/클라이언트 시간대 차이 방어)
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const date = new Date(y, m - 1, d);
  return `${m}/${d} (${weekdays[date.getDay()]})`;
}

export function getLoadingPercent(used: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((used / capacity) * 100));
}

export function itemsSummary(items: BookingItem[] | undefined | null): string {
  if (!Array.isArray(items) || items.length === 0) return "-";
  const first = items[0];
  if (!first) return "-";
  const label = `${first.category || ""} ${first.name || ""}`.trim() || "품목";
  return items.length > 1 ? `${label} 외 ${items.length - 1}종` : label;
}
