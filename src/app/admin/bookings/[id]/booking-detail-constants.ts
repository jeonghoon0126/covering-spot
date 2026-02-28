export interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export const ACTION_LABELS: Record<string, string> = {
  status_change: "상태 변경",
  info_update: "정보 수정",
  items_update: "품목 수정",
};

/** 다음 상태 전이 맵 */
export const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  pending: [
    { status: "quote_confirmed", label: "견적 확정" },
    { status: "rejected", label: "수거 불가" },
    { status: "cancelled", label: "취소" },
  ],
  quote_confirmed: [
    { status: "cancelled", label: "취소" },
  ],
  user_confirmed: [
    { status: "in_progress", label: "수거 시작" },
    { status: "cancelled", label: "취소" },
    { status: "rejected", label: "수거 불가" },
  ],
  change_requested: [
    { status: "quote_confirmed", label: "변경 확인 완료" },
    { status: "cancelled", label: "취소" },
  ],
  in_progress: [{ status: "completed", label: "수거 완료" }],
  completed: [{ status: "payment_requested", label: "정산 요청" }],
  payment_requested: [{ status: "payment_completed", label: "정산 완료" }],
};

/** 수거 시작(in_progress) 이후 상태에서는 견적/시간/품목 수정 불가 */
export const EDITABLE_STATUSES = ["pending", "quote_confirmed", "user_confirmed", "change_requested"];

/** 품목 카테고리 목록 */
export const ITEM_CATEGORIES = [
  "장롱", "침대", "소파", "가전", "식탁/의자",
  "서랍장", "수납장", "기타 가구", "운동기구", "직접입력",
] as const;

/** 수거 시간대 옵션 */
export const TIME_SLOT_OPTIONS = ["10:00", "12:00", "14:00", "16:00"] as const;

/** 소요시간 옵션 */
export const DURATION_OPTIONS = [
  { label: "30분", value: 30 },
  { label: "1시간", value: 60 },
  { label: "1시간30분", value: 90 },
  { label: "2시간", value: 120 },
] as const;
