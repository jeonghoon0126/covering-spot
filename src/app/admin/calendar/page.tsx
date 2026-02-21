"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Booking } from "@/types/booking";

/* ── 타입 ── */

interface BlockedSlot {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  reason?: string;
  createdBy?: string;
  createdAt?: string;
  driverId?: string | null;
}

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
  vehicleType: string;
  vehicleCapacity: number;
  licensePlate: string | null;
  workDays: string;
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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-semantic-orange-tint text-semantic-orange",
  quote_confirmed: "bg-primary-tint text-primary",
  in_progress: "bg-primary-tint text-primary-dark",
  completed: "bg-semantic-green-tint text-semantic-green",
  payment_requested: "bg-semantic-orange-tint text-semantic-orange",
  payment_completed: "bg-semantic-green-tint text-semantic-green",
  cancelled: "bg-semantic-red-tint text-semantic-red",
  rejected: "bg-fill-tint text-text-muted",
};

// 일간 타임라인: 10:00~17:00 (30분 단위, 15개)
const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const hour = Math.floor(i / 2) + 10;
  const min = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${min}`;
});

// 슬롯 관리 타임라인: 10:00 ~ 17:00 (1시간 단위, 8개)
const SLOT_MGMT_HOURS = Array.from({ length: 8 }, (_, i) => {
  const hour = i + 10;
  return `${String(hour).padStart(2, "0")}:00`;
});

/* ── 유틸 ── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${weekdays[d.getDay()]})`;
}

function getToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=일, 1=월, ...
  const diff = day === 0 ? -6 : 1 - day; // 월요일로 이동
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getWeekDays(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function nextHour(time: string): string {
  const hour = parseInt(time.split(":")[0], 10) + 1;
  return `${String(hour).padStart(2, "0")}:00`;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default function AdminCalendarPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [slotInfo, setSlotInfo] = useState<Record<string, { available: boolean; count: number }>>({});
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "slots">("daily");
  const [weeklyBookings, setWeeklyBookings] = useState<Record<string, Booking[]>>({});
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // 슬롯 관리 상태
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [slotMgmtDate, setSlotMgmtDate] = useState(getToday());
  const [selectedDriverId, setSelectedDriverId] = useState<string>("all");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotActionLoading, setSlotActionLoading] = useState<string | null>(null);
  const [slotBookings, setSlotBookings] = useState<Booking[]>([]);

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  /* ── 인증 ── */

  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) {
      sessionStorage.setItem("admin_return_url", window.location.pathname);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  /* ── 캘린더 데이터 fetch ── */

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // 슬롯 가용성 조회
  useEffect(() => {
    if (!selectedDate) return;
    fetch(`/api/slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, { available: boolean; count: number }> = {};
        for (const s of data.slots || []) {
          map[s.time] = { available: s.available, count: s.count };
        }
        setSlotInfo(map);
      })
      .catch(() => {});
  }, [selectedDate]);

  // 주간뷰: 7일치 예약 병렬 조회
  useEffect(() => {
    if (viewMode !== "weekly" || !token) return;
    setWeeklyLoading(true);
    Promise.all(
      weekDays.map((day) =>
        fetch(`/api/admin/bookings?date=${day}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((data) => ({ day, bookings: (data.bookings || []) as Booking[] }))
          .catch(() => ({ day, bookings: [] as Booking[] })),
      ),
    ).then((results) => {
      const map: Record<string, Booking[]> = {};
      for (const { day, bookings: dayB } of results) {
        map[day] = dayB
          .filter((b) => b.date === day && b.status !== "cancelled" && b.status !== "rejected")
          .sort((a, b) => {
            const ta = a.confirmedTime || a.timeSlot || "99:99";
            const tb = b.confirmedTime || b.timeSlot || "99:99";
            return ta.localeCompare(tb);
          });
      }
      setWeeklyBookings(map);
      setWeeklyLoading(false);
    });
  }, [viewMode, weekStart, token, weekDays]);

  /* ── 슬롯 관리 데이터 fetch ── */

  const fetchDrivers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/drivers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setDrivers(data.drivers || []);
    } catch {
      // ignore
    }
  }, [token, router]);

  const fetchBlockedSlots = useCallback(async () => {
    if (!token) return;
    setSlotsLoading(true);
    try {
      const driverParam = selectedDriverId !== "all" ? `&driverId=${selectedDriverId}` : "";
      const res = await fetch(`/api/admin/blocked-slots?date=${slotMgmtDate}${driverParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setBlockedSlots(data.slots || []);
    } catch {
      // ignore
    } finally {
      setSlotsLoading(false);
    }
  }, [token, slotMgmtDate, selectedDriverId, router]);

  const fetchSlotBookings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/bookings?dateFrom=${slotMgmtDate}&dateTo=${slotMgmtDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSlotBookings(
          (data.bookings || []).filter(
            (b: Booking) =>
              b.date === slotMgmtDate &&
              b.status !== "cancelled" &&
              b.status !== "rejected",
          ),
        );
      }
    } catch {
      // ignore
    }
  }, [token, slotMgmtDate]);

  useEffect(() => {
    if (viewMode === "slots") {
      fetchDrivers();
      fetchBlockedSlots();
      fetchSlotBookings();
    }
  }, [viewMode, fetchDrivers, fetchBlockedSlots, fetchSlotBookings]);

  /* ── 슬롯 관리 액션 ── */

  async function handleBlockSlot(timeStart: string) {
    const timeEnd = nextHour(timeStart);
    const driverId = selectedDriverId !== "all" ? selectedDriverId : undefined;
    setSlotActionLoading(timeStart);
    try {
      const res = await fetch("/api/admin/blocked-slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: slotMgmtDate,
          timeStart,
          timeEnd,
          reason: "관리자 수동 차단",
          driverId: driverId || null,
        }),
      });
      if (res.ok) {
        fetchBlockedSlots();
      } else {
        const data = await res.json();
        alert(data.error || "차단 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSlotActionLoading(null);
    }
  }

  async function handleUnblockSlot(slotId: string, timeStart: string) {
    setSlotActionLoading(timeStart);
    try {
      const res = await fetch(`/api/admin/blocked-slots?id=${slotId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchBlockedSlots();
      } else {
        const data = await res.json();
        alert(data.error || "해제 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSlotActionLoading(null);
    }
  }

  /* ── 캘린더 계산 ── */

  // 선택한 날짜의 예약만 필터 + 취소/수거불가 제외
  const dayBookings = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          b.date === selectedDate &&
          b.status !== "cancelled" &&
          b.status !== "rejected",
      )
      .sort((a, b) => {
        const ta = a.confirmedTime || a.timeSlot || "99:99";
        const tb = b.confirmedTime || b.timeSlot || "99:99";
        return ta.localeCompare(tb);
      });
  }, [bookings, selectedDate]);

  // 시간대별 그룹핑
  const slotMap = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const slot of TIME_SLOTS) {
      map[slot] = [];
    }
    map["미정"] = [];

    for (const b of dayBookings) {
      const time = b.confirmedTime || b.timeSlot;
      if (time && map[time]) {
        map[time].push(b);
      } else if (time) {
        // 30분 단위가 아닌 경우 가장 가까운 슬롯에 배치
        const rounded =
          TIME_SLOTS.find((s) => s >= time) || TIME_SLOTS[TIME_SLOTS.length - 1];
        map[rounded].push(b);
      } else {
        map["미정"].push(b);
      }
    }
    return map;
  }, [dayBookings]);

  // 해당일 상태별 요약
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of dayBookings) {
      counts[b.status] = (counts[b.status] || 0) + 1;
    }
    return counts;
  }, [dayBookings]);

  // 슬롯 관리: 시간대별 예약 수 카운트
  const slotBookingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of slotBookings) {
      const time = b.confirmedTime || b.timeSlot;
      if (!time) continue;
      // 시간의 정시(hour)를 구함
      const hour = time.split(":")[0];
      const key = `${hour}:00`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [slotBookings]);

  // 슬롯 관리: 시간대별 차단 슬롯 매핑
  const blockedSlotMap = useMemo(() => {
    const map: Record<string, BlockedSlot> = {};
    for (const slot of blockedSlots) {
      map[slot.timeStart] = slot;
    }
    return map;
  }, [blockedSlots]);

  const isToday = selectedDate === getToday();
  const isSlotMgmtToday = slotMgmtDate === getToday();

  /* ── 헤더 타이틀 ── */
  const headerTitle = viewMode === "daily" ? "일간 캘린더" : viewMode === "weekly" ? "주간 캘린더" : "슬롯 관리";

  return (
    <>
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">{headerTitle}</h1>
            <div className="flex rounded-md border border-border-light overflow-hidden">
              <button
                onClick={() => setViewMode("daily")}
                className={`text-xs px-3 py-1 font-medium transition-colors ${
                  viewMode === "daily"
                    ? "bg-primary text-white"
                    : "bg-bg text-text-sub hover:bg-bg-warm"
                }`}
              >
                일간
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`text-xs px-3 py-1 font-medium transition-colors ${
                  viewMode === "weekly"
                    ? "bg-primary text-white"
                    : "bg-bg text-text-sub hover:bg-bg-warm"
                }`}
              >
                주간
              </button>
              <button
                onClick={() => setViewMode("slots")}
                className={`text-xs px-3 py-1 font-medium transition-colors ${
                  viewMode === "slots"
                    ? "bg-primary text-white"
                    : "bg-bg text-text-sub hover:bg-bg-warm"
                }`}
              >
                슬롯
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="text-sm text-text-sub hover:text-text-primary transition-colors flex items-center gap-1 px-2 py-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              목록
            </button>
            <button
              onClick={() => router.push("/admin/driver")}
              className="text-sm text-text-sub hover:text-text-primary transition-colors flex items-center gap-1 px-2 py-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 12L6 4L10 9L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              기사님
            </button>
            <button
              onClick={() => router.push("/admin/dispatch")}
              className="text-sm text-primary hover:text-primary-dark transition-colors flex items-center gap-1 px-2 py-2 font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 8L8 14M14 8H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              배차
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[56rem] mx-auto px-4 py-4">
        {/* ── 일간/주간 뷰: 날짜 네비게이션 ── */}
        {viewMode !== "slots" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() =>
                  setSelectedDate(addDays(selectedDate, viewMode === "daily" ? -1 : -7))
                }
                className="p-2 rounded-full hover:bg-bg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="text-center">
                {viewMode === "daily" ? (
                  <>
                    <p className="text-base font-bold">{formatDate(selectedDate)}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {dayBookings.length}건
                      {Object.entries(summary).map(([status, count]) => (
                        <span key={status} className="ml-1.5">
                          {STATUS_LABELS[status]} {count}
                        </span>
                      ))}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-bold">
                      {formatShortDate(weekDays[0])} ~ {formatShortDate(weekDays[6])}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      총 {Object.values(weeklyBookings).reduce((sum, arr) => sum + arr.length, 0)}건
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() =>
                  setSelectedDate(addDays(selectedDate, viewMode === "daily" ? 1 : 7))
                }
                className="p-2 rounded-full hover:bg-bg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* 오늘 버튼 */}
            {!isToday && (
              <div className="text-center mb-4">
                <button
                  onClick={() => setSelectedDate(getToday())}
                  className="text-xs text-primary font-medium px-3 py-1 rounded-full border border-primary/30 hover:bg-primary-bg transition-colors"
                >
                  오늘로 이동
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 일간 타임라인 ── */}
        {viewMode === "daily" && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="space-y-0">
                {TIME_SLOTS.map((slot) => {
                  const items = slotMap[slot];
                  const info = slotInfo[slot];
                  const isFull = info && !info.available;
                  const count = info?.count || 0;

                  return (
                    <div
                      key={slot}
                      className={`flex border-b border-border-light/50 ${
                        isFull ? "bg-semantic-red-tint/30" : ""
                      }`}
                    >
                      {/* 시간 라벨 */}
                      <div className="w-16 max-sm:w-14 shrink-0 py-3 pr-2 text-right">
                        <span className={`text-xs font-medium ${
                          items.length > 0 ? "text-text-primary" : "text-text-muted"
                        }`}>
                          {slot}
                        </span>
                        {count > 0 && (
                          <span className={`block text-[10px] ${isFull ? "text-semantic-red" : "text-text-muted"}`}>
                            {count}/2
                          </span>
                        )}
                      </div>

                      {/* 예약 카드 영역 */}
                      <div className="flex-1 py-2 pl-3 border-l border-border-light min-h-[3rem] flex flex-wrap gap-2">
                        {items.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => router.push(`/admin/bookings/${b.id}`)}
                            className="flex items-center gap-2 bg-bg rounded-md px-3 py-2 border border-border-light hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 text-left max-w-full"
                          >
                            <span
                              className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}
                            >
                              {STATUS_LABELS[b.status]}
                            </span>
                            <span className="text-xs font-medium truncate">
                              {b.customerName}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0">
                              {b.area}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0">
                              {b.items.length}종
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* 시간 미정 */}
                {slotMap["미정"].length > 0 && (
                  <div className="flex border-b border-border-light/50 bg-semantic-orange-tint/20">
                    <div className="w-16 max-sm:w-14 shrink-0 py-3 pr-2 text-right">
                      <span className="text-xs font-medium text-semantic-orange">미정</span>
                    </div>
                    <div className="flex-1 py-2 pl-3 border-l border-border-light min-h-[3rem] flex flex-wrap gap-2">
                      {slotMap["미정"].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => router.push(`/admin/bookings/${b.id}`)}
                          className="flex items-center gap-2 bg-bg rounded-md px-3 py-2 border border-border-light hover:shadow-hover transition-all duration-200 text-left"
                        >
                          <span
                            className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}
                          >
                            {STATUS_LABELS[b.status]}
                          </span>
                          <span className="text-xs font-medium truncate">
                            {b.customerName}
                          </span>
                          <span className="text-[10px] text-text-muted shrink-0">
                            {b.area} | {b.items.length}종
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 빈 상태 */}
            {!loading && dayBookings.length === 0 && (
              <div className="text-center py-12 text-text-muted text-sm">
                이 날짜에 예약이 없습니다
              </div>
            )}
          </>
        )}

        {/* ── 주간 뷰 ── */}
        {viewMode === "weekly" && (
          <>
            {weeklyLoading ? (
              <div className="text-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                  {weekDays.map((day, i) => {
                    const dayB = weeklyBookings[day] || [];
                    const isCurrentDay = day === getToday();
                    return (
                      <div key={day} className="flex flex-col">
                        {/* 컬럼 헤더 */}
                        <div
                          className={`text-center py-2 rounded-t-[--radius-md] border border-border-light ${
                            isCurrentDay
                              ? "bg-primary text-white"
                              : "bg-bg"
                          }`}
                        >
                          <p className={`text-xs font-bold ${isCurrentDay ? "" : "text-text-primary"}`}>
                            {WEEKDAY_LABELS[i]}
                          </p>
                          <p className={`text-[10px] ${isCurrentDay ? "text-white/80" : "text-text-muted"}`}>
                            {formatShortDate(day)}
                          </p>
                        </div>

                        {/* 예약 카드 리스트 */}
                        <div className="flex-1 border border-t-0 border-border-light rounded-b-[--radius-md] bg-bg p-1.5 space-y-1.5 min-h-[120px]">
                          {dayB.length === 0 && (
                            <p className="text-[10px] text-text-muted text-center pt-4">없음</p>
                          )}
                          {dayB.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => router.push(`/admin/bookings/${b.id}`)}
                              className="w-full text-left bg-bg-warm rounded-md px-2 py-1.5 border border-border-light hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200"
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[10px] font-medium text-text-sub">
                                  {b.confirmedTime || b.timeSlot || "미정"}
                                </span>
                                <span
                                  className={`text-[9px] font-semibold px-1 py-px rounded-full ${STATUS_COLORS[b.status]}`}
                                >
                                  {STATUS_LABELS[b.status]}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium truncate">
                                {b.customerName}
                              </p>
                            </button>
                          ))}
                        </div>

                        {/* 건수 */}
                        <div className="text-center mt-1">
                          <span className="text-[10px] text-text-muted">{dayB.length}건</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 슬롯 관리 뷰 ── */}
        {viewMode === "slots" && (
          <div className="space-y-6">
            {/* 기사 드롭다운 + 날짜 선택 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {/* 기사 선택 */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-text-muted font-medium">기사 선택</label>
                  <button
                    onClick={() => router.push("/admin/driver")}
                    className="text-[11px] text-primary font-medium hover:underline"
                  >
                    기사 관리 →
                  </button>
                </div>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-border-light bg-bg text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                >
                  <option value="all">전체</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}{d.phone ? ` (${d.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* 날짜 선택 */}
              <div className="flex-1">
                <label className="block text-[11px] text-text-muted font-medium mb-1">날짜</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSlotMgmtDate(addDays(slotMgmtDate, -1))}
                    className="shrink-0 p-2 rounded-sm hover:bg-bg transition-colors border border-border-light"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <input
                    type="date"
                    value={slotMgmtDate}
                    onChange={(e) => setSlotMgmtDate(e.target.value)}
                    className="flex-1 h-11 px-3 rounded-md border border-border-light bg-bg text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                  <button
                    onClick={() => setSlotMgmtDate(addDays(slotMgmtDate, 1))}
                    className="shrink-0 p-2 rounded-sm hover:bg-bg transition-colors border border-border-light"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                {!isSlotMgmtToday && (
                  <button
                    onClick={() => setSlotMgmtDate(getToday())}
                    className="text-[11px] text-primary font-medium mt-1.5 hover:underline"
                  >
                    오늘로 이동
                  </button>
                )}
              </div>
            </div>

            {/* 날짜 표시 */}
            <div className="text-center">
              <p className="text-base font-bold">{formatDate(slotMgmtDate)}</p>
              <p className="text-xs text-text-muted mt-0.5">
                {blockedSlots.length > 0
                  ? `차단 ${blockedSlots.length}개`
                  : "차단 없음"
                }
                {" · "}
                예약 {slotBookings.length}건
              </p>
            </div>

            {/* 타임라인 그리드 */}
            {slotsLoading ? (
              <div className="text-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="space-y-0">
                {SLOT_MGMT_HOURS.map((time) => {
                  const blocked = blockedSlotMap[time];
                  const bookingCount = slotBookingCounts[time] || 0;
                  const isActionLoading = slotActionLoading === time;

                  return (
                    <div
                      key={time}
                      className={`flex items-stretch border-b border-border-light/50 transition-colors ${
                        blocked ? "bg-red-50" : ""
                      }`}
                    >
                      {/* 시간 라벨 */}
                      <div className="w-16 max-sm:w-14 shrink-0 py-3 pr-2 text-right flex flex-col justify-center">
                        <span className={`text-xs font-medium ${
                          blocked ? "text-semantic-red" : bookingCount > 0 ? "text-text-primary" : "text-text-muted"
                        }`}>
                          {time}
                        </span>
                      </div>

                      {/* 슬롯 상태 + 액션 */}
                      <div className="flex-1 border-l border-border-light min-h-[3.25rem] flex items-center px-3 gap-3">
                        {/* 예약 수 표시 */}
                        {bookingCount > 0 && (
                          <span className="text-[11px] font-medium text-text-sub bg-bg-warm px-2 py-1 rounded-sm">
                            예약 {bookingCount}건
                          </span>
                        )}

                        {/* 차단 상태 */}
                        {blocked ? (
                          <div className="flex items-center gap-2 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-semantic-red shrink-0" />
                              <span className="text-xs font-medium text-semantic-red">차단됨</span>
                            </span>
                            {blocked.reason && (
                              <span className="text-[11px] text-text-muted truncate">
                                {blocked.reason}
                              </span>
                            )}
                            <button
                              onClick={() => handleUnblockSlot(blocked.id!, time)}
                              disabled={isActionLoading}
                              className="ml-auto shrink-0 text-[11px] font-medium text-semantic-red bg-white border border-red-200 rounded-sm px-3 py-1.5 hover:bg-red-50 active:scale-[0.97] transition-all disabled:opacity-50"
                            >
                              {isActionLoading ? "..." : "해제"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-semantic-green shrink-0" />
                              <span className="text-xs text-text-muted">가능</span>
                            </span>
                            <button
                              onClick={() => handleBlockSlot(time)}
                              disabled={isActionLoading}
                              className="ml-auto shrink-0 text-[11px] font-medium text-text-sub bg-bg border border-border-light rounded-sm px-3 py-1.5 hover:bg-bg-warm active:scale-[0.97] transition-all disabled:opacity-50"
                            >
                              {isActionLoading ? "..." : "차단"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}


          </div>
        )}
      </div>
    </div>
    </>
  );
}
