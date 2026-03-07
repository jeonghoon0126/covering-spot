"use client";

import { useState, useEffect, useCallback } from "react";

interface SmsLog {
  id: string;
  booking_id: string;
  phone: string;
  template_key: string;
  body_preview: string | null;
  sent_by: string | null;
  sent_at: string;
}

const TEMPLATE_OPTIONS: { value: string; label: string }[] = [
  { value: "received", label: "수거 신청 접수" },
  { value: "quote_confirmed", label: "견적 확정" },
  { value: "in_progress", label: "수거 일정 확정" },
  { value: "dispatched", label: "기사 배정" },
  { value: "time_confirmed", label: "확정 시간 업데이트" },
  { value: "remind_pickup", label: "수거 전날 리마인드" },
  { value: "morning_pickup", label: "수거 당일 출발 예정" },
  { value: "payment_requested", label: "정산 요청" },
  { value: "cancelled", label: "수거 취소" },
];

interface SmsSectionProps {
  bookingId: string;
  token: string;
}

export function SmsSection({ bookingId, token }: SmsSectionProps) {
  const [templateKey, setTemplateKey] = useState(TEMPLATE_OPTIONS[0].value);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/sms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } finally {
      setLogsLoading(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    if (logsOpen && logs.length === 0) fetchLogs();
  }, [logsOpen, logs.length, fetchLogs]);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ templateKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`실패: ${data.error ?? "알 수 없는 오류"}`);
      } else {
        setResult("발송 완료");
        // 이력 갱신
        fetchLogs();
        if (!logsOpen) setLogsOpen(true);
      }
    } catch {
      setResult("네트워크 오류");
    } finally {
      setSending(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="bg-bg rounded-[--radius-md] border border-border-light p-4 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">SMS 발송</h3>

      <div className="flex gap-2">
        <select
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value)}
          className="flex-1 h-9 px-2 border border-border rounded-lg text-sm text-text-primary bg-bg outline-none focus:border-primary"
        >
          {TEMPLATE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleSend}
          disabled={sending}
          className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
        >
          {sending ? "발송 중..." : "발송"}
        </button>
      </div>

      {result && (
        <p className={`text-xs font-medium ${result.startsWith("실패") ? "text-semantic-red" : "text-semantic-green"}`}>
          {result}
        </p>
      )}

      {/* 발송 이력 */}
      <button
        onClick={() => setLogsOpen(!logsOpen)}
        className="text-xs text-text-muted hover:text-text-sub flex items-center gap-1"
      >
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform ${logsOpen ? "rotate-90" : ""}`}
        >
          <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        발송 이력 {logs.length > 0 ? `(${logs.length})` : ""}
      </button>

      {logsOpen && (
        <div className="border border-border-light rounded-lg overflow-hidden">
          {logsLoading ? (
            <p className="text-xs text-text-muted px-3 py-2">불러오는 중...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-text-muted px-3 py-2">발송 이력이 없습니다.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-fill-tint">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-text-sub">시각</th>
                  <th className="px-3 py-2 text-left font-semibold text-text-sub">템플릿</th>
                  <th className="px-3 py-2 text-left font-semibold text-text-sub">미리보기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-fill-tint/50">
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{formatDate(log.sent_at)}</td>
                    <td className="px-3 py-2 font-medium text-text-sub whitespace-nowrap">{log.template_key}</td>
                    <td className="px-3 py-2 text-text-muted max-w-[200px] truncate">{log.body_preview ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
