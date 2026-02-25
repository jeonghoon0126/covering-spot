"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Booking } from "@/types/booking";

/* ── 상수 ── */

const STATUS_LABELS: Record<string, string> = {
  pending: "접수",
  quote_confirmed: "견적확정",
  user_confirmed: "견적확인완료",
  change_requested: "일정변경",
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
  user_confirmed: "bg-semantic-green-tint text-semantic-green",
  change_requested: "bg-semantic-orange-tint text-semantic-orange",
  in_progress: "bg-primary-tint text-primary-dark",
  completed: "bg-semantic-green-tint text-semantic-green",
  payment_requested: "bg-semantic-orange-tint text-semantic-orange",
  payment_completed: "bg-semantic-green-tint text-semantic-green",
  cancelled: "bg-semantic-red-tint text-semantic-red",
  rejected: "bg-fill-tint text-text-muted",
};

// Gantt 블록 배경색 — 디자인 시스템 CSS 변수 기준 (globals.css)
const GANTT_BLOCK_BG: Record<string, string> = {
  pending:           "#FFF7E5",  // --color-semantic-orange-tint
  quote_confirmed:   "#E5F4FF",  // --color-primary-tint
  user_confirmed:    "#EDFCF6",  // --color-semantic-green-tint
  change_requested:  "#FFF7E5",  // --color-semantic-orange-tint
  in_progress:       "#E5F4FF",  // --color-primary-tint
  completed:         "#EDFCF6",  // --color-semantic-green-tint
  payment_requested: "#FFF7E5",  // --color-semantic-orange-tint
  payment_completed: "#EDFCF6",  // --color-semantic-green-tint
  cancelled:         "#FFEBEE",  // --color-semantic-red-tint
  rejected:          "#EEF2F6",  // --color-fill-tint
};

const GANTT_BLOCK_BORDER: Record<string, string> = {
  pending:           "#FF9C1A",  // --color-semantic-orange
  quote_confirmed:   "#1AA3FF",  // --color-primary
  user_confirmed:    "#07C576",  // --color-semantic-green
  change_requested:  "#FF9C1A",  // --color-semantic-orange
  in_progress:       "#1AA3FF",  // --color-primary
  completed:         "#07C576",  // --color-semantic-green
  payment_requested: "#FF9C1A",  // --color-semantic-orange
  payment_completed: "#07C576",  // --color-semantic-green
  cancelled:         "#FF3358",  // --color-semantic-red
  rejected:          "#8A96A8",  // --color-border-strong
};

// Gantt 시간 범위: 09:00 ~ 19:00 (1시간 단위, 10개 구간)
const GANTT_START_HOUR = 9;
const GANTT_END_HOUR = 19;
const GANTT_HOURS = GANTT_END_HOUR - GANTT_START_HOUR; // 10

// 일간 타임라인: 10:00~17:00 (30분 단위, 15개)
const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const hour = Math.floor(i / 2) + 10;
  const min = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${min}`;
});

/* ── 타입 ── */

interface Driver {
  id: string;
  name: string;
  vehicleType: string;
  vehicleCapacity: number;
  licensePlate: string | null;
}

interface DragState {
  bookingId: string;
  originalDriverId: string | null;
  originalTime: string | null;
}

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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = d.getDay(); // 0=일, 1=월, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 월요일로 이동
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getWeekDays(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// 시간 문자열 "HH:MM" → 시간 단위 숫자 (예: "10:30" → 10.5)
function timeToHours(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + m / 60;
}

// Gantt에서 시간 → 픽셀 비율 계산 (GANTT_START_HOUR 기준 offset%)
function timeToPercent(timeStr: string): number {
  const hours = timeToHours(timeStr);
  return ((hours - GANTT_START_HOUR) / GANTT_HOURS) * 100;
}

// 드롭 위치(픽셀)에서 시간 계산
function pixelOffsetToTime(offsetPx: number, totalWidth: number): string {
  const ratio = Math.max(0, Math.min(1, offsetPx / totalWidth));
  const hours = GANTT_START_HOUR + ratio * GANTT_HOURS;
  const h = Math.floor(hours);
  // 30분 단위로 반올림
  const m = hours - h >= 0.5 ? 30 : 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ── Gantt 블록 컴포넌트 ── */

interface GanttBlockProps {
  booking: Booking;
  isUnloading?: boolean;
  onDragStart: (e: React.DragEvent, bookingId: string, driverId: string | null, time: string | null) => void;
  onClick: (bookingId: string) => void;
}

function GanttBlock({ booking, isUnloading = false, onDragStart, onClick }: GanttBlockProps) {
  const time = booking.confirmedTime || booking.timeSlot;
  if (!time) return null;

  const leftPercent = timeToPercent(time);
  const duration = booking.confirmedDuration ?? 1; // 기본 1시간
  const widthPercent = (duration / GANTT_HOURS) * 100;

  // 범위 벗어나는 블록 클리핑
  if (leftPercent >= 100 || leftPercent < 0) return null;

  const clampedWidth = Math.min(widthPercent, 100 - leftPercent);
  const address = booking.address?.slice(0, 20) ?? "";
  const cube = booking.totalLoadingCube ?? 0;

  if (isUnloading) {
    return (
      <div
        className="absolute inset-y-1 flex items-center px-1.5 overflow-hidden rounded z-[1]"
        style={{
          left: `${leftPercent}%`,
          width: `${Math.max(clampedWidth, 3)}%`,
          backgroundColor: "#EEF2F6",
          borderLeft: "3px solid #8A96A8",
        }}
        title="하차지"
      >
        <span className="text-[10px] font-semibold whitespace-nowrap text-text-sub">
          하차지
        </span>
      </div>
    );
  }

  const bg = GANTT_BLOCK_BG[booking.status] || "#F5F5F5";
  const border = GANTT_BLOCK_BORDER[booking.status] || "#9E9E9E";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, booking.id, booking.driverId ?? null, time)}
      onClick={() => onClick(booking.id)}
      className="absolute inset-y-1 flex flex-col justify-center px-1.5 py-0.5 overflow-hidden rounded cursor-grab z-[2] shadow-sm"
      style={{
        left: `${leftPercent}%`,
        width: `${Math.max(clampedWidth, 3)}%`,
        backgroundColor: bg,
        borderLeft: `3px solid ${border}`,
      }}
      title={`${booking.customerName} | ${booking.address} | ${cube}m³`}
    >
      <span className="text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-[1.3]">
        {booking.customerName}
      </span>
      <span className="text-[9px] text-text-sub whitespace-nowrap overflow-hidden text-ellipsis leading-[1.3]">
        {address}
      </span>
      {cube > 0 && (
        <span className="text-[9px] text-text-primary font-semibold leading-[1.3]">
          {cube}m³
        </span>
      )}
    </div>
  );
}

/* ── Gantt 뷰 컴포넌트 ── */

interface GanttViewProps {
  drivers: Driver[];
  bookings: Booking[];
  token: string;
  onBookingUpdated: () => void;
  onBookingClick: (id: string) => void;
}

function GanttView({ drivers, bookings, token, onBookingUpdated, onBookingClick }: GanttViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ driverId: string | null; time: string } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null); // 업데이트 중인 bookingId

  // 기사별 예약 그룹핑
  const driverBookingsMap = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    // 기사 행
    for (const d of drivers) {
      map[d.id] = bookings.filter((b) => b.driverId === d.id);
    }
    // 미배차 행
    map["__unassigned__"] = bookings.filter((b) => !b.driverId);
    return map;
  }, [drivers, bookings]);

  // unloadingStopAfter를 가진 예약 다음에 하차지 블록 삽입용 맵
  const unloadingTargetIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings) {
      if (b.unloadingStopAfter) set.add(b.id);
    }
    return set;
  }, [bookings]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, bookingId: string, driverId: string | null, time: string | null) => {
      setDragState({ bookingId, originalDriverId: driverId, originalTime: time });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", bookingId);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, driverId: string | null) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // 드롭 대상 행의 시간대 계산
      const row = (e.currentTarget as HTMLElement).querySelector("[data-gantt-grid]") as HTMLElement | null;
      if (!row) return;
      const rect = row.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const time = pixelOffsetToTime(offsetX, rect.width);
      setDropTarget({ driverId, time });
    },
    [],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetDriverId: string | null) => {
      e.preventDefault();
      if (!dragState) return;

      const row = (e.currentTarget as HTMLElement).querySelector("[data-gantt-grid]") as HTMLElement | null;
      let confirmedTime = dragState.originalTime;
      if (row) {
        const rect = row.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        confirmedTime = pixelOffsetToTime(offsetX, rect.width);
      }

      const { bookingId, originalDriverId, originalTime } = dragState;

      // 변경 없으면 무시
      if (targetDriverId === originalDriverId && confirmedTime === originalTime) {
        setDragState(null);
        setDropTarget(null);
        return;
      }

      // 낙관적 업데이트를 위해 즉시 상태 반영은 부모 onBookingUpdated 콜백으로 처리
      setUpdating(bookingId);
      setDragState(null);
      setDropTarget(null);

      try {
        const targetDriverName = targetDriverId
          ? drivers.find((d) => d.id === targetDriverId)?.name ?? null
          : null;

        const body: Record<string, unknown> = {
          confirmedTime,
        };
        if (targetDriverId !== originalDriverId) {
          body.driverId = targetDriverId ?? null;
          body.driverName = targetDriverName;
        }

        const res = await fetch(`/api/admin/bookings/${bookingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          console.error("[GanttView] 배차 업데이트 실패", await res.text());
          // 실패 시 부모에서 원래 데이터로 리렌더링
        }
        onBookingUpdated();
      } catch (err) {
        console.error("[GanttView] 배차 업데이트 오류", err);
        onBookingUpdated();
      } finally {
        setUpdating(null);
      }
    },
    [dragState, drivers, token, onBookingUpdated],
  );

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  const hours = Array.from({ length: GANTT_HOURS + 1 }, (_, i) => GANTT_START_HOUR + i);

  const renderRow = (driverId: string | null, driver: Driver | null) => {
    const rowBookings = driverBookingsMap[driverId ?? "__unassigned__"] || [];
    const isDropTarget = dropTarget?.driverId === driverId;

    return (
      <div
        key={driverId ?? "__unassigned__"}
        onDragOver={(e) => handleDragOver(e, driverId)}
        onDrop={(e) => handleDrop(e, driverId)}
        onDragLeave={() => setDropTarget(null)}
        className={`flex border-b border-border-light min-h-[52px] transition-colors duration-150 ${isDropTarget ? "bg-bg-warm" : "bg-bg"}`}
      >
        {/* 기사 정보 컬럼 */}
        <div className="w-[140px] min-w-[140px] px-2.5 py-2 border-r border-border-light flex flex-col justify-center bg-bg-warm">
          {driver ? (
            <>
              <span className="text-xs font-bold text-text-primary">{driver.name}</span>
              <span className="text-[10px] text-text-sub mt-px">
                {driver.vehicleType} · {driver.vehicleCapacity}m³
              </span>
              {driver.licensePlate && (
                <span className="text-[9px] text-text-muted">{driver.licensePlate}</span>
              )}
            </>
          ) : (
            <span className="text-xs font-semibold text-text-muted">미배차</span>
          )}
        </div>

        {/* Gantt 그리드 영역 */}
        <div
          data-gantt-grid
          ref={driverId === (drivers[0]?.id ?? null) ? gridRef : undefined}
          className="flex-1 relative overflow-hidden"
        >
          {/* 시간 격자선 */}
          {Array.from({ length: GANTT_HOURS - 1 }, (_, i) => i + 1).map((i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-[#EEF2F6] pointer-events-none"
              style={{ left: `${(i / GANTT_HOURS) * 100}%` }}
            />
          ))}

          {/* 드롭 타임 표시 */}
          {isDropTarget && dropTarget?.time && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary opacity-70 pointer-events-none z-10"
              style={{ left: `${timeToPercent(dropTarget.time)}%` }}
            />
          )}

          {/* 예약 블록들 */}
          {rowBookings.map((b) => (
            <GanttBlock
              key={b.id}
              booking={b}
              isUnloading={false}
              onDragStart={handleDragStart}
              onClick={onBookingClick}
            />
          ))}

          {/* 하차지 블록 (unloadingStopAfter가 있는 예약 다음) */}
          {rowBookings
            .filter((b) => unloadingTargetIds.has(b.id))
            .map((b) => {
              const time = b.confirmedTime || b.timeSlot;
              if (!time) return null;
              const duration = b.confirmedDuration ?? 1;
              const afterHours = timeToHours(time) + duration;
              if (afterHours >= GANTT_END_HOUR) return null;
              const afterTime = `${String(Math.floor(afterHours)).padStart(2, "0")}:${afterHours % 1 >= 0.5 ? "30" : "00"}`;
              const fakeUnloading = { ...b, confirmedTime: afterTime, confirmedDuration: 0.5 };
              return (
                <GanttBlock
                  key={`${b.id}-unloading`}
                  booking={fakeUnloading as Booking}
                  isUnloading={true}
                  onDragStart={handleDragStart}
                  onClick={onBookingClick}
                />
              );
            })}

          {/* 업데이트 중 오버레이 */}
          {rowBookings.some((b) => b.id === updating) && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/60">
              <span className="text-[11px] text-primary">저장 중...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="border border-border-light rounded-lg overflow-hidden text-xs"
      onDragEnd={handleDragEnd}
    >
      {/* 헤더: 시간축 */}
      <div className="flex border-b-2 border-border-light bg-bg-warm2">
        <div className="w-[140px] min-w-[140px] px-2.5 py-1.5 border-r border-border-light text-[11px] font-semibold text-text-sub">
          기사
        </div>
        <div className="flex-1 relative h-7">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-text-sub font-semibold whitespace-nowrap"
              style={{ left: `${((h - GANTT_START_HOUR) / GANTT_HOURS) * 100}%` }}
            >
              {h}시
            </div>
          ))}
        </div>
      </div>

      {/* 기사별 행 */}
      {drivers.map((d) => renderRow(d.id, d))}

      {/* 미배차 행 */}
      {(driverBookingsMap["__unassigned__"]?.length ?? 0) > 0 && renderRow(null, null)}
    </div>
  );
}

/* ── 메인 페이지 ── */

export default function AdminCalendarPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [slotInfo, setSlotInfo] = useState<Record<string, { available: boolean; count: number }>>({});
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [weeklyBookings, setWeeklyBookings] = useState<Record<string, Booking[]>>({});
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // Gantt 관련 상태
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState(false);
  const [showGantt, setShowGantt] = useState(false);

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

  // Gantt용 기사 목록 fetch
  const fetchDrivers = useCallback(async () => {
    if (!token) return;
    setDriversLoading(true);
    setDriversError(false);
    try {
      const res = await fetch("/api/admin/drivers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("drivers fetch failed");
      const data = await res.json();
      setDrivers(data.drivers || []);
    } catch {
      setDriversError(true);
    } finally {
      setDriversLoading(false);
    }
  }, [token]);

  // Gantt 토글 시 기사 목록 로드
  useEffect(() => {
    if (showGantt && drivers.length === 0 && !driversError) {
      fetchDrivers();
    }
  }, [showGantt, drivers.length, driversError, fetchDrivers]);

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

  const isToday = selectedDate === getToday();
  const headerTitle = viewMode === "daily" ? "일간 캘린더" : "주간 캘린더";

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

            {/* ── 기사별 Gantt 뷰 섹션 ── */}
            {!loading && (
              <div className="mt-8">
                {/* 섹션 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-text-primary">기사별 배차 현황</h2>
                    <span className="text-xs text-text-muted">
                      {formatDate(selectedDate)} · Gantt 뷰
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowGantt((prev) => !prev);
                    }}
                    className="text-xs px-3 py-1.5 rounded-md border border-border-light text-text-sub hover:bg-bg transition-colors font-medium flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="3" width="10" height="2" rx="1" fill="currentColor"/>
                      <rect x="1" y="7" width="7" height="2" rx="1" fill="currentColor"/>
                    </svg>
                    {showGantt ? "접기" : "펼치기"}
                  </button>
                </div>

                {showGantt && (
                  <div className="overflow-x-auto" style={{ minWidth: 0 }}>
                    {driversLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="md" />
                        <span className="ml-2 text-sm text-text-muted">기사 정보 로딩 중...</span>
                      </div>
                    ) : driversError ? (
                      <div className="text-center py-8 text-text-muted text-sm">
                        <p>기사 정보를 불러오지 못했습니다.</p>
                        <button
                          onClick={fetchDrivers}
                          className="mt-2 text-xs text-primary underline"
                        >
                          다시 시도
                        </button>
                      </div>
                    ) : drivers.length === 0 ? (
                      <div className="text-center py-8 text-text-muted text-sm">
                        등록된 기사가 없습니다
                      </div>
                    ) : (
                      <div style={{ minWidth: "700px" }}>
                        {/* 범례 */}
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {(["pending", "quote_confirmed", "user_confirmed", "in_progress", "completed"] as const).map((s) => (
                            <div key={s} className="flex items-center gap-1">
                              <div
                                style={{
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "2px",
                                  backgroundColor: GANTT_BLOCK_BG[s],
                                  borderLeft: `3px solid ${GANTT_BLOCK_BORDER[s]}`,
                                }}
                              />
                              <span className="text-[10px] text-text-muted">{STATUS_LABELS[s]}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-1">
                            <div
                              style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "2px",
                                backgroundColor: "#ECEFF1",
                                borderLeft: "3px solid #90A4AE",
                              }}
                            />
                            <span className="text-[10px] text-text-muted">하차지</span>
                          </div>
                          <span className="text-[10px] text-text-muted ml-auto">드래그로 기사/시간 변경 가능</span>
                        </div>

                        <GanttView
                          drivers={drivers}
                          bookings={dayBookings}
                          token={token}
                          onBookingUpdated={fetchBookings}
                          onBookingClick={(id) => router.push(`/admin/bookings/${id}`)}
                        />
                      </div>
                    )}
                  </div>
                )}
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

      </div>
    </div>
    </>
  );
}
