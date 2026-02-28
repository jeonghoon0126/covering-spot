"use client";

import { useState, useCallback, useMemo } from "react";
import type { Booking, UnloadingPoint } from "@/types/booking";
import type { AutoDispatchResult } from "@/lib/optimizer/types";
import type { MapMarker } from "@/components/admin/KakaoMap";
import { SLOT_ORDER } from "./dispatch-utils";

/* ── 자동배차 로직 전용 훅 ── */

interface UseAutoDispatchParams {
  token: string;
  selectedDate: string;
  unloadingPoints: UnloadingPoint[];
  bookings: Booking[];
  driverColorMap: Map<string, string>;
  showToast: (msg: string, type?: "success" | "error" | "warning") => void;
  fetchData: (opts?: { silent?: boolean }) => Promise<void>;
  setShowUnloadingModal: (open: boolean) => void;
}

export interface UseAutoDispatchReturn {
  autoMode: "idle" | "loading" | "preview";
  autoResult: AutoDispatchResult | null;
  autoApplying: boolean;
  partialFailedIds: string[];
  setPartialFailedIds: React.Dispatch<React.SetStateAction<string[]>>;
  showSlotConfig: boolean;
  setShowSlotConfig: React.Dispatch<React.SetStateAction<boolean>>;
  driverSlotFilters: Record<string, string[]>;
  toggleDriverSlot: (driverId: string, slot: string) => void;
  previewMapMarkers: MapMarker[];
  handleAutoDispatch: () => Promise<void>;
  handleAutoApply: () => Promise<void>;
  handleAutoCancel: () => void;
  handleAutoReorder: (driverId: string, newIds: string[]) => void;
}

export function useAutoDispatch({
  token,
  selectedDate,
  unloadingPoints,
  bookings,
  driverColorMap,
  showToast,
  fetchData,
  setShowUnloadingModal,
}: UseAutoDispatchParams): UseAutoDispatchReturn {
  const [autoMode, setAutoMode] = useState<"idle" | "loading" | "preview">("idle");
  const [autoResult, setAutoResult] = useState<AutoDispatchResult | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);
  const [partialFailedIds, setPartialFailedIds] = useState<string[]>([]);
  // 자동배차 고급 설정 — 기사별 시간대 제약
  const [showSlotConfig, setShowSlotConfig] = useState(false);
  const [driverSlotFilters, setDriverSlotFilters] = useState<Record<string, string[]>>({});

  // 자동배차 고급 설정 — 기사별 시간대 토글
  function toggleDriverSlot(driverId: string, slot: string) {
    setDriverSlotFilters((prev) => {
      const current = prev[driverId] ?? [...SLOT_ORDER];
      const next = current.includes(slot)
        ? current.filter((s) => s !== slot)
        : [...current, slot];
      // 전체 허용 = 필터 없음으로 정규화
      return { ...prev, [driverId]: next.length === SLOT_ORDER.length ? [] : next };
    });
  }

  // 자동배차 실행 (미리보기)
  const handleAutoDispatch = useCallback(async () => {
    if (!token || autoMode === "loading") return;
    // 활성 하차지 없으면 자동배차 실행 불가
    if (unloadingPoints.filter((p) => p.active).length === 0) {
      showToast("활성 하차지가 없습니다. 하차지를 먼저 등록해주세요.", "warning");
      setShowUnloadingModal(true);
      return;
    }
    setAutoMode("loading");
    try {
      const res = await fetch("/api/admin/dispatch-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date: selectedDate,
          ...(Object.keys(driverSlotFilters).length > 0 ? { driverSlotFilters } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || data.message || "자동배차 실패");
        setAutoMode("idle");
        return;
      }
      const result = await res.json() as AutoDispatchResult & { message?: string };
      if (result.plan.length === 0 && result.stats.totalBookings === 0) {
        showToast(result.message || "미배차 주문이 없습니다", "warning");
        setAutoMode("idle");
        return;
      }
      setAutoResult(result);
      setAutoMode("preview");
    } catch {
      showToast("네트워크 오류");
      setAutoMode("idle");
    }
  }, [token, selectedDate, autoMode, driverSlotFilters, unloadingPoints, showToast, setShowUnloadingModal]);

  // 자동배차 적용
  const handleAutoApply = useCallback(async () => {
    if (!token || !autoResult || autoApplying) return;
    setAutoApplying(true);
    try {
      const res = await fetch("/api/admin/dispatch-auto", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          plan: autoResult.plan.map(({ driverId, bookings: planBookings, unloadingStops }) => ({
            driverId,
            bookings: planBookings.map(({ id, routeOrder, loadCube }) => ({ id, routeOrder, loadCube })),
            unloadingStops: (unloadingStops || []).map(({ afterRouteOrder, pointId }) => ({ afterRouteOrder, pointId })),
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.partialFailure) {
          setPartialFailedIds(data.failed || []);
          showToast(`${data.updated?.length || 0}건 성공, ${data.failed?.length || 0}건 실패`, "warning");
        } else {
          setPartialFailedIds([]);
          showToast(`${data.updated?.length || 0}건 배차 적용 완료`, "success");
        }
        setAutoMode("idle");
        setAutoResult(null);
        setDriverSlotFilters({});
        setShowSlotConfig(false);
        fetchData({ silent: true });
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "적용 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setAutoApplying(false);
    }
  }, [token, autoResult, autoApplying, fetchData, showToast]);

  // 자동배차 취소
  const handleAutoCancel = useCallback(() => {
    setAutoMode("idle");
    setAutoResult(null);
    setPartialFailedIds([]);
  }, []);

  // 자동배차 미리보기 내 순서 변경 (drag-and-drop)
  const handleAutoReorder = useCallback((driverId: string, newIds: string[]) => {
    setAutoResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plan: prev.plan.map((dp) => {
          if (dp.driverId !== driverId) return dp;
          const reordered = newIds
            .map((id) => dp.bookings.find((b) => b.id === id))
            .filter((b): b is NonNullable<typeof b> => b !== undefined)
            .map((b, idx) => ({ ...b, routeOrder: idx + 1 }));
          return { ...dp, bookings: reordered };
        }),
      };
    });
  }, []);

  // 자동배차 미리보기용 마커 (배차 계획의 기사 색상 적용)
  const previewMapMarkers: MapMarker[] = useMemo(() => {
    if (autoMode !== "preview" || !autoResult) return [];
    const result: MapMarker[] = [];
    autoResult.plan.forEach((dp) => {
      const color = driverColorMap.get(dp.driverId) || "#10B981";
      dp.bookings.forEach((b) => {
        const booking = bookings.find((bk) => bk.id === b.id);
        if (booking?.latitude && booking?.longitude) {
          result.push({
            id: b.id,
            lat: booking.latitude,
            lng: booking.longitude,
            label: String(b.routeOrder),
            subtitle: b.customerName,
            color,
          });
        }
      });
    });
    return result;
  }, [autoMode, autoResult, bookings, driverColorMap]);

  return {
    autoMode,
    autoResult,
    autoApplying,
    partialFailedIds,
    setPartialFailedIds,
    showSlotConfig,
    setShowSlotConfig,
    driverSlotFilters,
    toggleDriverSlot,
    previewMapMarkers,
    handleAutoDispatch,
    handleAutoApply,
    handleAutoCancel,
    handleAutoReorder,
  };
}
