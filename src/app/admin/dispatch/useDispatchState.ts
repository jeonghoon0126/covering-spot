"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { safeSessionGet, safeSessionSet, safeSessionRemove } from "@/lib/storage";
import {
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { KakaoMapHandle, MapMarker, UnloadingMarker, RouteLine } from "@/components/admin/KakaoMap";
import type { Booking, UnloadingPoint } from "@/types/booking";
import type { AutoDispatchResult } from "@/lib/optimizer/types";
import {
  type Driver,
  type DriverStats,
  SLOT_ORDER,
  SLOT_MAX_PER_DRIVER,
  UNASSIGNED_COLOR,
  getDriverColor,
  getToday,
} from "./dispatch-utils";

/* ── 커스텀 훅: 배차 페이지 전체 상태 + 로직 ── */

export function useDispatchState() {
  const router = useRouter();
  const mapRef = useRef<KakaoMapHandle>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // filteredBookings 최신값 추적: scrollToNextUnassigned는 useCallback deps에 filteredBookings를
  // 포함하지 않아 stale closure 발생 → ref로 항상 최신값 참조 (컴포넌트 본문에서 동기 업데이트)
  const filteredBookingsRef = useRef<Booking[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(getToday());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverStats, setDriverStats] = useState<DriverStats[]>([]);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [filterDriverId, setFilterDriverId] = useState<string>("all");
  const [filterSlot, setFilterSlot] = useState<string>("all");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [batchDriverId, setBatchDriverId] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [optimizingRoute, setOptimizingRoute] = useState(false);
  const [reordering, setReordering] = useState(false);

  // 하차지
  const [unloadingPoints, setUnloadingPoints] = useState<UnloadingPoint[]>([]);
  const [showUnloadingModal, setShowUnloadingModal] = useState(false);

  // 자동배차
  const [autoMode, setAutoMode] = useState<"idle" | "loading" | "preview">("idle");
  const [autoResult, setAutoResult] = useState<AutoDispatchResult | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);
  const [partialFailedIds, setPartialFailedIds] = useState<string[]>([]);
  // 자동배차 고급 설정 — 기사별 시간대 제약
  const [showSlotConfig, setShowSlotConfig] = useState(false);
  const [driverSlotFilters, setDriverSlotFilters] = useState<Record<string, string[]>>({});

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
  const mobileDialogRef = useRef<HTMLDivElement>(null);

  // flat list DnD 센서 (포인터 + 터치)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // 포커스 트랩 — 바텀시트 열릴 때 포커스 가두기 (a11y)
  useEffect(() => {
    if (!mobileDetail) return;
    const dialog = mobileDialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileDetail]);

  // 기사 적재 현황 패널 (지도 우측 상단)
  const [driverPanelOpen, setDriverPanelOpen] = useState(true);

  // 기사별 색상 매핑
  const driverColorMap = useMemo(() => {
    const map = new Map<string, string>();
    drivers.forEach((d, idx) => {
      map.set(d.id, getDriverColor(idx));
    });
    return map;
  }, [drivers]);

  // 인증
  useEffect(() => {
    const t = safeSessionGet("admin_token");
    if (!t) {
      safeSessionSet("admin_return_url", window.location.pathname);
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
        safeSessionRemove("admin_token");
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
      } else {
        console.warn("[unloading-points] 조회 실패:", res.status);
      }
    } catch (e) {
      console.warn("[unloading-points] 네트워크 오류:", e);
    }
  }, [token]);

  useEffect(() => {
    fetchUnloadingPoints();
  }, [fetchUnloadingPoints]);

  // recalcDoneRef: 날짜별 하차지 소급 계산 여부 추적 (useEffect 아래 activeBookings 의존)
  const recalcDoneRef = useRef<string | null>(null);

  // 날짜 변경 시 자동배차 관련 상태 초기화 (이전 날짜 필터 오염 방지)
  useEffect(() => {
    setDriverSlotFilters({});
    setShowSlotConfig(false);
  }, [selectedDate]);

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
  }, [token, selectedDate, autoMode, driverSlotFilters, unloadingPoints]);

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
            bookings: planBookings.map(({ id, routeOrder }) => ({ id, routeOrder })),
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
  }, [token, autoResult, autoApplying, fetchData]);

  // 자동배차 취소
  const handleAutoCancel = useCallback(() => {
    setAutoMode("idle");
    setAutoResult(null);
    setPartialFailedIds([]);
  }, []);

  // 날짜 변경 시 배차 실패 배너 초기화
  useEffect(() => {
    setPartialFailedIds([]);
  }, [selectedDate]);

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

  // 적재 초과 기사가 있는데 unloadingStopAfter가 없으면 소급 재계산 (날짜별 1회)
  // 코드 배포 전 배차된 데이터 자동 보정
  useEffect(() => {
    if (!token || loading || recalcDoneRef.current === selectedDate) return;
    const hasOverflowWithoutStops = driverStats.some((stat) => {
      if (stat.totalLoadingCube <= stat.vehicleCapacity) return false;
      return !activeBookings.some(
        (b) => b.driverId === stat.driverId && b.unloadingStopAfter != null,
      );
    });
    if (!hasOverflowWithoutStops) return;
    recalcDoneRef.current = selectedDate;
    fetch(`/api/admin/dispatch-auto?date=${selectedDate}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.updated > 0) fetchData({ silent: true });
      })
      .catch(console.error);
  }, [token, loading, selectedDate, driverStats, activeBookings, fetchData]);

  // 기사별 시간대 분포 (슬롯 칩 표시용)
  const driverSlotBreakdown = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const b of activeBookings) {
      if (!b.driverId) continue;
      if (!map.has(b.driverId)) map.set(b.driverId, {});
      const slot = b.timeSlot || "기타";
      const entry = map.get(b.driverId)!;
      entry[slot] = (entry[slot] || 0) + 1;
    }
    return map;
  }, [activeBookings]);

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

  // 필터링된 예약 (특정 기사 선택 시 routeOrder 기준 정렬)
  const filteredBookings = useMemo(() => {
    const filtered = activeBookings.filter((b) => {
      const driverMatch =
        filterDriverId === "unassigned" ? !b.driverId :
        filterDriverId !== "all" ? b.driverId === filterDriverId :
        true;
      const slotMatch = filterSlot === "all" || b.timeSlot === filterSlot;
      return driverMatch && slotMatch;
    });
    if (filterDriverId !== "all" && filterDriverId !== "unassigned") {
      return [...filtered].sort((a, b) => (a.routeOrder ?? 9999) - (b.routeOrder ?? 9999));
    }
    return filtered;
  }, [activeBookings, filterDriverId, filterSlot]);
  // 최신값 ref 동기화 (scrollToNextUnassigned stale closure 방어)
  filteredBookingsRef.current = filteredBookings;

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

  // 슬롯별 과부하 감지 (기사 1명당 기준: 오전 9건, 오후 12건, 저녁 6건)
  const slotOverload = useMemo(() => {
    const result: Record<string, { total: number; driverCount: number; max: number; over: boolean }> = {};
    for (const slot of SLOT_ORDER) {
      const slotBookings = activeBookings.filter((b) => b.timeSlot === slot && b.driverId);
      const driverCount = new Set(slotBookings.map((b) => b.driverId!)).size;
      const total = slotBookings.length;
      const max = (SLOT_MAX_PER_DRIVER[slot] ?? 9) * Math.max(driverCount, 1);
      result[slot] = { total, driverCount, max, over: driverCount > 0 && total > max };
    }
    return result;
  }, [activeBookings]);

  // 마커 색상 결정
  const getMarkerColor = useCallback((booking: Booking): string => {
    if (!booking.driverId) return UNASSIGNED_COLOR;
    return driverColorMap.get(booking.driverId) || "#10B981";
  }, [driverColorMap]);

  // 좌표 있는 예약만 마커로 (특정 기사 선택 시 routeOrder로 번호 표시)
  const mapMarkers: MapMarker[] = useMemo(() => {
    const specificDriver = filterDriverId !== "all" && filterDriverId !== "unassigned";
    return filteredBookings
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b, idx) => ({
        id: b.id,
        lat: b.latitude!,
        lng: b.longitude!,
        label: specificDriver && b.routeOrder != null ? String(b.routeOrder) : String(idx + 1),
        subtitle: b.customerName || "",
        color: getMarkerColor(b),
      }));
  }, [filteredBookings, getMarkerColor, filterDriverId]);

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

  // 하차지 마커: 활성 하차지는 항상 표시, preview 모드에선 사용 여부 구분
  const unloadingMapMarkers: UnloadingMarker[] = useMemo(() => {
    const activePoints = unloadingPoints.filter((p) => p.active);
    if (activePoints.length === 0) return [];
    const usedIds = new Set<string>();
    if (autoMode === "preview" && autoResult) {
      autoResult.plan.forEach((dp) =>
        dp.unloadingStops.forEach((s) => usedIds.add(s.pointId))
      );
    }
    return activePoints.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      name: p.name,
      isUsed: autoMode === "preview" && autoResult ? usedIds.has(p.id) : undefined,
    }));
  }, [autoMode, autoResult, unloadingPoints]);

  // 경로 폴리라인 — preview 모드는 하차지 경유 포함, 일반 모드는 routeOrder 기반
  const mapRouteLines: RouteLine[] = useMemo(() => {
    if (autoMode === "preview" && autoResult) {
      // preview 모드에서도 특정 기사 선택 시 해당 기사 선만 표시
      const planToShow = filterDriverId === "all" || filterDriverId === "unassigned"
        ? autoResult.plan
        : autoResult.plan.filter((dp) => dp.driverId === filterDriverId);
      return planToShow.map((dp) => {
        const color = driverColorMap.get(dp.driverId) || "#10B981";
        const points: { lat: number; lng: number }[] = [];
        const sorted = [...dp.bookings].sort((a, b) => a.routeOrder - b.routeOrder);
        sorted.forEach((b) => {
          const booking = bookings.find((bk) => bk.id === b.id);
          if (booking?.latitude && booking?.longitude) {
            points.push({ lat: booking.latitude, lng: booking.longitude });
          }
          const stop = dp.unloadingStops.find((s) => s.afterRouteOrder === b.routeOrder);
          if (stop) {
            const up = unloadingPoints.find((p) => p.id === stop.pointId);
            if (up) points.push({ lat: up.latitude, lng: up.longitude });
          }
        });
        return { driverId: dp.driverId, color, points };
      });
    }
    // 일반 모드: 특정 기사 선택 시에만 해당 기사 동선 표시 (다른 기사 선 숨김)
    if (filterDriverId === "all" || filterDriverId === "unassigned") return [];
    const lines: RouteLine[] = [];
    const stat = driverStats.find((s) => s.driverId === filterDriverId);
    if (!stat) return lines;
    const color = driverColorMap.get(stat.driverId) || "#10B981";
    const driverBookings = activeBookings
      .filter((b) => b.driverId === stat.driverId && b.routeOrder != null && b.latitude != null && b.longitude != null)
      .sort((a, b) => (a.routeOrder ?? 9999) - (b.routeOrder ?? 9999));
    if (driverBookings.length >= 2) {
      const points: { lat: number; lng: number }[] = [];
      driverBookings.forEach((b) => {
        points.push({ lat: b.latitude!, lng: b.longitude! });
        if (b.unloadingStopAfter) {
          const up = unloadingPoints.find((p) => p.id === b.unloadingStopAfter);
          if (up) points.push({ lat: up.latitude, lng: up.longitude });
        }
      });
      lines.push({ driverId: stat.driverId, color, points });
    }
    return lines;
  }, [autoMode, autoResult, filterDriverId, bookings, driverColorMap, unloadingPoints, activeBookings, driverStats]);

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
    const allChecked = unassigned.length > 0 && unassigned.every((b) => checkedIds.has(b.id));
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(unassigned.map((b) => b.id)));
    }
  }

  // 단건 배차 (옵티미스틱 업데이트)
  // 배차 완료 후 다음 미배차 항목으로 스크롤 (ref 사용으로 stale closure 방어)
  function scrollToNextUnassigned(excludeIds: string[]) {
    const next = filteredBookingsRef.current.find((b) => !b.driverId && !excludeIds.includes(b.id ?? ""));
    if (next?.id) {
      const targetId = next.id;
      setTimeout(() => {
        cardRefs.current.get(targetId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  }

  async function handleDispatch(bookingId: string, driverId: string) {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver || !token || dispatching) return;

    // 배차 직전에 다음 미배차 계산 (옵티미스틱 업데이트 전)
    scrollToNextUnassigned([bookingId]);

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
          date: selectedDate,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.capacityWarning) showToast(data.capacityWarning, "warning");
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

    // 배차 직전에 다음 미배차 계산
    scrollToNextUnassigned(targetIds);

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
          date: selectedDate,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.partialFailure) {
          showToast(`${data.updated?.length || 0}건 성공, ${data.failed?.length || 0}건 실패`, "warning");
        } else {
          showToast(`${targetIds.length}건 배차 완료`, "success");
        }
        if (data.capacityWarning) showToast(data.capacityWarning, "warning");
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
  }, [token, filterDriverId, optimizingRoute, selectedDate, fetchData]);

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
  }, [token, filteredBookings, fetchData]);

  // 날짜 이동 (시간대 무관 순수 날짜 산술)
  function moveDate(delta: number) {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d + delta);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }

  return {
    // refs
    mapRef,
    cardRefs,
    mobileDialogRef,

    // 인증
    token,

    // 로딩/에러
    loading,
    fetchError,
    fetchData,

    // 날짜
    selectedDate,
    setSelectedDate,
    moveDate,

    // 데이터
    bookings,
    drivers,
    driverStats,
    activeBookings,
    unloadingPoints,

    // 선택/필터
    selectedBookingId,
    setSelectedBookingId,
    selectedBooking,
    filterDriverId,
    setFilterDriverId,
    filterSlot,
    setFilterSlot,
    checkedIds,
    setCheckedIds,
    batchDriverId,
    setBatchDriverId,

    // 필터 결과
    filteredBookings,
    groupedBySlot,
    slotOverload,

    // 기사 관련
    driverColorMap,
    driverSlotBreakdown,
    driverPanelOpen,
    setDriverPanelOpen,

    // 지도 마커/경로
    mapMarkers,
    previewMapMarkers,
    unloadingMapMarkers,
    mapRouteLines,
    unassignedCount,

    // 배차 액션
    dispatching,
    handleDispatch,
    handleBatchDispatch,
    handleUnassign,
    toggleCheck,
    toggleAllUnassigned,

    // 동선
    optimizingRoute,
    reordering,
    handleOptimizeRoute,
    handleFlatListReorder,
    sensors,

    // 자동배차
    autoMode,
    autoResult,
    autoApplying,
    partialFailedIds,
    setPartialFailedIds,
    showSlotConfig,
    setShowSlotConfig,
    driverSlotFilters,
    toggleDriverSlot,
    handleAutoDispatch,
    handleAutoApply,
    handleAutoCancel,
    handleAutoReorder,

    // 하차지 모달
    showUnloadingModal,
    setShowUnloadingModal,
    fetchUnloadingPoints,

    // 토스트
    toast,
    showToast,

    // 모바일
    mobileTab,
    setMobileTab,
    mobileDetail,
    setMobileDetail,

    // 카드/마커 클릭
    handleMarkerClick,
    handleCardClick,

    // 라우터
    router,
  };
}
