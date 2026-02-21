"use client";

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDuration, formatDistance } from "@/lib/kakao-directions";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import KakaoMap from "@/components/admin/KakaoMap";
import type { KakaoMapHandle, MapMarker, UnloadingMarker, RouteLine } from "@/components/admin/KakaoMap";
import type { Booking, BookingItem, UnloadingPoint } from "@/types/booking";
import type { AutoDispatchResult, DriverPlan } from "@/lib/optimizer/types";

/* ── 타입 ── */

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  vehicleType: string;
  vehicleCapacity: number;
  licensePlate: string | null;
}

interface DriverStats {
  driverId: string;
  driverName: string;
  vehicleType: string;
  vehicleCapacity: number;
  licensePlate: string | null;
  assignedCount: number;
  totalLoadingCube: number;
}

/* ── 상수 ── */

const STATUS_LABELS: Record<string, string> = {
  pending: "접수",
  confirmed: "확정",
  quote_confirmed: "견적확정",
  in_progress: "진행중",
  completed: "수거완료",
  payment_requested: "정산요청",
  payment_completed: "정산완료",
  cancelled: "취소",
  rejected: "수거불가",
};

const SLOT_ORDER = ["10:00", "12:00", "14:00", "15:00"];

const SLOT_LABELS: Record<string, string> = {
  "10:00": "10~12시",
  "12:00": "12~14시",
  "14:00": "14~16시",
  "15:00": "15~17시",
};

const UNASSIGNED_COLOR = "#3B82F6";
const DRIVER_COLORS = [
  "#10B981", "#F97316", "#8B5CF6", "#EC4899", "#14B8A6",
  "#EAB308", "#06B6D4", "#F43F5E", "#84CC16", "#A855F7",
];

/* ── 유틸 ── */

function getToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function formatDateShort(dateStr: string): string {
  // KST 기준 명시적 파싱 (서버/클라이언트 시간대 차이 방어)
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const date = new Date(y, m - 1, d);
  return `${m}/${d} (${weekdays[date.getDay()]})`;
}

function getLoadingPercent(used: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((used / capacity) * 100));
}

function itemsSummary(items: BookingItem[] | undefined | null): string {
  if (!Array.isArray(items) || items.length === 0) return "-";
  const first = items[0];
  if (!first) return "-";
  const label = `${first.category || ""} ${first.name || ""}`.trim() || "품목";
  return items.length > 1 ? `${label} 외 ${items.length - 1}종` : label;
}

/* ── 메인 페이지 ── */

export default function AdminDispatchPage() {
  const router = useRouter();
  const mapRef = useRef<KakaoMapHandle>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(getToday());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverStats, setDriverStats] = useState<DriverStats[]>([]);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [filterDriverId, setFilterDriverId] = useState<string>("all");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [batchDriverId, setBatchDriverId] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // 하차지
  const [unloadingPoints, setUnloadingPoints] = useState<UnloadingPoint[]>([]);
  const [showUnloadingModal, setShowUnloadingModal] = useState(false);

  // 자동배차
  const [autoMode, setAutoMode] = useState<"idle" | "loading" | "preview">("idle");
  const [autoResult, setAutoResult] = useState<AutoDispatchResult | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);

  // 토스트 (alert 대체)
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "warning" } | null>(null);

  function showToast(msg: string, type: "success" | "error" | "warning" = "error") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }

  // 모바일 탭 (지도 / 목록)
  const [mobileTab, setMobileTab] = useState<"map" | "list">("list");
  // 모바일 상세 바텀시트
  const [mobileDetail, setMobileDetail] = useState(false);
  // 기사 적재 현황 패널 (지도 우측 상단)
  const [driverPanelOpen, setDriverPanelOpen] = useState(true);

  // 기사별 색상 매핑
  const driverColorMap = useMemo(() => {
    const map = new Map<string, string>();
    drivers.forEach((d, idx) => {
      map.set(d.id, DRIVER_COLORS[idx % DRIVER_COLORS.length]);
    });
    return map;
  }, [drivers]);

  // 인증
  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) {
      sessionStorage.setItem("admin_return_url", window.location.pathname);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  // 토스트 타이머 cleanup (unmount 시 메모리 릭 방지)
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // 데이터 로드 (AbortController로 race condition 방어)
  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    const silent = opts?.silent ?? false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) {
      setLoading(true);
      setFetchError(false);
    }
    try {
      const res = await fetch(`/api/admin/dispatch?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        router.push("/admin");
        return;
      }
      if (!res.ok) {
        if (!silent) setFetchError(true);
        return;
      }
      const data = await res.json();
      if (controller.signal.aborted) return;
      setBookings(data.bookings || []);
      setDrivers(data.drivers || []);
      setDriverStats(data.driverStats || []);
      if (!silent) {
        setCheckedIds(new Set());
        setSelectedBookingId(null);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError" && !silent) {
        setFetchError(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, selectedDate, router]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // 하차지 조회
  const fetchUnloadingPoints = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/unloading-points", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnloadingPoints(data.points || []);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchUnloadingPoints();
  }, [fetchUnloadingPoints]);

  // 자동배차 실행 (미리보기)
  const handleAutoDispatch = useCallback(async () => {
    if (!token || autoMode === "loading") return;
    setAutoMode("loading");
    try {
      const res = await fetch("/api/admin/dispatch-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate }),
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
  }, [token, selectedDate, autoMode]);

  // 자동배차 적용
  const handleAutoApply = useCallback(async () => {
    if (!token || !autoResult || autoApplying) return;
    setAutoApplying(true);
    try {
      const res = await fetch("/api/admin/dispatch-auto", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: autoResult.plan }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.partialFailure) {
          showToast(`${data.updated?.length || 0}건 성공, ${data.failed?.length || 0}건 실패`, "warning");
        } else {
          showToast(`${data.updated?.length || 0}건 배차 적용 완료`, "success");
        }
        setAutoMode("idle");
        setAutoResult(null);
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
  }, [token, autoResult, autoApplying, fetchData]);

  // 자동배차 취소
  const handleAutoCancel = useCallback(() => {
    setAutoMode("idle");
    setAutoResult(null);
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

  // 활성 예약 (취소/거부 제외)
  const activeBookings = useMemo(() => {
    return bookings.filter((b) => b.status !== "cancelled" && b.status !== "rejected");
  }, [bookings]);

  // 필터링된 예약
  const filteredBookings = useMemo(() => {
    return activeBookings.filter((b) => {
      if (filterDriverId === "unassigned") return !b.driverId;
      if (filterDriverId !== "all") return b.driverId === filterDriverId;
      return true;
    });
  }, [activeBookings, filterDriverId]);

  // 시간대별 그룹핑
  const groupedBySlot = useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    for (const slot of SLOT_ORDER) {
      groups[slot] = [];
    }
    groups["기타"] = [];

    for (const b of filteredBookings) {
      const slot = b.timeSlot && SLOT_ORDER.includes(b.timeSlot) ? b.timeSlot : "기타";
      groups[slot].push(b);
    }

    return Object.entries(groups).filter(([, bs]) => bs.length > 0);
  }, [filteredBookings]);

  // 마커 색상 결정
  const getMarkerColor = useCallback((booking: Booking): string => {
    if (!booking.driverId) return UNASSIGNED_COLOR;
    return driverColorMap.get(booking.driverId) || "#10B981";
  }, [driverColorMap]);

  // 좌표 있는 예약만 마커로 (subtitle에 고객명 표시)
  const mapMarkers: MapMarker[] = useMemo(() => {
    return filteredBookings
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b, idx) => ({
        id: b.id,
        lat: b.latitude!,
        lng: b.longitude!,
        label: String(idx + 1),
        subtitle: b.customerName || "",
        color: getMarkerColor(b),
      }));
  }, [filteredBookings, getMarkerColor]);

  // 미배차 수
  const unassignedCount = useMemo(() => {
    return activeBookings.filter((b) => !b.driverId).length;
  }, [activeBookings]);

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

  // 하차지 마커 (자동배차 미리보기 시에만 표시)
  const unloadingMapMarkers: UnloadingMarker[] = useMemo(() => {
    if (autoMode !== "preview" || !autoResult) return [];
    const pointIds = new Set<string>();
    autoResult.plan.forEach((dp) => {
      dp.unloadingStops.forEach((s) => pointIds.add(s.pointId));
    });
    return unloadingPoints
      .filter((p) => pointIds.has(p.id))
      .map((p) => ({ id: p.id, lat: p.latitude, lng: p.longitude, name: p.name }));
  }, [autoMode, autoResult, unloadingPoints]);

  // 경로 폴리라인 (자동배차 미리보기 시)
  const mapRouteLines: RouteLine[] = useMemo(() => {
    if (autoMode !== "preview" || !autoResult) return [];
    return autoResult.plan.map((dp) => {
      const color = driverColorMap.get(dp.driverId) || "#10B981";
      const points: { lat: number; lng: number }[] = [];
      dp.bookings.forEach((b) => {
        const booking = bookings.find((bk) => bk.id === b.id);
        if (booking?.latitude && booking?.longitude) {
          points.push({ lat: booking.latitude, lng: booking.longitude });
        }
      });
      return { driverId: dp.driverId, color, points };
    });
  }, [autoMode, autoResult, bookings, driverColorMap]);

  // 선택된 예약
  const selectedBooking = useMemo(() => {
    return bookings.find((b) => b.id === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  // 마커 클릭 → 카드 스크롤 + 선택 (useCallback으로 안정화 — KakaoMap 불필요 리렌더 방지)
  const handleMarkerClick = useCallback((id: string) => {
    setSelectedBookingId(id);
    setMobileDetail(true);
    const cardEl = cardRefs.current.get(id);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // 카드 클릭 → 지도 panTo + 선택
  const handleCardClick = useCallback((booking: Booking) => {
    setSelectedBookingId(booking.id);
    if (booking.latitude && booking.longitude) {
      mapRef.current?.panTo(booking.latitude, booking.longitude);
    }
  }, []);

  // 체크박스 토글
  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 전체 선택 (미배차만)
  function toggleAllUnassigned() {
    const unassigned = filteredBookings.filter((b) => !b.driverId);
    const allChecked = unassigned.every((b) => checkedIds.has(b.id));
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(unassigned.map((b) => b.id)));
    }
  }

  // 단건 배차 (옵티미스틱 업데이트)
  async function handleDispatch(bookingId: string, driverId: string) {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver || !token || dispatching) return;

    // 옵티미스틱: 로컬 상태 즉시 반영
    const prevBooking = bookings.find((b) => b.id === bookingId);
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, driverId: driver.id, driverName: driver.name } : b,
      ),
    );
    setDriverStats((prev) =>
      prev.map((stat) => {
        const cube = prevBooking?.totalLoadingCube || 0;
        if (stat.driverId === driver.id) {
          return { ...stat, assignedCount: stat.assignedCount + 1, totalLoadingCube: stat.totalLoadingCube + cube };
        }
        if (prevBooking?.driverId && stat.driverId === prevBooking.driverId) {
          return { ...stat, assignedCount: Math.max(0, stat.assignedCount - 1), totalLoadingCube: Math.max(0, stat.totalLoadingCube - cube) };
        }
        return stat;
      }),
    );

    setDispatching(true);
    try {
      const res = await fetch(`/api/admin/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingIds: [bookingId],
          driverId: driver.id,
          driverName: driver.name,
        }),
      });
      if (res.ok) {
        fetchData({ silent: true });
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "배차 실패");
        fetchData(); // 롤백
      }
    } catch {
      showToast("네트워크 오류");
      fetchData();
    } finally {
      setDispatching(false);
    }
  }

  // 일괄 배차 (옵티미스틱 업데이트)
  async function handleBatchDispatch() {
    const driver = drivers.find((d) => d.id === batchDriverId);
    if (!driver || !token || checkedIds.size === 0 || dispatching) return;

    const targetIds = Array.from(checkedIds).filter((id) =>
      filteredBookings.some((b) => b.id === id),
    );

    // 옵티미스틱: 로컬 상태 즉시 반영 (재배차 시 기존 기사 차감 포함)
    const targetBookings = targetIds.map((id) => bookings.find((bk) => bk.id === id)).filter(Boolean) as Booking[];
    const prevDriverDeltas = new Map<string, { count: number; cube: number }>();
    // 신규 기사로 실제 이동하는 건만 카운트 (이미 해당 기사 담당인 건 제외 → 중복 카운트 방지)
    const newToDriverBookings = targetBookings.filter((b) => b.driverId !== driver.id);
    const newToDriverCount = newToDriverBookings.length;
    const newToDriverCube = newToDriverBookings.reduce((sum, b) => sum + (b.totalLoadingCube || 0), 0);
    targetBookings.forEach((b) => {
      const cube = b.totalLoadingCube || 0;
      if (b.driverId && b.driverId !== driver.id) {
        const prev = prevDriverDeltas.get(b.driverId) || { count: 0, cube: 0 };
        prevDriverDeltas.set(b.driverId, { count: prev.count + 1, cube: prev.cube + cube });
      }
    });
    setBookings((prev) =>
      prev.map((b) =>
        targetIds.includes(b.id) ? { ...b, driverId: driver.id, driverName: driver.name } : b,
      ),
    );
    setDriverStats((prev) =>
      prev.map((stat) => {
        if (stat.driverId === driver.id) {
          return { ...stat, assignedCount: stat.assignedCount + newToDriverCount, totalLoadingCube: stat.totalLoadingCube + newToDriverCube };
        }
        const delta = prevDriverDeltas.get(stat.driverId);
        if (delta) {
          return { ...stat, assignedCount: Math.max(0, stat.assignedCount - delta.count), totalLoadingCube: Math.max(0, stat.totalLoadingCube - delta.cube) };
        }
        return stat;
      }),
    );
    setCheckedIds(new Set());
    setBatchDriverId("");

    setDispatching(true);
    try {
      const res = await fetch(`/api/admin/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingIds: targetIds,
          driverId: driver.id,
          driverName: driver.name,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.partialFailure) {
          showToast(`${data.updated?.length || 0}건 성공, ${data.failed?.length || 0}건 실패`, "warning");
        } else {
          showToast(`${targetIds.length}건 배차 완료`, "success");
        }
        fetchData({ silent: true });
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "배차 실패");
        fetchData(); // 롤백
      }
    } catch {
      showToast("네트워크 오류");
      fetchData();
    } finally {
      setDispatching(false);
    }
  }

  // 배차 해제 (옵티미스틱 업데이트) — confirm()은 BookingCard 인라인 확인으로 대체
  async function handleUnassign(bookingId: string) {
    if (!token || dispatching) return;

    // 옵티미스틱: 로컬 상태 즉시 반영
    const target = bookings.find((b) => b.id === bookingId);
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, driverId: null, driverName: null } : b,
      ),
    );
    if (target?.driverId) {
      setDriverStats((prev) =>
        prev.map((stat) =>
          stat.driverId === target.driverId
            ? { ...stat, assignedCount: Math.max(0, stat.assignedCount - 1), totalLoadingCube: Math.max(0, stat.totalLoadingCube - (target.totalLoadingCube || 0)) }
            : stat,
        ),
      );
    }

    setDispatching(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ driverId: null, driverName: null }),
      });
      if (res.ok) {
        showToast("배차 해제 완료", "success");
        fetchData({ silent: true });
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "배차 해제 실패");
        fetchData(); // 롤백
      }
    } catch {
      showToast("네트워크 오류");
      fetchData();
    } finally {
      setDispatching(false);
    }
  }

  // 날짜 이동 (시간대 무관 순수 날짜 산술)
  function moveDate(delta: number) {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d + delta);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-bg-warm flex flex-col">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg pointer-events-none ${
            toast.type === "error"
              ? "bg-semantic-red text-white"
              : toast.type === "success"
                ? "bg-semantic-green text-white"
                : "bg-semantic-orange text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-20 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[100rem] mx-auto px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => router.push("/admin/calendar")}
              className="text-text-sub hover:text-text-primary transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <h1 className="text-lg font-bold">배차 관리</h1>

            {/* 날짜 선택 */}
            <div className="flex items-center gap-2">
              <button onClick={() => moveDate(-1)} className="p-1.5 rounded-md hover:bg-fill-tint text-text-sub">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg bg-bg"
              />
              <button onClick={() => moveDate(1)} className="p-1.5 rounded-md hover:bg-fill-tint text-text-sub">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
              <button
                onClick={() => setSelectedDate(getToday())}
                className="text-xs font-medium text-primary px-2 py-1 rounded-md hover:bg-primary-bg"
              >
                오늘
              </button>
            </div>
          </div>

          {/* 필터 + 범례 */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <select
              value={filterDriverId}
              onChange={(e) => { setFilterDriverId(e.target.value); setCheckedIds(new Set()); }}
              className="text-xs px-2 py-1.5 border border-border rounded-lg bg-bg"
              aria-label="기사 필터"
            >
              <option value="all">전체 ({activeBookings.length}건)</option>
              <option value="unassigned">미배차 ({unassignedCount}건)</option>
              {driverStats.map((stat) => (
                <option key={stat.driverId} value={stat.driverId}>
                  {stat.driverName} ({stat.assignedCount}건)
                </option>
              ))}
            </select>

            {/* 범례 + 가이드 */}
            <div className="ml-auto flex items-center gap-2 text-xs">
              {/* 색상 범례 */}
              <div className="flex items-center gap-2.5 text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: UNASSIGNED_COLOR }} />
                  미배차
                </span>
                {driverStats.map((stat) => (
                  <span key={stat.driverId} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: driverColorMap.get(stat.driverId) || "#10B981" }}
                    />
                    {stat.driverName}
                  </span>
                ))}
              </div>
              {/* 조작 가이드 */}
              <span className="hidden sm:inline-block text-[10px] text-text-muted border-l border-border-light pl-2">
                체크 선택 → 기사 지정 → 일괄 배차
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : fetchError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-text-muted">데이터를 불러오지 못했습니다</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary-bg transition-colors"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          {/* ── 모바일 탭 전환 ── */}
          <div className="lg:hidden flex border-b border-border-light bg-bg">
            <button
              onClick={() => { setMobileTab("list"); setMobileDetail(false); }}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                mobileTab === "list"
                  ? "text-primary border-b-2 border-primary"
                  : "text-text-muted"
              }`}
            >
              주문 목록
            </button>
            <button
              onClick={() => { setMobileTab("map"); setMobileDetail(false); }}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                mobileTab === "map"
                  ? "text-primary border-b-2 border-primary"
                  : "text-text-muted"
              }`}
            >
              지도
            </button>
          </div>

          {/* ── 데스크톱: 좌우 분할 / 모바일: 탭 전환 ── */}
          <div className="flex-1 flex min-h-0">
            {/* ── 왼쪽: 주문 리스트 패널 ── */}
            <div className={`lg:w-[400px] lg:flex-shrink-0 lg:border-r border-border-light bg-bg flex flex-col overflow-hidden ${
              mobileTab === "list" ? "flex" : "hidden lg:flex"
            }`}>
              {/* 요약 + 버튼 */}
              <div className="px-4 py-3 border-b border-border-light bg-bg-warm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-semibold">{formatDateShort(selectedDate)}</span>
                    <span className="text-text-muted ml-2">전체 {activeBookings.length}건</span>
                    {unassignedCount > 0 && (
                      <span className="ml-2" style={{ color: UNASSIGNED_COLOR }}>
                        미배차 {unassignedCount}건
                      </span>
                    )}
                  </div>
                  {autoMode === "idle" && unassignedCount > 0 && (
                    <button
                      onClick={toggleAllUnassigned}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      {filteredBookings.filter((b) => !b.driverId).every((b) => checkedIds.has(b.id))
                        ? "선택 해제"
                        : "미배차 전체 선택"
                      }
                    </button>
                  )}
                </div>
                {/* 자동배차 + 하차지 관리 버튼 */}
                {autoMode === "idle" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAutoDispatch}
                      disabled={unassignedCount === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary-dark transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1.75V12.25M1.75 7H12.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      자동배차
                    </button>
                    <button
                      onClick={() => setShowUnloadingModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-sub hover:bg-fill-tint transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 3.5V10.5M7 3.5L5.25 5.25M7 3.5L8.75 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="2.5" y="2" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                      하차지 관리
                    </button>
                  </div>
                )}
              </div>

              {/* 주문 목록 또는 자동배차 미리보기 */}
              <div className="flex-1 overflow-y-auto">
                {autoMode === "loading" ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
                    <LoadingSpinner size="md" />
                    <span className="text-sm text-text-muted">자동배차 계산 중...</span>
                  </div>
                ) : autoMode === "preview" && autoResult ? (
                  <AutoDispatchPreview
                    result={autoResult}
                    bookings={bookings}
                    driverColorMap={driverColorMap}
                    unloadingPoints={unloadingPoints}
                    applying={autoApplying}
                    onApply={handleAutoApply}
                    onCancel={handleAutoCancel}
                    onReorder={handleAutoReorder}
                  />
                ) : filteredBookings.length === 0 ? (
                  <div className="p-8 text-center text-sm text-text-muted">
                    해당 날짜에 주문이 없습니다
                  </div>
                ) : (
                  groupedBySlot.map(([slot, slotBookings]) => (
                    <div key={slot}>
                      <div className="sticky top-0 z-10 px-4 py-1.5 bg-bg-warm border-b border-border-light">
                        <span className="text-xs font-semibold text-text-sub">
                          {SLOT_LABELS[slot] || slot}
                        </span>
                        <span className="text-xs text-text-muted ml-1">({slotBookings.length}건)</span>
                      </div>
                      {slotBookings.map((b) => (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          isSelected={selectedBookingId === b.id}
                          isChecked={checkedIds.has(b.id)}
                          driverColor={b.driverId ? (driverColorMap.get(b.driverId) || "#10B981") : undefined}
                          driverStats={driverStats}
                          dispatching={dispatching}
                          onCheck={() => toggleCheck(b.id)}
                          onClick={() => handleCardClick(b)}
                          onDispatch={(dId) => handleDispatch(b.id, dId)}
                          onUnassign={() => handleUnassign(b.id)}
                          ref={(el) => {
                            if (el) cardRefs.current.set(b.id, el);
                            else cardRefs.current.delete(b.id);
                          }}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* 일괄 배차 바 */}
              {checkedIds.size > 0 && (
                <div className="border-t border-border-light bg-bg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">{checkedIds.size}건 선택</span>
                    <select
                      value={batchDriverId}
                      onChange={(e) => setBatchDriverId(e.target.value)}
                      className="flex-1 text-sm px-2 py-1.5 border border-border rounded-lg bg-bg"
                    >
                      <option value="">기사 선택</option>
                      {driverStats.map((stat) => {
                        const remaining = stat.vehicleCapacity - stat.totalLoadingCube;
                        return (
                          <option key={stat.driverId} value={stat.driverId}>
                            {stat.driverName} ({remaining.toFixed(1)}m&sup3; 여유)
                          </option>
                        );
                      })}
                    </select>
                    <button
                      onClick={handleBatchDispatch}
                      disabled={!batchDriverId || dispatching}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40 transition-colors hover:bg-primary-dark"
                    >
                      {dispatching ? "..." : "배차"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── 오른쪽: 지도 ── */}
            <div className={`flex-1 relative ${
              mobileTab === "map" ? "flex" : "hidden lg:flex"
            }`}>
              <KakaoMap
                ref={mapRef}
                markers={autoMode === "preview" ? previewMapMarkers : mapMarkers}
                unloadingMarkers={unloadingMapMarkers}
                routeLines={mapRouteLines}
                selectedMarkerId={selectedBookingId}
                onMarkerClick={handleMarkerClick}
                className="w-full h-full min-h-[400px]"
              />

              {/* 요약 오버레이 */}
              <div className="absolute top-4 left-4 bg-bg/90 backdrop-blur-sm rounded-lg border border-border-light px-3 py-2 text-xs space-y-0.5 pointer-events-none">
                <div className="font-semibold">{formatDateShort(selectedDate)}</div>
                <div>전체 {activeBookings.length}건</div>
                <div style={{ color: UNASSIGNED_COLOR }}>미배차 {unassignedCount}건</div>
              </div>

              {/* 기사 적재 현황 오버레이 — 우측 상단 */}
              {driverStats.length > 0 && (
                <div className="hidden lg:block absolute top-4 right-4 z-10">
                  {driverPanelOpen ? (
                    <div className="w-[220px] bg-bg/95 backdrop-blur-sm rounded-lg border border-border-light shadow-md overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border-light">
                        <span className="text-xs font-semibold text-text-sub">기사 적재 현황</span>
                        <button
                          onClick={() => setDriverPanelOpen(false)}
                          className="p-0.5 text-text-muted hover:text-text-primary"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                      <div className="p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                        {driverStats.map((stat) => {
                          const pct = getLoadingPercent(stat.totalLoadingCube, stat.vehicleCapacity);
                          const isOver = stat.totalLoadingCube > stat.vehicleCapacity;
                          const color = driverColorMap.get(stat.driverId) || "#10B981";
                          return (
                            <button
                              key={stat.driverId}
                              onClick={() => setFilterDriverId(filterDriverId === stat.driverId ? "all" : stat.driverId)}
                              className={`w-full p-2 rounded-md border transition-all text-left ${
                                filterDriverId === stat.driverId
                                  ? "border-primary bg-primary-bg"
                                  : "border-transparent hover:bg-fill-tint"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                <span className="text-xs font-semibold truncate">{stat.driverName}</span>
                                <span className="text-[10px] text-text-muted">{stat.vehicleType}</span>
                                <span className="ml-auto text-[10px] text-text-muted">{stat.assignedCount}건</span>
                              </div>
                              <div className="h-1.5 bg-fill-tint rounded-full overflow-hidden mb-0.5">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, pct)}%`,
                                    background: isOver ? "#EF4444" : pct > 80 ? "#F97316" : color,
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={isOver ? "text-semantic-red font-semibold" : "text-text-muted"}>
                                  {stat.totalLoadingCube.toFixed(1)}/{stat.vehicleCapacity}m&sup3;
                                </span>
                                {isOver && <span className="text-semantic-red font-medium">초과</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDriverPanelOpen(true)}
                      className="bg-bg/95 backdrop-blur-sm rounded-lg border border-border-light shadow-md px-3 py-2 text-xs font-semibold text-text-sub hover:bg-fill-tint transition-colors flex items-center gap-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="2" y="3" width="10" height="1.5" rx="0.75" fill="currentColor"/>
                        <rect x="2" y="6.25" width="7" height="1.5" rx="0.75" fill="currentColor"/>
                        <rect x="2" y="9.5" width="4" height="1.5" rx="0.75" fill="currentColor"/>
                      </svg>
                      기사 현황
                    </button>
                  )}
                </div>
              )}

              {/* 지도 위 선택된 주문 오버레이 — 데스크톱 */}
              {selectedBooking && (
                <div className="hidden lg:block absolute bottom-4 right-4 w-[320px] bg-bg rounded-xl border border-border-light shadow-lg overflow-hidden">
                  <OverlayCard
                    booking={selectedBooking}
                    driverColor={selectedBooking.driverId ? driverColorMap.get(selectedBooking.driverId) : undefined}
                    driverStats={driverStats}
                    dispatching={dispatching}
                    onDispatch={(dId) => handleDispatch(selectedBooking.id, dId)}
                    onUnassign={() => handleUnassign(selectedBooking.id)}
                    onDetail={() => router.push(`/admin/bookings/${selectedBooking.id}`)}
                    onClose={() => setSelectedBookingId(null)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── 하차지 관리 모달 ── */}
          {showUnloadingModal && (
            <UnloadingModal
              token={token}
              points={unloadingPoints}
              onClose={() => setShowUnloadingModal(false)}
              onRefresh={fetchUnloadingPoints}
              onToast={showToast}
            />
          )}

          {/* ── 모바일 바텀시트 ── */}
          {mobileDetail && selectedBooking && (
            <div
              className="lg:hidden fixed inset-0 z-30"
              role="dialog"
              aria-modal="true"
              aria-label="주문 상세"
              onKeyDown={(e) => { if (e.key === "Escape") setMobileDetail(false); }}
            >
              <div className="absolute inset-0 bg-black/30" onClick={() => setMobileDetail(false)} />
              <div className="absolute bottom-0 left-0 right-0 bg-bg rounded-t-2xl max-h-[75vh] overflow-y-auto animate-slide-up">
                <div className="w-12 h-1 bg-fill-tint rounded-full mx-auto mt-2 mb-1" />
                <OverlayCard
                  booking={selectedBooking}
                  driverColor={selectedBooking.driverId ? driverColorMap.get(selectedBooking.driverId) : undefined}
                  driverStats={driverStats}
                  dispatching={dispatching}
                  onDispatch={(dId) => handleDispatch(selectedBooking.id, dId)}
                  onUnassign={() => handleUnassign(selectedBooking.id)}
                  onDetail={() => router.push(`/admin/bookings/${selectedBooking.id}`)}
                  onClose={() => setMobileDetail(false)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── 주문 카드 (리스트용) ── */

interface BookingCardProps {
  booking: Booking;
  isSelected: boolean;
  isChecked: boolean;
  driverColor?: string;
  driverStats: DriverStats[];
  dispatching: boolean;
  onCheck: () => void;
  onClick: () => void;
  onDispatch: (driverId: string) => void;
  onUnassign: () => void;
}

const BookingCard = forwardRef<HTMLDivElement, BookingCardProps>(function BookingCard(
  { booking, isSelected, isChecked, driverColor, driverStats, dispatching, onCheck, onClick, onDispatch, onUnassign },
  ref,
) {
  const cube = (booking.totalLoadingCube || 0).toFixed(1);
  // 배차 해제 인라인 확인 (confirm() 대체)
  const [unassignConfirm, setUnassignConfirm] = useState(false);

  return (
    <div
      ref={ref}
      className={`px-4 py-2.5 border-b border-border-light cursor-pointer transition-colors ${
        isSelected ? "bg-primary-bg" : "hover:bg-bg-warm"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* 체크박스 (미배차만) */}
        {!booking.driverId && (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => { e.stopPropagation(); onCheck(); }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded border-border accent-primary flex-shrink-0"
          />
        )}
        {/* 기사 색상 도트 (배차된 경우) */}
        {booking.driverId && driverColor && (
          <span
            className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: driverColor }}
          />
        )}

        <div className="flex-1 min-w-0">
          {/* 1줄: 시간 + 고객명 + 상태 */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded"
              style={{ background: booking.driverId ? (driverColor || "#10B981") : UNASSIGNED_COLOR }}>
              {SLOT_LABELS[booking.timeSlot] || booking.timeSlot}
            </span>
            <span className="text-sm font-semibold truncate">{booking.customerName}</span>
            {booking.driverId && booking.driverName && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded ml-auto flex-shrink-0"
                style={{ background: `${driverColor || "#10B981"}18`, color: driverColor || "#10B981" }}>
                {booking.driverName}
              </span>
            )}
          </div>

          {/* 2줄: 주소 */}
          <div className="text-xs text-text-muted truncate mb-0.5">
            {booking.address || "-"}
          </div>

          {/* 3줄: 품목 + 큐브 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-sub truncate">
              {itemsSummary(Array.isArray(booking.items) ? booking.items : [])}
            </span>
            <span className="text-xs font-semibold text-primary flex-shrink-0">
              {cube}m&sup3;
            </span>
          </div>
        </div>

        {/* 빠른 배차 드롭다운 (미배차) */}
        {!booking.driverId && (
          <select
            className="text-xs px-1.5 py-1 border border-border rounded bg-bg flex-shrink-0 mt-1"
            value=""
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.value) onDispatch(e.target.value);
            }}
          >
            <option value="">배차</option>
            {driverStats.map((stat) => {
              const remaining = stat.vehicleCapacity - stat.totalLoadingCube;
              return (
                <option key={stat.driverId} value={stat.driverId}>
                  {stat.driverName} ({remaining.toFixed(1)}m&sup3;)
                </option>
              );
            })}
          </select>
        )}
        {/* 배차 해제 — 인라인 확인 (confirm() 대체) */}
        {booking.driverId && (
          unassignConfirm ? (
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setUnassignConfirm(false); onUnassign(); }}
                disabled={dispatching}
                className="text-[11px] font-semibold text-white bg-semantic-red px-2 py-1 rounded-md transition-colors"
              >
                해제
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setUnassignConfirm(false); }}
                className="text-[11px] text-text-muted px-1.5 py-1 hover:text-text-primary"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setUnassignConfirm(true); }}
              disabled={dispatching}
              className="flex items-center gap-0.5 text-[11px] font-medium text-semantic-red bg-semantic-red-tint px-2 py-1 rounded-md hover:bg-semantic-red/10 transition-colors flex-shrink-0 mt-0.5"
              title="배차 해제"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              해제
            </button>
          )
        )}
      </div>
    </div>
  );
});

/* ── 오버레이 카드 (지도 위 + 모바일 바텀시트) ── */

function OverlayCard({
  booking,
  driverColor,
  driverStats,
  dispatching,
  onDispatch,
  onUnassign,
  onDetail,
  onClose,
}: {
  booking: Booking;
  driverColor?: string;
  driverStats: DriverStats[];
  dispatching: boolean;
  onDispatch: (driverId: string) => void;
  onUnassign: () => void;
  onDetail: () => void;
  onClose: () => void;
}) {
  const [selectedDriverId, setSelectedDriverId] = useState(booking.driverId ?? "");
  // 배차 해제 인라인 확인 (confirm() 대체)
  const [unassignConfirm, setUnassignConfirm] = useState(false);

  useEffect(() => {
    setSelectedDriverId(booking.driverId ?? "");
    setUnassignConfirm(false); // 예약 변경 시 확인 상태 초기화
  }, [booking.id, booking.driverId]);

  const cube = (booking.totalLoadingCube ?? 0).toFixed(1);

  return (
    <div className="p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">{booking.customerName}</h3>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            booking.status === "pending" ? "bg-semantic-orange-tint text-semantic-orange"
            : booking.status === "in_progress" ? "bg-primary-tint text-primary"
            : "bg-semantic-green-tint text-semantic-green"
          }`}>
            {STATUS_LABELS[booking.status] || booking.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDetail}
            className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-fill-tint"
          >
            상세
          </button>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* 주문 정보 */}
      <div className="space-y-1.5 text-sm">
        {booking.phone && (
          <div className="flex items-center gap-2">
            <a href={`tel:${booking.phone}`} className="text-xs text-primary">{booking.phone}</a>
          </div>
        )}
        <div className="text-xs text-text-muted">
          {booking.address || ""} {booking.addressDetail || ""}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span>{SLOT_LABELS[booking.timeSlot] || booking.timeSlot || "-"}</span>
          <span className="font-semibold text-primary">{cube}m&sup3;</span>
          <span className="text-text-muted">
            엘베 {booking.hasElevator ? "O" : "X"} / 주차 {booking.hasParking ? "O" : "X"}
          </span>
        </div>

        {/* 품목 */}
        {Array.isArray(booking.items) && booking.items.length > 0 && (
          <div className="bg-bg-warm rounded-lg p-2 space-y-0.5">
            {booking.items.map((item: BookingItem, idx: number) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-text-sub">
                  {item?.category || ""} {item?.name || ""} x{item?.quantity ?? 0}
                </span>
                <span className="text-text-muted">
                  {((item?.loadingCube ?? 0) * (item?.quantity ?? 0)).toFixed(1)}m&sup3;
                </span>
              </div>
            ))}
          </div>
        )}

        {booking.memo && (
          <div className="text-xs text-text-muted">
            <span className="font-medium">요청: </span>{booking.memo}
          </div>
        )}
      </div>

      {/* 배차 */}
      <div className="border-t border-border-light pt-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="flex-1 text-sm px-2 py-1.5 border border-border rounded-lg bg-bg"
          >
            <option value="">기사 선택</option>
            {driverStats.map((stat) => {
              const remaining = stat.vehicleCapacity - stat.totalLoadingCube;
              return (
                <option key={stat.driverId} value={stat.driverId}>
                  {stat.driverName} {stat.vehicleType} ({remaining.toFixed(1)}m&sup3; 여유)
                </option>
              );
            })}
          </select>
          <button
            onClick={() => {
              if (selectedDriverId) onDispatch(selectedDriverId);
            }}
            disabled={!selectedDriverId || dispatching || selectedDriverId === booking.driverId}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40 transition-colors hover:bg-primary-dark"
          >
            {dispatching ? "..." : "배차"}
          </button>
          {booking.driverId && (
            unassignConfirm ? (
              <>
                <button
                  onClick={() => { setUnassignConfirm(false); onUnassign(); }}
                  disabled={dispatching}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-semantic-red text-white transition-colors disabled:opacity-40"
                >
                  해제 확인
                </button>
                <button
                  onClick={() => setUnassignConfirm(false)}
                  className="px-2 py-1.5 rounded-lg text-sm text-text-muted hover:text-text-primary"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                onClick={() => setUnassignConfirm(true)}
                disabled={dispatching}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-semantic-red/30 text-semantic-red hover:bg-semantic-red-tint transition-colors disabled:opacity-40"
              >
                해제
              </button>
            )
          )}
        </div>
        {booking.driverId && booking.driverName && (
          <div className="mt-1.5 text-xs text-text-muted flex items-center gap-1.5">
            {driverColor && (
              <span className="w-2 h-2 rounded-full" style={{ background: driverColor }} />
            )}
            현재: {booking.driverName}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 자동배차 미리보기 ── */

/** 드래그 핸들 아이콘 */
function DragHandle({ listeners, attributes }: { listeners?: SyntheticListenerMap; attributes?: DraggableAttributes }) {
  return (
    <button
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing p-0.5 text-text-muted hover:text-text-primary touch-none flex-shrink-0"
      title="순서 변경"
      tabIndex={-1}
    >
      <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
        <circle cx="4" cy="3" r="1.2" fill="currentColor"/>
        <circle cx="8" cy="3" r="1.2" fill="currentColor"/>
        <circle cx="4" cy="7" r="1.2" fill="currentColor"/>
        <circle cx="8" cy="7" r="1.2" fill="currentColor"/>
        <circle cx="4" cy="11" r="1.2" fill="currentColor"/>
        <circle cx="8" cy="11" r="1.2" fill="currentColor"/>
      </svg>
    </button>
  );
}

/** 드래그 가능한 배차 행 */
function SortableBookingRow({
  booking,
  color,
  stopAfterThis,
}: {
  booking: DriverPlan["bookings"][number];
  color: string;
  stopAfterThis?: { pointName: string } | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: booking.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <div className="flex items-center gap-2 py-1">
        <DragHandle listeners={listeners} attributes={attributes} />
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: color }}
        >
          {booking.routeOrder}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{booking.customerName}</div>
          <div className="text-[10px] text-text-muted truncate">{booking.address}</div>
        </div>
        <span className="text-[10px] font-semibold text-primary flex-shrink-0">
          {booking.loadCube.toFixed(1)}m³
        </span>
      </div>
      {/* 하차지 삽입 표시 */}
      {stopAfterThis && (
        <div className="flex items-center gap-2 py-1.5 pl-2">
          <div className="flex-1 border-t border-dashed border-purple-300" />
          <span className="text-[10px] font-bold text-purple-600 whitespace-nowrap px-1">
            ◆ {stopAfterThis.pointName}
          </span>
          <div className="flex-1 border-t border-dashed border-purple-300" />
        </div>
      )}
    </div>
  );
}

function AutoDispatchPreview({
  result,
  bookings,
  driverColorMap,
  unloadingPoints,
  applying,
  onApply,
  onCancel,
  onReorder,
}: {
  result: AutoDispatchResult;
  bookings: Booking[];
  driverColorMap: Map<string, string>;
  unloadingPoints: UnloadingPoint[];
  applying: boolean;
  onApply: () => void;
  onCancel: () => void;
  onReorder: (driverId: string, newIds: string[]) => void;
}) {
  // 포인터 + 터치 센서 (모바일 지원)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragEnd(driverId: string, event: DragEndEvent, driverBookings: DriverPlan["bookings"]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = driverBookings.findIndex((b) => b.id === active.id);
    const newIndex = driverBookings.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(driverBookings, oldIndex, newIndex);
    onReorder(driverId, newOrder.map((b) => b.id));
  }

  return (
    <div className="flex flex-col h-full">
      {/* 상단 요약 */}
      <div className="px-4 py-3 bg-primary-bg border-b border-primary/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-primary">자동배차 제안</span>
          <span className="text-xs text-text-muted">
            {result.stats.assigned}건 배차 / 총 거리 {result.stats.totalDistance}km
          </span>
        </div>
        {result.unassigned.length > 0 && (
          <div className="text-xs text-semantic-orange">
            미배차 {result.unassigned.length}건 (용량 부족/좌표 없음)
          </div>
        )}
      </div>

      {/* 기사별 플랜 목록 */}
      <div className="flex-1 overflow-y-auto">
        {result.plan.map((dp) => {
          const color = driverColorMap.get(dp.driverId) || "#10B981";
          return (
            <div key={dp.driverId} className="border-b border-border-light">
              <div className="px-4 py-2 bg-bg-warm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs font-bold">{dp.driverName}</span>
                <span className="text-[10px] text-text-muted">{dp.vehicleType}</span>
                <span className="ml-auto text-[10px] text-text-muted">
                  {dp.bookings.length}건 · {dp.totalLoad.toFixed(1)}/{dp.vehicleCapacity}m³ · {dp.totalDistance.toFixed(1)}km
                  {dp.estimatedDuration != null && (
                    <span className="ml-1 text-[10px] font-medium text-primary">
                      · 약 {formatDuration(dp.estimatedDuration)} {dp.estimatedDistance != null ? `· ${formatDistance(dp.estimatedDistance)}` : ""}
                    </span>
                  )}
                </span>
              </div>
              <div className="px-4 py-1.5">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(dp.driverId, e, dp.bookings)}
                >
                  <SortableContext
                    items={dp.bookings.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {dp.bookings.map((b) => {
                      const stopAfterThis = dp.unloadingStops.find(
                        (s) => s.afterRouteOrder === b.routeOrder,
                      );
                      return (
                        <SortableBookingRow
                          key={b.id}
                          booking={b}
                          color={color}
                          stopAfterThis={stopAfterThis}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>
              {/* 레그별 적재 현황 바 */}
              {dp.legs > 1 && (
                <div className="px-4 pb-2">
                  <LegLoadBars driverPlan={dp} color={color} />
                </div>
              )}
            </div>
          );
        })}

        {/* 미배차 */}
        {result.unassigned.length > 0 && (
          <div className="border-b border-border-light">
            <div className="px-4 py-2 bg-semantic-orange-tint/50">
              <span className="text-xs font-bold text-semantic-orange">미배차 {result.unassigned.length}건</span>
            </div>
            <div className="px-4 py-1.5 space-y-1">
              {result.unassigned.map((u) => {
                const booking = bookings.find((b) => b.id === u.id);
                return (
                  <div key={u.id} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="text-text-sub truncate flex-1">
                      {booking?.customerName || u.id} · {booking?.address || ""}
                    </span>
                    <span className="text-text-muted flex-shrink-0">{u.reason}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 하단 액션 바 */}
      <div className="border-t border-border-light px-4 py-3 flex items-center gap-2 bg-bg">
        <button
          onClick={onCancel}
          disabled={applying}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-border text-text-sub hover:bg-fill-tint transition-colors disabled:opacity-40"
        >
          취소
        </button>
        <button
          onClick={onApply}
          disabled={applying || result.plan.length === 0}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
        >
          {applying ? "적용 중..." : `${result.stats.assigned}건 배차 적용`}
        </button>
      </div>
    </div>
  );
}

/* ── 레그별 적재량 바 ── */

function LegLoadBars({ driverPlan, color }: { driverPlan: DriverPlan; color: string }) {
  // 하차지를 기준으로 레그 분할
  const legs: { bookings: typeof driverPlan.bookings; load: number }[] = [];
  let currentLeg: typeof driverPlan.bookings = [];
  let currentLoad = 0;
  const stopOrders = new Set(driverPlan.unloadingStops.map((s) => s.afterRouteOrder));

  for (const b of driverPlan.bookings) {
    currentLeg.push(b);
    currentLoad += b.loadCube;
    if (stopOrders.has(b.routeOrder)) {
      legs.push({ bookings: currentLeg, load: currentLoad });
      currentLeg = [];
      currentLoad = 0;
    }
  }
  if (currentLeg.length > 0) {
    legs.push({ bookings: currentLeg, load: currentLoad });
  }

  const cap = driverPlan.vehicleCapacity;

  return (
    <div className="space-y-1">
      {legs.map((leg, i) => {
        const pct = cap > 0 ? Math.min(100, Math.round((leg.load / cap) * 100)) : 0;
        const isOver = leg.load > cap;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted w-8">{i + 1}차</span>
            <div className="flex-1 h-1.5 bg-fill-tint rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, pct)}%`, background: isOver ? "#EF4444" : color }}
              />
            </div>
            <span className={`text-[10px] ${isOver ? "text-semantic-red font-semibold" : "text-text-muted"}`}>
              {leg.load.toFixed(1)}/{cap}m³
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── 하차지 관리 모달 ── */

function UnloadingModal({
  token,
  points,
  onClose,
  onRefresh,
  onToast,
}: {
  token: string;
  points: UnloadingPoint[];
  onClose: () => void;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
}) {
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 삭제 인라인 확인 (confirm() 대체)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim() || !newAddress.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/unloading-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), address: newAddress.trim() }),
      });
      if (res.ok) {
        setNewName("");
        setNewAddress("");
        onToast("하차지가 추가되었습니다", "success");
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error || "생성 실패");
      }
    } catch {
      onToast("네트워크 오류");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/unloading-points", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        onToast("삭제 완료", "success");
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error || "삭제 실패");
      }
    } catch {
      onToast("네트워크 오류");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(point: UnloadingPoint) {
    try {
      const res = await fetch("/api/admin/unloading-points", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: point.id, active: !point.active }),
      });
      if (res.ok) {
        onToast(point.active ? "비활성화되었습니다" : "활성화되었습니다", "success");
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error || "변경 실패");
      }
    } catch {
      onToast("네트워크 오류");
    }
  }

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="하차지 관리"
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[90vw] max-h-[80vh] bg-bg rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
          <h2 className="text-base font-bold">하차지 관리</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {points.length === 0 ? (
            <div className="text-center text-sm text-text-muted py-8">
              등록된 하차지가 없습니다
            </div>
          ) : (
            points.map((p) => (
              <div
                key={p.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  p.active ? "border-border-light bg-bg" : "border-border-light bg-bg-warm opacity-60"
                }`}
              >
                <span className="mt-0.5 w-5 h-5 flex items-center justify-center text-purple-600 flex-shrink-0">◆</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-text-muted truncate">{p.address}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(p)}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      p.active ? "bg-semantic-green-tint text-semantic-green" : "bg-fill-tint text-text-muted"
                    }`}
                  >
                    {p.active ? "활성" : "비활성"}
                  </button>
                  {deleteConfirmId === p.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="text-[10px] font-semibold text-white bg-semantic-red px-2 py-0.5 rounded transition-colors"
                      >
                        삭제
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-[10px] text-text-muted px-1 py-0.5"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(p.id)}
                      disabled={deletingId === p.id}
                      className="text-xs text-semantic-red hover:bg-semantic-red-tint px-1.5 py-0.5 rounded transition-colors"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 추가 폼 */}
        <div className="border-t border-border-light px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="하차지 이름"
              className="w-24 text-sm px-2 py-1.5 border border-border rounded-lg bg-bg"
            />
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="주소 (도로명)"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              className="flex-1 text-sm px-2 py-1.5 border border-border rounded-lg bg-bg"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newAddress.trim()}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40 hover:bg-primary-dark transition-colors"
            >
              {creating ? "..." : "추가"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
