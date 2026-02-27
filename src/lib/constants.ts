export const KAKAO_CHAT_URL = "https://pf.kakao.com/_bxgWhX/chat";

export const SITE_URL = "https://spot.covering.co.kr";
export const SITE_NAME = "커버링 방문수거";
export const SITE_TITLE = "커버링 방문수거 | 대형폐기물 수거 예약 - 서울·경기·인천";
export const SITE_DESC =
  "소파, 침대, 냉장고 등 대형폐기물 방문수거 전문. 온라인 즉시 견적, 추가비용 없는 확정가. 서울·경기·인천 전 지역 당일수거 가능.";

/* ── 예약 상태 ── */

/** 어드민 · 고객 공통 상태 라벨 (풀 형태) */
export const STATUS_LABELS: Record<string, string> = {
  pending: "견적 산정 중",
  quote_confirmed: "견적 확정",
  user_confirmed: "견적 확인 완료",
  change_requested: "일정 변경 요청",
  in_progress: "수거 진행중",
  completed: "수거 완료",
  payment_requested: "정산 요청",
  payment_completed: "정산 완료",
  cancelled: "취소",
  rejected: "수거 불가",
};

/** 캘린더 · 배차 등 좁은 UI용 축약 라벨 */
export const STATUS_LABELS_SHORT: Record<string, string> = {
  pending: "접수",
  quote_confirmed: "견적확정",
  user_confirmed: "견적확인완료",
  change_requested: "일정변경",
  in_progress: "진행중",
  completed: "수거완료",
  payment_requested: "정산요청",
  payment_completed: "정산완료",
  cancelled: "취소",
  rejected: "수거불가",
};

/** 상태별 배경+글자색 Tailwind 클래스 */
export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-semantic-orange-tint text-semantic-orange",
  quote_confirmed: "bg-primary-tint text-primary",
  user_confirmed: "bg-semantic-green-tint text-semantic-green",
  change_requested: "bg-semantic-orange-tint text-semantic-orange",
  in_progress: "bg-primary-tint text-primary-dark",
  completed: "bg-semantic-green-tint text-semantic-green",
  payment_requested: "bg-semantic-orange-tint text-semantic-orange",
  payment_completed: "bg-semantic-green-tint text-semantic-green",
  cancelled: "bg-semantic-red-tint text-semantic-red",
  rejected: "bg-fill-tint text-text-muted",
};

/** 고객 예약 관리 페이지 상태 안내 문구 */
export const STATUS_MESSAGES: Record<string, string> = {
  pending: "담당자가 견적을 확인 중입니다",
  quote_confirmed: "최종 견적이 확정되었습니다",
  user_confirmed: "견적을 확인하셨습니다. 수거 일정이 확정됩니다",
  change_requested: "일정 변경을 요청하셨습니다. 담당자가 확인 중입니다",
  in_progress: "수거 팀이 방문 중입니다",
  completed: "수거가 완료되었습니다",
  payment_requested: "정산 요청이 발송되었습니다",
  payment_completed: "정산이 완료되었습니다",
  cancelled: "신청이 취소되었습니다",
  rejected: "수거가 불가한 건입니다",
};

/* ── 차량 ── */

export const VEHICLE_TYPES = ["1톤", "1.4톤", "2.5톤", "5톤"] as const;
export const VEHICLE_CAPACITY: Record<string, number> = {
  "1톤": 4.8, "1.4톤": 6.5, "2.5톤": 10.5, "5톤": 20.0,
};

/* ── 시간대 ── */

export const TIME_SLOTS = ["10:00", "12:00", "14:00", "16:00"];
export const TIME_SLOT_LABELS: Record<string, string> = {
  "10:00": "오전 10~12시",
  "12:00": "오후 12~14시",
  "14:00": "오후 14~16시",
  "16:00": "오후 16~18시",
};
