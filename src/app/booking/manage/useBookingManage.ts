"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Booking } from "@/types/booking";
import { formatPhoneNumber } from "@/lib/format";
import { isBeforeDeadline } from "@/lib/booking-utils";
import { track } from "@/lib/analytics";

/** 수정 가능 여부: pending 상태 + 수거 시각 24시간 전 이전 */
export function canEdit(b: Booking): boolean {
  return b.status === "pending" && isBeforeDeadline(b.date, b.timeSlot);
}

/** 일정 변경 가능 여부: quote_confirmed 상태 + 수거 시각 24시간 전 이전 */
export function canReschedule(b: Booking): boolean {
  return b.status === "quote_confirmed" && isBeforeDeadline(b.date, b.timeSlot);
}

/** 취소 가능 여부: pending, quote_confirmed, change_requested + 수거 시각 24시간 전 이전 */
export function canCancel(b: Booking): boolean {
  return (
    b.status === "pending" ||
    b.status === "quote_confirmed" ||
    b.status === "change_requested"
  ) && isBeforeDeadline(b.date, b.timeSlot);
}

export interface EditForm {
  date: string;
  timeSlot: string;
  addressDetail: string;
  hasElevator: boolean;
  hasParking: boolean;
  hasGroundAccess: boolean;
  memo: string;
}

export interface BookingManageState {
  phone: string;
  bookings: Booking[];
  searched: boolean;
  loading: boolean;
  expandedId: string | null;
  cancelling: string | null;
  editingId: string | null;
  editForm: EditForm | null;
  saving: boolean;
  reschedulingId: string | null;
  rescheduleForm: { date: string; timeSlot: string } | null;
  rescheduleSaving: boolean;
  availableSlots: { time: string; available: boolean }[];
  slotsLoading: boolean;
  today: string;
}

export interface BookingManageHandlers {
  setPhone: (phone: string) => void;
  setExpandedId: (id: string | null) => void;
  handleSearch: (e: React.FormEvent) => Promise<void>;
  handleCancel: (id: string) => Promise<void>;
  startEdit: (b: Booking) => void;
  cancelEdit: () => void;
  handleSave: (id: string) => Promise<void>;
  setEditForm: (form: EditForm | null) => void;
  startReschedule: (b: Booking) => void;
  cancelReschedule: () => void;
  handleReschedule: (id: string) => Promise<void>;
  setRescheduleForm: (form: { date: string; timeSlot: string } | null) => void;
  fetchSlots: (date: string, excludeId: string) => Promise<void>;
  formatPhoneNumber: typeof formatPhoneNumber;
  router: ReturnType<typeof useRouter>;
}

export function useBookingManage(): BookingManageState & BookingManageHandlers {
  const router = useRouter();

  const [phone, setPhone] = useState(() => {
    try { return sessionStorage.getItem("covering_manage_phone") || ""; } catch { return ""; }
  });
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
  // 오늘 날짜 (KST 기준, date input min 값용)
  const todayKST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const today = `${todayKST.getFullYear()}-${String(todayKST.getMonth() + 1).padStart(2, "0")}-${String(todayKST.getDate()).padStart(2, "0")}`;

  /** localStorage 또는 sessionStorage에서 bookingToken 가져오기 (다른 기기 지원) */
  function getBookingToken(): string | null {
    try {
      return localStorage.getItem("covering_spot_booking_token")
        || sessionStorage.getItem("covering_spot_booking_token");
    } catch {
      return null;
    }
  }

  async function doSearch(phoneValue: string) {
    if (!phoneValue.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const token = getBookingToken();
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/bookings?phone=${encodeURIComponent(phoneValue.trim())}${tokenParam}`);
      const data = await res.json();
      const found = data.bookings || [];
      setBookings(found);
      // 서버가 발급한 토큰 저장 (다른 기기에서 조회 시 수정/취소 가능하도록)
      if (data.token) {
        try {
          if (!localStorage.getItem("covering_spot_booking_token")) {
            sessionStorage.setItem("covering_spot_booking_token", data.token);
          }
        } catch { /* ignore */ }
      }
      try { sessionStorage.setItem("covering_manage_phone", phoneValue.trim()); } catch { /* ignore */ }
      track("[EVENT] SpotBookingSearchResult", { found: found.length });
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    doSearch(phone);
  }

  // sessionStorage에 전화번호 저장되어 있으면 자동 조회
  const autoSearched = useRef(false);
  useEffect(() => {
    if (autoSearched.current) return;
    if (phone.trim()) {
      autoSearched.current = true;
      doSearch(phone);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel(id: string) {
    track("[CLICK] SpotBookingManageScreen_cancel", { bookingId: id });
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
    track("[CLICK] SpotBookingManageScreen_edit", { bookingId: b.id });
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
    track("[CLICK] SpotBookingManageScreen_reschedule", { bookingId: b.id });
    setReschedulingId(b.id);
    setRescheduleForm({ date: b.date, timeSlot: b.timeSlot || "" });
    fetchSlots(b.date, b.id);
  }

  function cancelReschedule() {
    setReschedulingId(null);
    setRescheduleForm(null);
    setAvailableSlots([]);
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

  return {
    // state
    phone,
    bookings,
    searched,
    loading,
    expandedId,
    cancelling,
    editingId,
    editForm,
    saving,
    reschedulingId,
    rescheduleForm,
    rescheduleSaving,
    availableSlots,
    slotsLoading,
    today,
    // handlers
    setPhone,
    setExpandedId,
    handleSearch,
    handleCancel,
    startEdit,
    cancelEdit,
    handleSave,
    setEditForm,
    startReschedule,
    cancelReschedule,
    handleReschedule,
    setRescheduleForm,
    fetchSlots,
    formatPhoneNumber,
    router,
  };
}
