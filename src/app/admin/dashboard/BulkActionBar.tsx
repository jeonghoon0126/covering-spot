"use client";

import { STATUS_LABELS } from "@/lib/constants";
import { STATUS_TABS } from "./dashboard-constants";

interface BulkActionBarProps {
  selectedCount: number;
  bulkStatus: string;
  onBulkStatusChange: (value: string) => void;
  bulkLoading: boolean;
  bulkConfirmPending: boolean;
  onBulkConfirmRequest: () => void;
  onBulkExecute: () => void;
  onBulkConfirmCancel: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  bulkStatus,
  onBulkStatusChange,
  bulkLoading,
  bulkConfirmPending,
  onBulkConfirmRequest,
  onBulkExecute,
  onBulkConfirmCancel,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-bg/95 backdrop-blur-[20px] border-t border-border-light shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium shrink-0">
          {selectedCount}건 선택
        </span>
        {bulkConfirmPending ? (
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="text-sm text-text-sub">
              {selectedCount}건을 &quot;{STATUS_LABELS[bulkStatus] || bulkStatus}&quot;(으)로 변경할까요?
            </span>
            <button
              onClick={onBulkExecute}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-dark transition-all"
            >확인</button>
            <button
              onClick={onBulkConfirmCancel}
              className="px-3 py-2 text-sm text-text-sub hover:text-text-primary transition-colors"
            >취소</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 justify-end">
            <select
              value={bulkStatus}
              onChange={(e) => onBulkStatusChange(e.target.value)}
              className="px-3 py-2 text-sm rounded-md border border-border bg-bg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all duration-200"
            >
              <option value="">상태 선택</option>
              {STATUS_TABS.filter((t) => t.key !== "all").map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={onBulkConfirmRequest}
              disabled={!bulkStatus || bulkLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white disabled:opacity-40 transition-all duration-200 hover:bg-primary-dark"
            >
              {bulkLoading ? "변경중..." : "벌크 변경"}
            </button>
            <button
              onClick={onClearSelection}
              className="px-3 py-2 text-sm text-text-sub hover:text-text-primary transition-colors"
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
