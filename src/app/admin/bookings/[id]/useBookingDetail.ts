"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import type { Booking } from "@/types/booking";
import type { SpotItem } from "@/lib/db-misc";
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
  const [saving, setSaving] = useState(false);

  // Form states
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [adminMemoInput, setAdminMemoInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [confirmedTimeInput, setConfirmedTimeInput] = useState("");
  const [confirmedDurationInput, setConfirmedDurationInput] = useState<number | null>(null);
  const [crewSizeInput, setCrewSizeInput] = useState<number | null>(null);

  // Item editing states
  const [editingItems, setEditingItems] = useState(false);
  const [itemEdits, setItemEdits] = useState<{ price: string; category: string; name: string }[]>([]);

  // Item matching states
  const [allSpotItems, setAllSpotItems] = useState<SpotItem[]>([]);
  const [matchingIdx, setMatchingIdx] = useState<number | null>(null);
  const [matchingSearchQuery, setMatchingSearchQuery] = useState("");

  // Other UI states
  const [slotAvailability, setSlotAvailability] = useState<
    Record<string, { available: boolean; count: number }>
  >({});
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);

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
    setFinalPriceInput(String(data.booking.finalPrice ?? ""));
    setAdminMemoInput(data.booking.adminMemo || "");
    setDateInput(data.booking.date);
    setConfirmedTimeInput(data.booking.confirmedTime || "");
    setConfirmedDurationInput(data.booking.confirmedDuration ?? null);
    setCompletionPhotos(data.booking.completionPhotos || []);
    setCrewSizeInput(data.booking.crewSize ?? 1);
  }, []);

  // 슬롯 가용성 조회 (dateInput 변경 시 재조회)
  useEffect(() => {
    if (!dateInput || !booking) return;
    fetch(`/api/slots?date=${dateInput}&excludeId=${booking.id}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, { available: boolean; count: number }> = {};
        for (const s of data.slots || []) {
          map[s.time] = { available: s.available, count: s.count };
        }
        setSlotAvailability(map);
      })
      .catch(() => {});
  }, [booking, dateInput]);

  // 모든 단가 품목 조회
  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        if (data.categories) {
          const flattenedItems = data.categories.flatMap((cat: { items: SpotItem[] }) => cat.items);
          setAllSpotItems(flattenedItems);
        }
      })
      .catch(err => console.error("Failed to fetch spot items", err));
  }, []);

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
    if (newStatus === "quote_confirmed") {
      if (!finalPriceInput.trim()) {
        alert("최종 견적을 입력해주세요");
        return;
      }
      if (!confirmedTimeInput) {
        alert("수거 시간을 확정해주세요");
        return;
      }
      // 슬롯 충돌 경고
      try {
        const slotRes = await fetch(`/api/slots?date=${dateInput}&excludeId=${booking.id}`);
        const slotData = await slotRes.json();
        const slotInfo = (slotData.slots || []).find((s: { time: string; available: boolean }) => s.time === confirmedTimeInput);
        if (slotInfo && !slotInfo.available) {
          if (!confirm("선택한 시간대가 이미 마감되었습니다. 그래도 확정하시겠습니까?")) return;
        }
      } catch { /* ignore */ }
    }

    if (!confirm(`상태를 "${STATUS_LABELS[newStatus]}"(으)로 변경하시겠습니까?`)) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = { status: newStatus, expectedUpdatedAt: booking.updatedAt };
      if (finalPriceInput.trim()) body.finalPrice = Number(finalPriceInput.replace(/[^0-9]/g, ""));
      if (adminMemoInput.trim()) body.adminMemo = adminMemoInput;
      if (dateInput && dateInput !== booking.date) body.date = dateInput;
      if (confirmedTimeInput) body.confirmedTime = confirmedTimeInput;
      if (confirmedDurationInput != null) body.confirmedDuration = confirmedDurationInput;
      if (newStatus === "completed" && completionPhotos.length > 0) body.completionPhotos = completionPhotos;

      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ crewSize: crewSizeInput, expectedUpdatedAt: booking.updatedAt }),
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
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adminMemo: adminMemoInput, expectedUpdatedAt: booking.updatedAt }),
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
        price: Number(itemEdits[idx]?.price ?? item.price),
        category: itemEdits[idx]?.category ?? item.category,
        name: itemEdits[idx]?.name ?? item.name,
      }));
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: updatedItems, expectedUpdatedAt: booking.updatedAt }),
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
      for (let i = 0; i < files.length; i++) formData.append("photos", files[i]);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
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
    fetch(`/api/admin/bookings/${id}/audit`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.logs) setAuditLogs(data.logs); })
      .catch(() => {});
  }

  function startEditingItems() {
    if (!booking) return;
    setEditingItems(true);
    setItemEdits(booking.items.map((i) => ({ price: String(i.price), category: i.category, name: i.name })));
  }

  function cancelEditingItems() {
    setEditingItems(false);
    setItemEdits([]);
    cancelMatchingItem();
  }

  function updateItemEdit(idx: number, field: "price" | "category" | "name", value: string) {
    const next = [...itemEdits];
    const current = next[idx] || { price: "", category: "", name: "" };
    next[idx] = { ...current, [field]: field === "price" ? value.replace(/[^0-9]/g, "") : value };
    setItemEdits(next);
  }

  // Item Matching Handlers
  function startMatchingItem(idx: number) {
    if (!booking) return;
    setMatchingIdx(idx);
    setMatchingSearchQuery(booking.items[idx].name);
  }

  function cancelMatchingItem() {
    setMatchingIdx(null);
    setMatchingSearchQuery("");
  }

  function selectMatchedItem(idx: number, item: SpotItem) {
    updateItemEdit(idx, 'category', item.category);
    updateItemEdit(idx, 'name', item.name);
    updateItemEdit(idx, 'price', String(item.price));
    cancelMatchingItem();
  }

  async function registerAndSelectNewItem(idx: number, itemInfo: { category: string; name: string; price: number; loadingCube: number }) {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/items", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...itemInfo, displayName: itemInfo.name }),
      });
      const data = await res.json();
      if (res.ok && data.item) {
        setAllSpotItems(prev => [...prev, data.item]);
        selectMatchedItem(idx, data.item);
      } else {
        alert(data.error || "품목 등록 실패");
      }
    } catch {
      alert("품목 등록 중 오류 발생");
    } finally {
      setSaving(false);
    }
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
    finalPriceInput,
    setFinalPriceInput,
    adminMemoInput,
    setAdminMemoInput,
    dateInput,
    setDateInput,
    confirmedTimeInput,
    setConfirmedTimeInput,
    slotAvailability,
    confirmedDurationInput,
    setConfirmedDurationInput,
    crewSizeInput,
    setCrewSizeInput,
    editingItems,
    itemEdits,
    startEditingItems,
    cancelEditingItems,
    updateItemEdit,
    completionPhotos,
    uploadingPhotos,
    handlePhotoUpload,
    removeCompletionPhoto,
    auditLogs,
    auditOpen,
    setAuditOpen,
    loadAuditLogs,
    handleStatusChange,
    handleSaveCrewSize,
    handleSaveMemo,
    handleSaveItems,
    // Item matching
    allSpotItems,
    matchingIdx,
    matchingSearchQuery,
    setMatchingSearchQuery,
    startMatchingItem,
    cancelMatchingItem,
    selectMatchedItem,
    registerAndSelectNewItem,
  };
}
