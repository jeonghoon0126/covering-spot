import { STATUS_LABELS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { ACTION_LABELS } from "./booking-detail-constants";
import type { AuditLog } from "./booking-detail-constants";

interface AuditLogSectionProps {
  auditLogs: AuditLog[];
  auditOpen: boolean;
  onToggle: () => void;
}

export function AuditLogSection({
  auditLogs,
  auditOpen,
  onToggle,
}: AuditLogSectionProps) {
  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <button
        className="w-full flex items-center justify-between"
        onClick={onToggle}
      >
        <h3 className="text-sm font-semibold text-text-sub">변경 이력</h3>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`text-text-muted transition-transform duration-200 ${
            auditOpen ? "rotate-180" : ""
          }`}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {auditOpen && (
        <div className="mt-3 pt-3 border-t border-border-light space-y-3">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-text-muted">변경 이력이 없습니다</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="text-xs space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                  <span className="text-text-muted">
                    {log.admin_email === "legacy"
                      ? "비밀번호 로그인"
                      : log.admin_email}
                  </span>
                </div>
                <div className="text-text-muted">
                  {typeof log.details?.previousStatus === "string" &&
                    typeof log.details?.newStatus === "string" && (
                      <span>
                        {STATUS_LABELS[log.details.previousStatus] ||
                          log.details.previousStatus}
                        {" → "}
                        {STATUS_LABELS[log.details.newStatus] ||
                          log.details.newStatus}
                      </span>
                    )}
                  {typeof log.details?.finalPrice === "number" && (
                    <span>
                      {" "}
                      | 견적: {formatPrice(log.details.finalPrice)}원
                    </span>
                  )}
                  {typeof log.details?.confirmedTime === "string" && (
                    <span> | 시간: {log.details.confirmedTime}</span>
                  )}
                </div>
                <div className="text-text-muted/60">
                  {new Date(log.created_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
