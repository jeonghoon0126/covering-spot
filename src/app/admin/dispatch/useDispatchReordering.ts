"use client";

import { useState, useCallback } from "react";
import {
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Booking } from "@/types/booking";

/* ── DnD 정렬 + 경로 최적화 전용 훅 ── */

interface UseDispatchReorderingParams {
  token: string;
  selectedDate: string;
  filterDriverId: string;
  filteredBookings: Booking[];
  showToast: (msg: string, type?: "success" | "error" | "warning") => void;
  fetchData: (opts?: { silent?: boolean }) => Promise<void>;
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
}

export interface UseDispatchReorderingReturn {
  sensors: ReturnType<typeof useSensors>;
  optimizingRoute: boolean;
  reordering: boolean;
  handleFlatListReorder: (event: DragEndEvent) => Promise<void>;
  handleOptimizeRoute: () => Promise<void>;
}

export function useDispatchReordering({
  token,
  selectedDate,
  filterDriverId,
  filteredBookings,
  showToast,
  fetchData,
  setBookings,
}: UseDispatchReorderingParams): UseDispatchReorderingReturn {
  const [optimizingRoute, setOptimizingRoute] = useState(false);
  const [reordering, setReordering] = useState(false);

  // flat list DnD 센서 (포인터 + 터치)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // 동선 최적화 (TSP) — 특정 기사의 배차된 주문 순서 자동 계산
  const handleOptimizeRoute = useCallback(async () => {
    if (!token || !filterDriverId || filterDriverId === "all" || filterDriverId === "unassigned" || optimizingRoute) return;
    setOptimizingRoute(true);
    try {
      const res = await fetch("/api/admin/dispatch-auto/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate, driverId: filterDriverId }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`동선 최적화 완료 (${data.updated}건)`, "success");
        fetchData({ silent: true });
      } else {
        showToast("동선 최적화 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setOptimizingRoute(false);
    }
  }, [token, filterDriverId, optimizingRoute, selectedDate, fetchData, showToast]);

  // flat list DnD 순서 변경 후 저장
  const handleFlatListReorder = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = filteredBookings.findIndex((b) => b.id === active.id);
    const newIdx = filteredBookings.findIndex((b) => b.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(filteredBookings, oldIdx, newIdx);
    const updates = reordered.map((b, idx) => ({ id: b.id, routeOrder: idx + 1 }));

    // 옵티미스틱 업데이트
    setBookings((prev) =>
      prev.map((b) => {
        const upd = updates.find((u) => u.id === b.id);
        return upd ? { ...b, routeOrder: upd.routeOrder } : b;
      }),
    );

    setReordering(true);
    try {
      const res = await fetch("/api/admin/bookings/route-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.failed && data.failed > 0)) {
        showToast(`순서 저장 실패${data.failed ? ` (${data.failed}건)` : ""}`);
        fetchData({ silent: true }); // 롤백
      }
    } catch {
      showToast("네트워크 오류");
      fetchData({ silent: true });
    } finally {
      setReordering(false);
    }
  }, [token, filteredBookings, fetchData, showToast, setBookings]);

  return {
    sensors,
    optimizingRoute,
    reordering,
    handleFlatListReorder,
    handleOptimizeRoute,
  };
}
