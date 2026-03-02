"use client";

import { useState } from "react";
import type { Booking } from "@/types/booking";
import type { Driver } from "./dispatch-utils";

/* ── 기사 퇴사/장기부재 대비 재배차 도구 ── */

export interface ReassignModalProps {
  drivers: Driver[];
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

function getToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export default function ReassignModal({ drivers, token, onClose, onSuccess }: ReassignModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [sourceDriverId, setSourceDriverId] = useState("");
  const [dateFrom, setDateFrom] = useState(getToday());
  const [dateTo, setDateTo] = useState(addDays(getToday(), 30));

  // Step 2
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Step 3
  const [targetDriverId, setTargetDriverId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 → Step 2: fetch bookings for source driver + date range
  async function fetchSourceBookings() {
    if (!sourceDriverId) return;
    setLoadingBookings(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/bookings?dateFrom=${dateFrom}&dateTo=${dateTo}&status=all&limit=1000`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      const filtered = ((data.bookings || []) as Booking[]).filter(
        (b) =>
          b.driverId === sourceDriverId &&
          b.status !== "cancelled" &&
          b.status !== "rejected",
      );
      // 날짜 + 시간대 정렬
      filtered.sort((a, b) => {
        const da = (a.date || "") + (a.timeSlot || "");
        const db = (b.date || "") + (b.timeSlot || "");
        return da.localeCompare(db);
      });
      setBookings(filtered);
      setSelectedIds(new Set(filtered.map((b) => b.id)));
      setStep(2);
    } catch {
      setError("예약 목록을 불러오지 못했습니다");
    } finally {
      setLoadingBookings(false);
    }
  }

  // Step 3 → 완료: POST dispatch (date 생략 → 근무요일 체크 스킵)
  async function handleConfirm() {
    if (!targetDriverId || selectedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingIds: Array.from(selectedIds),
          driverId: targetDriverId,
          // date 생략 → 근무요일 체크 스킵
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "재배차에 실패했습니다");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map((b) => b.id)));
    }
  }

  const sourceDriver = drivers.find((d) => d.id === sourceDriverId);
  const targetDriver = drivers.find((d) => d.id === targetDriverId);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-bg rounded-[--radius-lg] border border-border-light shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <h2 className="text-base font-bold">재배차 도구</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-fill-tint transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 단계 표시 */}
        <div className="flex gap-1 px-5 py-3 border-b border-border-light shrink-0">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`flex items-center gap-1.5 text-xs font-medium ${
                s === step ? "text-primary" : s < step ? "text-semantic-green" : "text-text-muted"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                s === step ? "bg-primary text-white" : s < step ? "bg-semantic-green text-white" : "bg-fill-tint text-text-muted"
              }`}>{s}</span>
              {s === 1 ? "기사 선택" : s === 2 ? "예약 확인" : "재배차 기사 선택"}
              {s < 3 && <span className="text-text-muted mx-1">›</span>}
            </div>
          ))}
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-sub block mb-1.5">이동할 기사 (소스)</label>
                <select
                  value={sourceDriverId}
                  onChange={(e) => setSourceDriverId(e.target.value)}
                  className="w-full text-sm border border-border-light rounded-md px-3 py-2 bg-bg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">기사 선택...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.vehicleType})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-text-sub block mb-1.5">기간 시작</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full text-sm border border-border-light rounded-md px-3 py-2 bg-bg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-sub block mb-1.5">기간 종료</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full text-sm border border-border-light rounded-md px-3 py-2 bg-bg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-text-sub">
                  <span className="font-semibold text-text-primary">{sourceDriver?.name}</span>의 예약{" "}
                  <span className="font-semibold text-primary">{bookings.length}건</span>
                  {bookings.length > 0 && (
                    <span className="text-text-muted ml-1">({selectedIds.size}건 선택)</span>
                  )}
                </p>
                {bookings.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    {selectedIds.size === bookings.length ? "전체 해제" : "전체 선택"}
                  </button>
                )}
              </div>
              {bookings.length === 0 ? (
                <p className="text-center py-8 text-text-muted text-sm">해당 기간에 배차된 예약이 없습니다</p>
              ) : (
                <div className="space-y-1.5">
                  {bookings.map((b) => (
                    <label
                      key={b.id}
                      className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                        selectedIds.has(b.id) ? "border-primary/40 bg-primary-tint/30" : "border-border-light bg-bg hover:bg-bg-warm"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(b.id)}
                        onChange={() => toggleId(b.id)}
                        className="accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{b.customerName}</p>
                        <p className="text-xs text-text-muted truncate">
                          {b.date} {b.timeSlot || "시간 미정"} · {b.address}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-bg-warm rounded-md p-3 text-sm">
                <p className="text-text-sub">
                  <span className="font-semibold text-text-primary">{selectedIds.size}건</span>을{" "}
                  <span className="font-semibold text-semantic-red">{sourceDriver?.name}</span>에서
                </p>
                <p className="text-text-sub mt-0.5">아래 기사에게 재배차합니다.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-sub block mb-1.5">대상 기사</label>
                <select
                  value={targetDriverId}
                  onChange={(e) => setTargetDriverId(e.target.value)}
                  className="w-full text-sm border border-border-light rounded-md px-3 py-2 bg-bg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">기사 선택...</option>
                  {drivers.filter((d) => d.id !== sourceDriverId).map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.vehicleType})</option>
                  ))}
                </select>
              </div>
              {targetDriver && (
                <p className="text-xs text-text-muted">
                  근무요일 체크 없이 강제 배차됩니다. (퇴사/긴급 대응용)
                </p>
              )}
            </div>
          )}

          {/* 에러 */}
          {error && (
            <p className="mt-3 text-sm text-semantic-red">{error}</p>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-between gap-2 px-5 py-4 border-t border-border-light shrink-0">
          {step > 1 ? (
            <button
              onClick={() => { setStep((s) => (s > 1 ? s - 1 : s) as 1 | 2 | 3); setError(null); }}
              className="text-sm font-medium text-text-sub px-4 py-2 rounded-md border border-border-light hover:bg-bg-warm transition-colors"
            >
              이전
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-sm font-medium text-text-sub px-4 py-2 rounded-md border border-border-light hover:bg-bg-warm transition-colors"
            >
              취소
            </button>
          )}

          {step === 1 && (
            <button
              onClick={fetchSourceBookings}
              disabled={!sourceDriverId || loadingBookings}
              className="text-sm font-semibold text-white bg-primary px-4 py-2 rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loadingBookings ? "불러오는 중..." : "다음"}
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={selectedIds.size === 0}
              className="text-sm font-semibold text-white bg-primary px-4 py-2 rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              다음 ({selectedIds.size}건)
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleConfirm}
              disabled={!targetDriverId || submitting}
              className="text-sm font-semibold text-white bg-semantic-red px-4 py-2 rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {submitting ? "처리 중..." : `재배차 확인 (${selectedIds.size}건)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
