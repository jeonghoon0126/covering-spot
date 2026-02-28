export const PAGE_SIZE = 50;

export interface SheetImportRow {
  rowIndex: number;
  customerName?: string;
  phone?: string;
  address?: string;
  addressDetail?: string;
  date?: string;
  timeSlot?: string;
  area?: string;
  estimatedPrice?: string;
  itemsDescription?: string;
  memo?: string;
  errors: string[];
}

export const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "접수" },
  { key: "quote_confirmed", label: "견적확정" },
  { key: "user_confirmed", label: "견적확인완료" },
  { key: "change_requested", label: "일정변경요청" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "수거완료" },
  { key: "payment_requested", label: "정산요청" },
  { key: "payment_completed", label: "정산완료" },
  { key: "cancelled", label: "취소" },
] as const;

// 대시보드에서 바로 실행 가능한 다음 상태 (추가 입력 불필요한 것만)
export const QUICK_ACTIONS: Record<string, { status: string; label: string; color: string }> = {
  user_confirmed: { status: "in_progress", label: "수거 시작", color: "bg-primary text-white" },
  in_progress: { status: "completed", label: "수거 완료", color: "bg-semantic-green text-white" },
  completed: { status: "payment_requested", label: "정산 요청", color: "bg-semantic-orange text-white" },
  payment_requested: { status: "payment_completed", label: "정산 완료", color: "bg-semantic-green text-white" },
};
