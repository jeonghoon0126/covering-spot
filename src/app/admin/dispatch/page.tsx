"use client";

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import KakaoMap from "@/components/admin/KakaoMap";
import type { KakaoMapHandle, MapMarker } from "@/components/admin/KakaoMap";
import type { Booking, BookingItem } from "@/types/booking";

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

  // 모바일 탭 (지도 / 목록)
  const [mobileTab, setMobileTab] = useState<"map" | "list">("list");
  // 모바일 상세 바텀시트
  const [mobileDetail, setMobileDetail] = useState(false);

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

  // 데이터 로드 (AbortController로 race condition 방어)
  const fetchData = useCallback(async () => {
    if (!token) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setFetchError(false);
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
        setFetchError(true);
        return;
      }
      const data = await res.json();
      if (controller.signal.aborted) return;
      setBookings(data.bookings || []);
      setDrivers(data.drivers || []);
      setDriverStats(data.driverStats || []);
      setCheckedIds(new Set());
      setSelectedBookingId(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
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

  // 단건 배차
  async function handleDispatch(bookingId: string, driverId: string) {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver || !token || dispatching) return;

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
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "배차 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setDispatching(false);
    }
  }

  // 일괄 배차 (현재 필터에 보이는 것만 배차)
  async function handleBatchDispatch() {
    const driver = drivers.find((d) => d.id === batchDriverId);
    if (!driver || !token || checkedIds.size === 0 || dispatching) return;

    setDispatching(true);
    try {
      const res = await fetch(`/api/admin/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingIds: Array.from(checkedIds).filter((id) =>
            filteredBookings.some((b) => b.id === id),
          ),
          driverId: driver.id,
          driverName: driver.name,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.partialFailure) {
          alert(`${data.updated?.length || 0}건 성공, ${data.failed?.length || 0}건 실패`);
        }
        await fetchData();
        setBatchDriverId("");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "배차 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setDispatching(false);
    }
  }

  // 배차 해제
  async function handleUnassign(bookingId: string) {
    if (!token || dispatching) return;
    if (!confirm("배차를 해제하시겠습니까?")) return;

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
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "배차 해제 실패");
      }
    } catch {
      alert("네트워크 오류");
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
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-20 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[100rem] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/admin/calendar")}
                className="text-text-sub hover:text-text-primary transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <h1 className="text-lg font-bold">배차 관리</h1>
            </div>

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
            onClick={fetchData}
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
              {/* 요약 + 전체선택 */}
              <div className="px-4 py-3 border-b border-border-light bg-bg-warm">
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
                  {unassignedCount > 0 && (
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
              </div>

              {/* 주문 목록 (시간대별) */}
              <div className="flex-1 overflow-y-auto">
                {filteredBookings.length === 0 ? (
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

              {/* 기사 적재 현황 */}
              <div className="border-t border-border-light bg-bg px-4 py-3">
                <h3 className="text-xs font-semibold text-text-sub mb-2">기사별 적재 현황</h3>
                <div className="space-y-2">
                  {driverStats.map((stat) => {
                    const pct = getLoadingPercent(stat.totalLoadingCube, stat.vehicleCapacity);
                    const isOver = stat.totalLoadingCube > stat.vehicleCapacity;
                    const color = driverColorMap.get(stat.driverId) || "#10B981";
                    return (
                      <button
                        key={stat.driverId}
                        onClick={() => {
                          setFilterDriverId(
                            filterDriverId === stat.driverId ? "all" : stat.driverId,
                          );
                        }}
                        className={`w-full p-2.5 rounded-lg border transition-all text-left ${
                          filterDriverId === stat.driverId
                            ? "border-primary bg-primary-bg"
                            : "border-border-light hover:border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: color }}
                          />
                          <span className="text-sm font-semibold">{stat.driverName}</span>
                          <span className="text-[10px] text-text-muted">{stat.vehicleType}</span>
                          {stat.licensePlate && (
                            <span className="text-[10px] text-text-muted">{stat.licensePlate}</span>
                          )}
                          <span className="ml-auto text-xs text-text-muted">{stat.assignedCount}건</span>
                        </div>
                        <div
                          className="h-2 bg-fill-tint rounded-full overflow-hidden mb-1"
                          role="progressbar"
                          aria-valuenow={Math.round(stat.totalLoadingCube * 10) / 10}
                          aria-valuemin={0}
                          aria-valuemax={stat.vehicleCapacity}
                        >
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
                          {isOver && <span className="text-semantic-red font-medium">적재 초과</span>}
                        </div>
                      </button>
                    );
                  })}
                  {driverStats.length === 0 && (
                    <div className="text-xs text-text-muted py-2">활성 기사가 없습니다</div>
                  )}
                </div>
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
                markers={mapMarkers}
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
              <span className="text-[10px] text-text-muted ml-auto flex-shrink-0">
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
        {/* 배차 해제 (배차된 경우) */}
        {booking.driverId && (
          <button
            onClick={(e) => { e.stopPropagation(); onUnassign(); }}
            disabled={dispatching}
            className="text-[10px] text-semantic-red px-2 py-1 rounded hover:bg-semantic-red-tint transition-colors flex-shrink-0 mt-1"
          >
            해제
          </button>
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

  useEffect(() => {
    setSelectedDriverId(booking.driverId ?? "");
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
            <button
              onClick={onUnassign}
              disabled={dispatching}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-semantic-red/30 text-semantic-red hover:bg-semantic-red-tint transition-colors disabled:opacity-40"
            >
              해제
            </button>
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
