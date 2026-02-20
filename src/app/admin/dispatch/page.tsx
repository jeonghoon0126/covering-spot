"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import KakaoMap from "@/components/admin/KakaoMap";
import type { MapMarker } from "@/components/admin/KakaoMap";
import type { Booking, BookingItem } from "@/types/booking";
import { formatPrice } from "@/lib/format";

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
  quote_confirmed: "견적확정",
  in_progress: "진행중",
  completed: "수거완료",
  payment_requested: "정산요청",
  payment_completed: "정산완료",
  cancelled: "취소",
  rejected: "수거불가",
};

const SLOT_LABELS: Record<string, string> = {
  "10:00": "10~12시",
  "12:00": "12~14시",
  "14:00": "14~16시",
  "15:00": "15~17시",
};

/* ── 유틸 ── */

function getToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
}

function getMarkerColor(booking: Booking): "blue" | "green" | "yellow" | "red" {
  if (!booking.driverId) return "blue";
  if (booking.status === "in_progress") return "yellow";
  if (["completed", "payment_requested", "payment_completed"].includes(booking.status)) return "green";
  return "green";
}

function getLoadingPercent(used: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((used / capacity) * 100));
}

/* ── 메인 페이지 ── */

export default function AdminDispatchPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(getToday());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverStats, setDriverStats] = useState<DriverStats[]>([]);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [filterDriverId, setFilterDriverId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dispatching, setDispatching] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // 모바일 사이드바
  const [mobileSidebar, setMobileSidebar] = useState(false);

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

  // 데이터 로드
  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/admin/dispatch?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      setBookings(data.bookings || []);
      setDrivers(data.drivers || []);
      setDriverStats(data.driverStats || []);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 필터링된 예약
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === "cancelled" || b.status === "rejected") return false;
      if (filterDriverId !== "all") {
        if (filterDriverId === "unassigned") return !b.driverId;
        return b.driverId === filterDriverId;
      }
      if (filterStatus === "unassigned") return !b.driverId;
      if (filterStatus === "assigned") return !!b.driverId;
      return true;
    });
  }, [bookings, filterDriverId, filterStatus]);

  // 좌표 있는 예약만 마커로
  const mapMarkers: MapMarker[] = useMemo(() => {
    return filteredBookings
      .filter((b) => b.latitude && b.longitude)
      .map((b, idx) => ({
        id: b.id,
        lat: b.latitude!,
        lng: b.longitude!,
        label: String(idx + 1),
        color: getMarkerColor(b),
      }));
  }, [filteredBookings]);

  // 좌표 없는 예약
  const noCoordBookings = useMemo(() => {
    return filteredBookings.filter((b) => !b.latitude || !b.longitude);
  }, [filteredBookings]);

  // 미배차 주문
  const unassignedBookings = useMemo(() => {
    return bookings.filter(
      (b) => !b.driverId && b.status !== "cancelled" && b.status !== "rejected",
    );
  }, [bookings]);

  // 선택된 예약
  const selectedBooking = useMemo(() => {
    return bookings.find((b) => b.id === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  // 마커 클릭
  function handleMarkerClick(id: string) {
    setSelectedBookingId(id);
    setMobileSidebar(true);
  }

  // 배차 처리
  async function handleDispatch(bookingId: string, driverId: string) {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver || !token) return;

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
        const data = await res.json();
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
    if (!token) return;
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

  // 날짜 이동
  function moveDate(delta: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-bg-warm flex flex-col">
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-20 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[80rem] mx-auto px-4 py-3">
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

          {/* 필터 */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setFilterDriverId("all"); }}
              className="text-xs px-2 py-1.5 border border-border rounded-lg bg-bg"
              aria-label="배차 상태 필터"
            >
              <option value="all">전체 상태</option>
              <option value="unassigned">미배차</option>
              <option value="assigned">배차완료</option>
            </select>
            <select
              value={filterDriverId}
              onChange={(e) => { setFilterDriverId(e.target.value); setFilterStatus("all"); }}
              className="text-xs px-2 py-1.5 border border-border rounded-lg bg-bg"
              aria-label="기사 필터"
            >
              <option value="all">전체 기사</option>
              <option value="unassigned">미배차</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.vehicleType})
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" /> 미배차
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> 배차완료
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> 수거중
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
        <div className="flex-1 flex flex-col">
          {/* ── 메인 영역: 지도 + 사이드바 ── */}
          <div className="flex-1 flex min-h-0">
            {/* 지도 */}
            <div className="flex-1 relative p-3 pb-0">
              <KakaoMap
                markers={mapMarkers}
                selectedMarkerId={selectedBookingId}
                onMarkerClick={handleMarkerClick}
                className="w-full h-full min-h-[400px]"
              />
              {/* 요약 오버레이 */}
              <div className="absolute top-5 left-5 bg-bg/90 backdrop-blur-sm rounded-lg border border-border-light px-3 py-2 text-xs space-y-0.5 pointer-events-none">
                <div className="font-semibold">{formatDateShort(selectedDate)}</div>
                <div>전체 {bookings.filter((b) => b.status !== "cancelled" && b.status !== "rejected").length}건</div>
                <div className="text-[#3B82F6]">미배차 {unassignedBookings.length}건</div>
              </div>
            </div>

            {/* 사이드바 — 데스크톱 */}
            <div className="hidden lg:block w-[340px] border-l border-border-light bg-bg overflow-y-auto">
              <SidebarContent
                booking={selectedBooking}
                drivers={drivers}
                driverStats={driverStats}
                dispatching={dispatching}
                onDispatch={handleDispatch}
                onUnassign={handleUnassign}
                onDetailClick={(id) => router.push(`/admin/bookings/${id}`)}
              />
            </div>
          </div>

          {/* ── 하단 패널: 기사별 적재 현황 ── */}
          <div className="border-t border-border-light bg-bg">
            <div className="max-w-[80rem] mx-auto px-4 py-3">
              <h3 className="text-xs font-semibold text-text-sub mb-2">기사별 적재 현황</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {driverStats.map((stat) => {
                  const pct = getLoadingPercent(stat.totalLoadingCube, stat.vehicleCapacity);
                  const isOver = stat.totalLoadingCube > stat.vehicleCapacity;
                  return (
                    <button
                      key={stat.driverId}
                      onClick={() => {
                        setFilterDriverId(stat.driverId);
                        setFilterStatus("all");
                      }}
                      className={`flex-shrink-0 w-[140px] p-3 rounded-lg border transition-all ${
                        filterDriverId === stat.driverId
                          ? "border-primary bg-primary-bg"
                          : "border-border-light bg-bg-warm hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm font-semibold truncate">{stat.driverName}</span>
                        <span className="text-[10px] text-text-muted">{stat.vehicleType}</span>
                      </div>
                      {stat.licensePlate && (
                        <div className="text-[10px] text-text-muted mb-1.5 truncate">{stat.licensePlate}</div>
                      )}
                      {/* 적재 게이지 */}
                      <div
                        className="h-2 bg-fill-tint rounded-full overflow-hidden mb-1"
                        role="progressbar"
                        aria-valuenow={Math.round(stat.totalLoadingCube * 10) / 10}
                        aria-valuemin={0}
                        aria-valuemax={stat.vehicleCapacity}
                        aria-label={`${stat.driverName} 적재량 ${stat.totalLoadingCube.toFixed(1)}/${stat.vehicleCapacity}m³`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOver ? "bg-semantic-red" : pct > 80 ? "bg-semantic-orange" : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={isOver ? "text-semantic-red font-semibold" : "text-text-muted"}>
                          {stat.totalLoadingCube.toFixed(1)}/{stat.vehicleCapacity}m&sup3;
                        </span>
                        <span className="text-text-muted">{stat.assignedCount}건</span>
                      </div>
                      {isOver && (
                        <div className="text-[10px] text-semantic-red font-medium mt-0.5">적재 초과</div>
                      )}
                    </button>
                  );
                })}
                {driverStats.length === 0 && (
                  <div className="text-xs text-text-muted py-2">활성 기사가 없습니다</div>
                )}
              </div>
            </div>
          </div>

          {/* ── 미배차 주문 목록 ── */}
          {unassignedBookings.length > 0 && (
            <div className="border-t border-border-light bg-bg-warm">
              <div className="max-w-[80rem] mx-auto px-4 py-3">
                <h3 className="text-xs font-semibold text-text-sub mb-2">
                  미배차 주문 ({unassignedBookings.length}건)
                  {noCoordBookings.length > 0 && (
                    <span className="text-text-muted font-normal ml-1">
                      (좌표없음 {noCoordBookings.filter((b) => !b.driverId).length}건)
                    </span>
                  )}
                </h3>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {unassignedBookings.map((b) => (
                    <div
                      key={b.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-bg border border-border-light cursor-pointer hover:border-primary/30 transition-colors ${
                        selectedBookingId === b.id ? "border-primary bg-primary-bg" : ""
                      }`}
                      onClick={() => { setSelectedBookingId(b.id); setMobileSidebar(true); }}
                    >
                      {!b.latitude && (
                        <span className="text-[10px] bg-fill-tint text-text-muted px-1.5 py-0.5 rounded">좌표없음</span>
                      )}
                      <span className="text-sm font-medium truncate">{b.customerName}</span>
                      <span className="text-xs text-text-muted truncate flex-1">{b.address}</span>
                      <span className="text-xs text-text-sub shrink-0">
                        {SLOT_LABELS[b.timeSlot] || b.timeSlot}
                      </span>
                      <span className="text-xs text-primary font-medium shrink-0">
                        {(b.totalLoadingCube || 0).toFixed(1)}m&sup3;
                      </span>
                      {/* 빠른 배차 드롭다운 */}
                      <select
                        className="text-xs px-1.5 py-1 border border-border rounded bg-bg shrink-0"
                        value=""
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (e.target.value) handleDispatch(b.id, e.target.value);
                        }}
                      >
                        <option value="">배차</option>
                        {driverStats.map((stat) => {
                          const remaining = stat.vehicleCapacity - stat.totalLoadingCube;
                          return (
                            <option key={stat.driverId} value={stat.driverId}>
                              {stat.driverName} ({remaining.toFixed(1)}m&sup3; 여유)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 모바일 사이드바 (바텀시트) ── */}
      {mobileSidebar && selectedBooking && (
        <div
          className="lg:hidden fixed inset-0 z-30"
          role="dialog"
          aria-modal="true"
          aria-label="주문 상세"
          onKeyDown={(e) => { if (e.key === "Escape") setMobileSidebar(false); }}
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileSidebar(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-bg rounded-t-2xl max-h-[75vh] overflow-y-auto animate-slide-up">
            <div className="w-12 h-1 bg-fill-tint rounded-full mx-auto mt-2 mb-1" />
            <SidebarContent
              booking={selectedBooking}
              drivers={drivers}
              driverStats={driverStats}
              dispatching={dispatching}
              onDispatch={handleDispatch}
              onUnassign={handleUnassign}
              onDetailClick={(id) => router.push(`/admin/bookings/${id}`)}
              onClose={() => setMobileSidebar(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 사이드바 컨텐츠 ── */

function SidebarContent({
  booking,
  drivers,
  driverStats,
  dispatching,
  onDispatch,
  onUnassign,
  onDetailClick,
  onClose,
}: {
  booking: Booking | null;
  drivers: Driver[];
  driverStats: DriverStats[];
  dispatching: boolean;
  onDispatch: (bookingId: string, driverId: string) => void;
  onUnassign: (bookingId: string) => void;
  onDetailClick: (id: string) => void;
  onClose?: () => void;
}) {
  const [selectedDriverId, setSelectedDriverId] = useState("");

  useEffect(() => {
    if (booking?.driverId) setSelectedDriverId(booking.driverId);
    else setSelectedDriverId("");
  }, [booking?.id, booking?.driverId]);

  if (!booking) {
    return (
      <div className="p-5 text-center text-sm text-text-muted">
        지도에서 주문을 선택하세요
      </div>
    );
  }

  const itemsSummary = booking.items.length > 0
    ? `${booking.items[0].category} ${booking.items[0].name}${booking.items.length > 1 ? ` 외 ${booking.items.length - 1}종` : ""}`
    : "-";

  return (
    <div className="p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
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
          <a href={`tel:${booking.phone}`} className="text-xs text-primary">{booking.phone}</a>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDetailClick(booking.id)}
            className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-fill-tint"
          >
            상세
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* 주문 정보 */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">주소</span>
          <span className="font-medium text-right max-w-[60%] break-words [overflow-wrap:anywhere]">
            {booking.address} {booking.addressDetail}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">시간</span>
          <span className="font-medium">
            {SLOT_LABELS[booking.timeSlot] || booking.timeSlot}
            {booking.confirmedTime && ` (확정: ${booking.confirmedTime})`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">품목</span>
          <span className="font-medium">{itemsSummary}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">적재 큐브</span>
          <span className="font-semibold text-primary">{(booking.totalLoadingCube || 0).toFixed(1)}m&sup3;</span>
        </div>
        {booking.items.length > 0 && (
          <div className="bg-bg-warm rounded-lg p-2.5 space-y-1">
            {booking.items.map((item: BookingItem, idx: number) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-text-sub">{item.category} {item.name} x{item.quantity}</span>
                <span className="text-text-muted">{(item.loadingCube * item.quantity).toFixed(1)}m&sup3;</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <span className="text-text-muted">엘리베이터</span>
            <span className={`text-xs font-medium ${booking.hasElevator ? "text-semantic-green" : "text-semantic-red"}`}>
              {booking.hasElevator ? "O" : "X"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-text-muted">주차</span>
            <span className={`text-xs font-medium ${booking.hasParking ? "text-semantic-green" : "text-semantic-red"}`}>
              {booking.hasParking ? "O" : "X"}
            </span>
          </div>
        </div>
        {booking.memo && (
          <div>
            <span className="text-text-muted text-xs">요청사항: </span>
            <span className="text-xs">{booking.memo}</span>
          </div>
        )}
        {booking.finalPrice != null && (
          <div className="flex justify-between">
            <span className="text-text-muted">최종 견적</span>
            <span className="font-semibold">{formatPrice(booking.finalPrice)}원</span>
          </div>
        )}
      </div>

      {/* 배차 */}
      <div className="border-t border-border-light pt-3">
        <h4 className="text-xs font-semibold text-text-sub mb-2">
          {booking.driverId ? "배차 변경" : "기사 배차"}
        </h4>
        <select
          value={selectedDriverId}
          onChange={(e) => setSelectedDriverId(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-border rounded-lg bg-bg mb-2"
        >
          <option value="">기사 선택</option>
          {driverStats.map((stat) => {
            const remaining = stat.vehicleCapacity - stat.totalLoadingCube;
            const willOverflow = remaining < (booking.totalLoadingCube || 0);
            return (
              <option key={stat.driverId} value={stat.driverId}>
                {stat.driverName} {stat.vehicleType}
                {stat.licensePlate ? ` ${stat.licensePlate}` : ""}
                {" "}({remaining.toFixed(1)}m&sup3; 여유{willOverflow ? " - 초과!" : ""})
              </option>
            );
          })}
        </select>

        {/* 적재 초과 경고 */}
        {selectedDriverId && (() => {
          const stat = driverStats.find((s) => s.driverId === selectedDriverId);
          if (!stat) return null;
          const afterCube = stat.totalLoadingCube + (booking.totalLoadingCube || 0);
          const isCurrentDriver = booking.driverId === selectedDriverId;
          const effectiveAfter = isCurrentDriver ? stat.totalLoadingCube : afterCube;
          if (effectiveAfter > stat.vehicleCapacity && !isCurrentDriver) {
            return (
              <div className="text-xs text-semantic-red bg-semantic-red-tint rounded-lg px-3 py-2 mb-2">
                적재 초과: {effectiveAfter.toFixed(1)}m&sup3; / {stat.vehicleCapacity}m&sup3;
                (초과 {(effectiveAfter - stat.vehicleCapacity).toFixed(1)}m&sup3;)
              </div>
            );
          }
          return null;
        })()}

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (selectedDriverId) onDispatch(booking.id, selectedDriverId);
            }}
            disabled={!selectedDriverId || dispatching || selectedDriverId === booking.driverId}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40 transition-colors hover:bg-primary-dark"
          >
            {dispatching ? "처리중..." : "배차하기"}
          </button>
          {booking.driverId && (
            <button
              onClick={() => onUnassign(booking.id)}
              disabled={dispatching}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-semantic-red/30 text-semantic-red hover:bg-semantic-red-tint transition-colors disabled:opacity-40"
            >
              해제
            </button>
          )}
        </div>

        {booking.driverId && booking.driverName && (
          <div className="mt-2 text-xs text-text-muted">
            현재 배차: <span className="font-medium text-text-primary">{booking.driverName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
