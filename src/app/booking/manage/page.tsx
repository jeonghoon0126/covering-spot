"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Booking } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Checkbox } from "@/components/ui/Checkbox";
import { formatPhoneNumber, formatPrice, formatManWon } from "@/lib/format";
import { isBeforeDeadline } from "@/lib/booking-utils";
import { track } from "@/lib/analytics";
import { STATUS_LABELS, STATUS_COLORS, STATUS_MESSAGES, TIME_SLOTS, TIME_SLOT_LABELS } from "@/lib/constants";

/** 수정 가능 여부: pending 상태 + 수거일 전날 22시 이전 */
function canEdit(b: Booking): boolean {
  return b.status === "pending" && isBeforeDeadline(b.date);
}

/** 일정 변경 가능 여부: quote_confirmed 상태 + 수거일 전날 22시 이전 (change_requested는 이미 요청 중이므로 불가) */
function canReschedule(b: Booking): boolean {
  return b.status === "quote_confirmed" && isBeforeDeadline(b.date);
}

/** 취소 가능 여부: pending, quote_confirmed, user_confirmed, change_requested + 수거일 전날 22시 이전 */
function canCancel(b: Booking): boolean {
  return (b.status === "pending" || b.status === "quote_confirmed" || b.status === "user_confirmed" || b.status === "change_requested") && isBeforeDeadline(b.date);
}


interface EditForm {
  date: string;
  timeSlot: string;
  addressDetail: string;
  hasElevator: boolean;
  hasParking: boolean;
  hasGroundAccess: boolean;
  memo: string;
}

export default function BookingManagePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState<{ date: string; timeSlot: string } | null>(null);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

/** localStorage에서 bookingToken 가져오기 */
  function getBookingToken(): string | null {
    try {
      return localStorage.getItem("covering_spot_booking_token");
    } catch {
      return null;
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const token = getBookingToken();
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/bookings?phone=${encodeURIComponent(phone.trim())}${tokenParam}`);
      const data = await res.json();
      const bookings = data.bookings || [];
      setBookings(bookings);
      track("[EVENT] SpotBookingSearchResult", { found: bookings.length });
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("정말 신청을 취소하시겠습니까?")) return;
    track("[EVENT] SpotBookingCancel", { bookingId: id });
    setCancelling(id);
    try {
      const token = getBookingToken();
      const headers: Record<string, string> = {};
      if (token) headers["x-booking-token"] = token;
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, status: "cancelled" as const } : b,
          ),
        );
        alert("신청이 취소되었습니다.");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "취소 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setCancelling(null);
    }
  }

  function startEdit(b: Booking) {
    setEditingId(b.id);
    setEditForm({
      date: b.date,
      timeSlot: b.timeSlot,
      addressDetail: b.addressDetail,
      hasElevator: b.hasElevator,
      hasParking: b.hasParking,
      hasGroundAccess: b.hasGroundAccess,
      memo: b.memo,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function handleSave(id: string) {
    if (!editForm) return;
    setSaving(true);
    try {
      const token = getBookingToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-booking-token"] = token;
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const data = await res.json();
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? data.booking : b)),
        );
        setEditingId(null);
        setEditForm(null);
      } else {
        const err = await res.json();
        alert(err.error || "수정 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  async function fetchSlots(date: string, excludeId: string) {
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/slots?date=${date}&excludeId=${excludeId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.slots || []);
      }
    } catch { /* ignore */ }
    finally { setSlotsLoading(false); }
  }

  function startReschedule(b: Booking) {
    setReschedulingId(b.id);
    setRescheduleForm({ date: b.date, timeSlot: b.timeSlot || "" });
    fetchSlots(b.date, b.id);
  }

  function cancelReschedule() {
    setReschedulingId(null);
    setRescheduleForm(null);
    setAvailableSlots([]);
  }

  async function handleUserConfirm(id: string) {
    if (saving) return;
    setSaving(true);
    try {
      const token = getBookingToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-booking-token"] = token;
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ action: "user_confirm" })
      });
      if (res.ok) {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "user_confirmed" as const } : b));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "확인 처리 실패");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReschedule(id: string) {
    if (!rescheduleForm) return;
    setRescheduleSaving(true);
    try {
      const token = getBookingToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-booking-token"] = token;
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(rescheduleForm),
      });
      if (res.ok) {
        const data = await res.json();
        setBookings((prev) => prev.map((b) => (b.id === id ? data.booking : b)));
        setReschedulingId(null);
        setRescheduleForm(null);
      } else {
        const err = await res.json();
        alert(err.error || "일정 변경 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setRescheduleSaving(false);
    }
  }

  // 오늘 날짜 (KST 기준, date input min 값용)
  const todayKST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const today = `${todayKST.getFullYear()}-${String(todayKST.getMonth() + 1).padStart(2, "0")}-${String(todayKST.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">신청 조회/관리</h1>
        <p className="text-text-sub text-sm">
          신청 시 입력한 전화번호로 조회하세요
        </p>
      </div>

      {/* 전화번호 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2 items-end">
        <div className="flex-1">
          <TextField
            type="tel"
            placeholder="전화번호 (예: 010-1234-5678)"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={loading || !phone.trim()}
          loading={loading}
        >
          조회
        </Button>
      </form>

      {/* 결과 */}
      {searched && !loading && bookings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-muted mb-4">신청 내역이 없습니다</p>
          <Link href="/booking" className="text-primary font-semibold text-sm">
            새 수거 신청하기
          </Link>
        </div>
      )}

      {bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((b) => {
            const isExpanded = expandedId === b.id;
            const isEditing = editingId === b.id;
            const editable = canEdit(b);
            return (
              <div
                key={b.id}
                className="bg-bg rounded-lg shadow-md border border-border-light overflow-hidden"
              >
                {/* 카드 헤더 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-bg-warm/40 transition-colors duration-200"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}
                      >
                        {STATUS_LABELS[b.status] || b.status}
                      </span>
                      <span className="text-xs text-text-muted font-mono">
                        #{b.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="font-semibold text-sm">
                      {b.date} {b.confirmedTime ? `${b.confirmedTime} 확정` : b.timeSlot} | {b.area}
                    </p>
                    <p className="text-[15px] text-primary font-bold mt-0.5">
                      {b.estimateMin > 0 && b.estimateMax > 0
                        ? `${formatManWon(b.estimateMin)} ~ ${formatManWon(b.estimateMax)}원`
                        : `${formatPrice(b.totalPrice)}원`}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`text-text-muted shrink-0 ml-3 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>

                {/* 상세 정보 */}
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-border-light">
                    {/* 상태별 안내 메시지 */}
                    <div className={`mt-4 mb-4 p-3 rounded-md text-sm ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}>
                      <p className="font-medium">
                        {b.status === "quote_confirmed" && b.finalPrice
                          ? `${STATUS_MESSAGES[b.status]} 견적: ${formatPrice(b.finalPrice)}원`
                          : STATUS_MESSAGES[b.status] || "처리 중입니다"}
                      </p>
                    </div>

                    {/* 수정 모드 */}
                    {isEditing && editForm ? (
                      <div className="space-y-4 text-sm">
                        <div>
                          <label className="block text-sm font-semibold text-text-primary mb-2">
                            수거 희망일<span className="ml-0.5 text-semantic-red">*</span>
                          </label>
                          <input
                            type="date"
                            min={today}
                            value={editForm.date}
                            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                            className="w-full h-12 px-4 border border-border rounded-md text-base text-text-primary bg-bg transition-all duration-200 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 appearance-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-primary mb-2">시간대</label>
                          <div className="grid grid-cols-2 gap-2">
                            {TIME_SLOTS.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setEditForm({ ...editForm, timeSlot: slot })}
                                className={`py-3 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${editForm.timeSlot === slot
                                  ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                                  : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
                                  }`}
                              >
                                {TIME_SLOT_LABELS[slot] || slot}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-primary mb-2">상세 주소</label>
                          <TextField
                            value={editForm.addressDetail}
                            onChange={(e) => setEditForm({ ...editForm, addressDetail: e.target.value })}
                            placeholder="동/호수"
                          />
                        </div>
                        <div className="flex gap-4">
                          <Checkbox
                            checked={editForm.hasElevator}
                            onChange={(e) => setEditForm({ ...editForm, hasElevator: e.target.checked })}
                            label="엘리베이터"
                          />
                          <Checkbox
                            checked={editForm.hasParking}
                            onChange={(e) => setEditForm({ ...editForm, hasParking: e.target.checked })}
                            label="주차 가능"
                          />
                          <Checkbox
                            checked={editForm.hasGroundAccess}
                            onChange={(e) => setEditForm({ ...editForm, hasGroundAccess: e.target.checked })}
                            label="지상 출입 가능"
                          />
                        </div>
                        <TextArea
                          label="요청사항"
                          value={editForm.memo}
                          onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                          rows={3}
                          placeholder="요청사항을 입력하세요"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="md"
                            fullWidth
                            onClick={() => handleSave(b.id)}
                            disabled={saving}
                            loading={saving}
                          >
                            저장
                          </Button>
                          <Button
                            variant="tertiary"
                            size="md"
                            fullWidth
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* 읽기 모드 */
                      <div className="space-y-0 text-sm">
                        {b.confirmedTime && (
                          <div className="flex justify-between py-2.5 border-b border-border-light">
                            <span className="text-text-sub">확정 시간</span>
                            <span className="font-bold text-primary">{b.confirmedTime}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2.5 border-b border-border-light">
                          <span className="text-text-sub shrink-0">주소</span>
                          <span className="font-medium text-right max-w-[60%] break-words [overflow-wrap:anywhere]">
                            {b.address} {b.addressDetail}
                          </span>
                        </div>
                        <div className="flex justify-between py-2.5 border-b border-border-light">
                          <span className="text-text-sub">엘리베이터</span>
                          <span className="font-medium">{b.hasElevator ? "사용 가능" : "사용 불가"}</span>
                        </div>
                        <div className="flex justify-between py-2.5 border-b border-border-light">
                          <span className="text-text-sub">주차</span>
                          <span className="font-medium">{b.hasParking ? "가능" : "불가능"}</span>
                        </div>
                        <div className="flex justify-between py-2.5 border-b border-border-light">
                          <span className="text-text-sub">지상 출입</span>
                          <span className="font-medium">{b.hasGroundAccess ? "가능" : "불가"}</span>
                        </div>

                        {b.estimateMin > 0 && b.estimateMax > 0 && (
                          <div className="flex justify-between py-2.5 border-b border-border-light">
                            <span className="text-text-sub">예상 견적</span>
                            <span className="font-medium">
                              {formatManWon(b.estimateMin)} ~ {formatManWon(b.estimateMax)}원
                            </span>
                          </div>
                        )}

                        {b.finalPrice !== null && b.finalPrice !== undefined && b.finalPrice > 0 && (
                          <div className="flex justify-between py-2.5 border-b border-border-light">
                            <span className="text-text-sub font-semibold">최종 견적</span>
                            <span className="font-bold text-primary">
                              {formatPrice(b.finalPrice)}원
                            </span>
                          </div>
                        )}

                        {b.needLadder && (
                          <div className="flex justify-between py-2.5 border-b border-border-light">
                            <span className="text-text-sub">사다리차</span>
                            <span className="font-medium">
                              {b.ladderType} ({formatPrice(b.ladderPrice)}원)
                            </span>
                          </div>
                        )}

                        {b.photos && b.photos.length > 0 && (
                          <div className="flex justify-between py-2.5 border-b border-border-light">
                            <span className="text-text-sub">첨부 사진</span>
                            <span className="font-medium">{b.photos.length}장</span>
                          </div>
                        )}

                        {b.memo && (
                          <div className="flex justify-between py-2.5 border-b border-border-light">
                            <span className="text-text-sub shrink-0">메모</span>
                            <span className="font-medium text-right max-w-[60%] break-words [overflow-wrap:anywhere]">
                              {b.memo}
                            </span>
                          </div>
                        )}

                        {/* 품목 목록 */}
                        <div className="pt-3">
                          <p className="text-text-sub font-medium mb-2">품목</p>
                          {b.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between py-1.5">
                              <span className="truncate max-w-[60%]">
                                {item.category} - {item.name} x{item.quantity}
                              </span>
                              <span className="font-medium">{formatPrice(item.price * item.quantity)}원</span>
                            </div>
                          ))}
                        </div>

                        {/* 일정 변경 폼 (quote_confirmed) */}
                        {reschedulingId === b.id && rescheduleForm && (
                          <div className="space-y-4 mt-3 p-4 bg-bg-warm rounded-md">
                            <p className="text-sm font-semibold">수거 일정 변경</p>
                            <div>
                              <label className="block text-sm font-semibold text-text-primary mb-2">
                                수거 날짜<span className="ml-0.5 text-semantic-red">*</span>
                              </label>
                              <input
                                type="date"
                                min={today}
                                value={rescheduleForm.date}
                                onChange={(e) => {
                                  const newDate = e.target.value;
                                  setRescheduleForm({ ...rescheduleForm, date: newDate, timeSlot: "" });
                                  fetchSlots(newDate, b.id);
                                }}
                                className="w-full h-12 px-4 border border-border rounded-md text-base text-text-primary bg-bg transition-all duration-200 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 appearance-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-text-primary mb-2">
                                수거 시간<span className="ml-0.5 text-semantic-red">*</span>
                              </label>
                              {slotsLoading ? (
                                <p className="text-sm text-text-muted py-3">시간 조회 중...</p>
                              ) : availableSlots.length > 0 ? (
                                <div className="grid grid-cols-4 gap-1.5">
                                  {availableSlots.map((slot) => (
                                    <button
                                      key={slot.time}
                                      type="button"
                                      disabled={!slot.available}
                                      onClick={() => setRescheduleForm({ ...rescheduleForm, timeSlot: slot.time })}
                                      className={`py-2.5 rounded-md text-xs font-medium transition-all duration-200 active:scale-[0.97] ${!slot.available
                                        ? "bg-fill-tint text-text-muted cursor-not-allowed line-through"
                                        : rescheduleForm.timeSlot === slot.time
                                          ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                                          : "bg-bg hover:bg-primary-bg hover:-translate-y-0.5"
                                        }`}
                                    >
                                      {slot.time}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-text-muted py-3">날짜를 선택하면 시간이 표시됩니다</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                size="md"
                                fullWidth
                                onClick={() => handleReschedule(b.id)}
                                disabled={rescheduleSaving || !rescheduleForm.timeSlot}
                                loading={rescheduleSaving}
                              >
                                변경 저장
                              </Button>
                              <Button
                                variant="tertiary"
                                size="md"
                                fullWidth
                                onClick={cancelReschedule}
                                disabled={rescheduleSaving}
                              >
                                취소
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* 견적 확인 완료 버튼 (quote_confirmed 상태일 때만) */}
                        {b.status === "quote_confirmed" && (
                          <div className="mt-3">
                            <Button variant="primary" size="md" fullWidth onClick={() => handleUserConfirm(b.id)} disabled={saving}>
                              견적 확인 완료
                            </Button>
                          </div>
                        )}

                        {/* 수정/일정변경/취소 버튼 */}
                        {canCancel(b) && reschedulingId !== b.id && (
                          <div className="flex gap-2 mt-3">
                            {editable && (
                              <Button
                                variant="secondary"
                                size="md"
                                fullWidth
                                onClick={() => router.push(`/booking?edit=${b.id}`)}
                              >
                                수정
                              </Button>
                            )}
                            {canReschedule(b) && (
                              <Button
                                variant="secondary"
                                size="md"
                                fullWidth
                                onClick={() => startReschedule(b)}
                              >
                                일정 변경
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              size="md"
                              fullWidth
                              onClick={() => handleCancel(b.id)}
                              disabled={cancelling === b.id}
                              loading={cancelling === b.id}
                            >
                              {cancelling === b.id ? "" : "신청 취소"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 새 신청 링크 */}
      <div className="pt-4">
        <Button variant="primary" size="lg" fullWidth href="/booking">
          새 수거 신청하기
        </Button>
      </div>
    </div>
  );
}
