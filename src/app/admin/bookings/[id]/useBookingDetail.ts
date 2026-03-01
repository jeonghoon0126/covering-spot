"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import type { Booking } from "@/types/booking";
import { safeSessionSet, safeLocalGet, safeLocalRemove } from "@/lib/storage";
import { STATUS_LABELS } from "@/lib/constants";
import { NEXT_STATUS, EDITABLE_STATUSES } from "./booking-detail-constants";
import type { AuditLog } from "./booking-detail-constants";

export function useBookingDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [token, setToken] = useState("");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [adminMemoInput, setAdminMemoInput] = useState("");
  const [confirmedTimeInput, setConfirmedTimeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [slotAvailability, setSlotAvailability] = useState<
    Record<string, { available: boolean; count: number }>
  >({});
  const [editingItems, setEditingItems] = useState(false);
  const [itemEdits, setItemEdits] = useState<{ price: string; category: string }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [confirmedDurationInput, setConfirmedDurationInput] = useState<number | null>(null);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [crewSizeInput, setCrewSizeInput] = useState<number | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // sessionStorage에서 token 가져오기
  useEffect(() => {
    const t = safeLocalGet("admin_token");
    if (!t) {
      safeSessionSet("admin_return_url", window.location.pathname + window.location.search);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  const applyBookingData = useCallback((data: { booking: Booking }) => {
    setBooking(data.booking);
    if (data.booking.finalPrice != null) {
      setFinalPriceInput(String(data.booking.finalPrice));
    }
    if (data.booking.adminMemo) {
      setAdminMemoInput(data.booking.adminMemo);
    } else {
      setAdminMemoInput("");
    }
    if (data.booking.confirmedTime) {
      setConfirmedTimeInput(data.booking.confirmedTime);
    }
    if (data.booking.confirmedDuration != null) {
      setConfirmedDurationInput(data.booking.confirmedDuration);
    }
    if (data.booking.completionPhotos?.length) {
      setCompletionPhotos(data.booking.completionPhotos);
    }
    setCrewSizeInput(data.booking.crewSize ?? 1);
  }, []);

  // 슬롯 가용성 조회
  useEffect(() => {
    if (!booking) return;
    fetch(`/api/slots?date=${booking.date}&excludeId=${booking.id}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, { available: boolean; count: number }> = {};
        for (const s of data.slots || []) {
          map[s.time] = { available: s.available, count: s.count };
        }
        setSlotAvailability(map);
      })
      .catch(() => {});
  }, [booking]);

  // 예약 상세 조회
  useEffect(() => {
    if (!token || !id) return;
    fetch(`/api/admin/bookings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          safeLocalRemove("admin_token");
          safeSessionSet("admin_return_url", window.location.pathname + window.location.search);
          router.push("/admin");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.booking) {
          applyBookingData(data);
        }
      })
      .finally(() => setLoading(false));
  }, [token, id, router, applyBookingData]);

  async function refetchBooking() {
    if (!token || !id) return;
    try {
      const r = await fetch(`/api/admin/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data?.booking) {
        applyBookingData(data);
      }
    } catch {
      /* ignore */
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!booking || !token) return;
    const needsPrice =
      newStatus === "quote_confirmed" && !finalPriceInput.trim();
    if (needsPrice) {
      alert("최종 견적을 입력해주세요");
      return;
    }
    const needsTime =
      newStatus === "quote_confirmed" && !confirmedTimeInput;
    if (needsTime) {
      alert("수거 시간을 확정해주세요");
      return;
    }

    // 슬롯 충돌 경고: 견적 확정 시 시간대 가용 여부 재확인
    if (newStatus === "quote_confirmed" && confirmedTimeInput) {
      try {
        const slotRes = await fetch(
          `/api/slots?date=${booking.date}&excludeId=${booking.id}`
        );
        const slotData = await slotRes.json();
        const slotInfo = (slotData.slots || []).find(
          (s: { time: string; available: boolean }) => s.time === confirmedTimeInput
        );
        if (slotInfo && !slotInfo.available) {
          const proceed = confirm(
            "선택한 시간대가 이미 마감되었습니다. 그래도 확정하시겠습니까?"
          );
          if (!proceed) return;
        }
      } catch {
        // 슬롯 조회 실패 시 그냥 진행
      }
    }

    const confirmMsg = `상태를 "${STATUS_LABELS[newStatus]}"(으)로 변경하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        status: newStatus,
      };
      if (finalPriceInput.trim()) {
        body.finalPrice = Number(finalPriceInput.replace(/[^0-9]/g, ""));
      }
      if (adminMemoInput.trim()) {
        body.adminMemo = adminMemoInput;
      }
      if (confirmedTimeInput) {
        body.confirmedTime = confirmedTimeInput;
      }
      if (confirmedDurationInput != null) {
        body.confirmedDuration = confirmedDurationInput;
      }
      if (newStatus === "completed" && completionPhotos.length > 0) {
        body.completionPhotos = completionPhotos;
      }
      body.expectedUpdatedAt = booking.updatedAt;

      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking(data.booking);
        alert("상태가 변경되었습니다");
      } else if (res.status === 409) {
        alert("다른 탭에서 이미 수정되었습니다. 최신 데이터를 불러옵니다.");
        await refetchBooking();
      } else {
        alert(data.error || "변경 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCrewSize() {
    if (!booking || !token || crewSizeInput == null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          crewSize: crewSizeInput,
          expectedUpdatedAt: booking.updatedAt,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking(data.booking);
      } else if (res.status === 409) {
        alert("다른 탭에서 이미 수정되었습니다.");
        await refetchBooking();
      } else {
        alert(data.error || "저장 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMemo() {
    if (!booking || !token) return;
    setSaving(true);
    try {
      // adminMemo만 저장 — finalPrice/confirmedTime은 견적 확정 플로우에서만 변경
      const body: Record<string, unknown> = {
        adminMemo: adminMemoInput,
        expectedUpdatedAt: booking.updatedAt,
      };
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking(data.booking);
        alert("저장되었습니다");
      } else if (res.status === 409) {
        alert("다른 탭에서 이미 수정되었습니다. 최신 데이터를 불러옵니다.");
        await refetchBooking();
      } else {
        alert(data.error || "저장 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveItems() {
    if (!booking || !token) return;
    setSaving(true);
    try {
      const updatedItems = booking.items.map((item, idx) => ({
        ...item,
        price: Number(itemEdits[idx]?.price || item.price),
        category: itemEdits[idx]?.category || item.category,
      }));
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: updatedItems,
          expectedUpdatedAt: booking.updatedAt,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking(data.booking);
        setEditingItems(false);
        setItemEdits([]);
      }
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(files: FileList) {
    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("photos", files[i]);
      }
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.urls) {
        setCompletionPhotos((prev) => [...prev, ...data.urls]);
      } else {
        alert(data.error || "업로드 실패");
      }
    } catch {
      alert("업로드 실패");
    } finally {
      setUploadingPhotos(false);
    }
  }

  function removeCompletionPhoto(idx: number) {
    setCompletionPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function loadAuditLogs() {
    if (!token || !id) return;
    fetch(`/api/admin/bookings/${id}/audit`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.logs) setAuditLogs(data.logs);
      })
      .catch(() => {});
  }

  function startEditingItems() {
    if (!booking) return;
    setEditingItems(true);
    setItemEdits(
      booking.items.map((i) => ({
        price: String(i.price),
        category: i.category,
      }))
    );
  }

  function cancelEditingItems() {
    setEditingItems(false);
    setItemEdits([]);
  }

  function updateItemEdit(idx: number, field: "price" | "category", value: string) {
    const next = [...itemEdits];
    next[idx] = { ...next[idx], [field]: field === "price" ? value.replace(/[^0-9]/g, "") : value };
    setItemEdits(next);
  }

  const nextActions = booking ? NEXT_STATUS[booking.status] || [] : [];
  const isLocked = booking ? !EDITABLE_STATUSES.includes(booking.status) : true;

  return {
    router,
    booking,
    loading,
    saving,
    isLocked,
    nextActions,

    // 견적
    finalPriceInput,
    setFinalPriceInput,

    // 메모
    adminMemoInput,
    setAdminMemoInput,

    // 시간
    confirmedTimeInput,
    setConfirmedTimeInput,
    slotAvailability,

    // 소요시간
    confirmedDurationInput,
    setConfirmedDurationInput,

    // 인력
    crewSizeInput,
    setCrewSizeInput,

    // 품목 편집
    editingItems,
    itemEdits,
    startEditingItems,
    cancelEditingItems,
    updateItemEdit,

    // 사진
    completionPhotos,
    uploadingPhotos,
    handlePhotoUpload,
    removeCompletionPhoto,

    // 감사 로그
    auditLogs,
    auditOpen,
    setAuditOpen,
    loadAuditLogs,

    // 액션
    handleStatusChange,
    handleSaveCrewSize,
    handleSaveMemo,
    handleSaveItems,
  };
}
