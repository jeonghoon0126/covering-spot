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

// Gantt 블록 배경색 (불투명 배경, status 기반)
const GANTT_BLOCK_BG: Record<string, string> = {
  pending: "#FFF3E0",
  quote_confirmed: "#E3F2FD",
  user_confirmed: "#E8F5E9",
  change_requested: "#FFF3E0",
  in_progress: "#E3F2FD",
  completed: "#E8F5E9",
  payment_requested: "#FFF3E0",
  payment_completed: "#E8F5E9",
  cancelled: "#FFEBEE",
  rejected: "#F5F5F5",
};

const GANTT_BLOCK_BORDER: Record<string, string> = {
  pending: "#FB8C00",
  quote_confirmed: "#1E88E5",
  user_confirmed: "#43A047",
  change_requested: "#FB8C00",
  in_progress: "#1E88E5",
  completed: "#43A047",
  payment_requested: "#FB8C00",
  payment_completed: "#43A047",
  cancelled: "#E53935",
  rejected: "#9E9E9E",
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
        style={{
          position: "absolute",
          left: `${leftPercent}%`,
          width: `${Math.max(clampedWidth, 3)}%`,
          top: "4px",
          bottom: "4px",
          backgroundColor: "#ECEFF1",
          borderLeft: "3px solid #90A4AE",
          borderRadius: "4px",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          padding: "0 6px",
          overflow: "hidden",
        }}
        title="하차지"
      >
        <span style={{ fontSize: "10px", color: "#607D8B", fontWeight: 600, whiteSpace: "nowrap" }}>
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
      style={{
        position: "absolute",
        left: `${leftPercent}%`,
        width: `${Math.max(clampedWidth, 3)}%`,
        top: "4px",
        bottom: "4px",
        backgroundColor: bg,
        borderLeft: `3px solid ${border}`,
        borderRadius: "4px",
        cursor: "grab",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "2px 6px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      }}
      title={`${booking.customerName} | ${booking.address} | ${cube}m³`}
    >
      <span style={{ fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>
        {booking.customerName}
      </span>
      <span style={{ fontSize: "9px", color: "#546E7A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>
        {address}
      </span>
      {cube > 0 && (
        <span style={{ fontSize: "9px", color: "#37474F", fontWeight: 600, lineHeight: 1.3 }}>
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
        style={{
          display: "flex",
          borderBottom: "1px solid #E0E0E0",
          minHeight: "52px",
          backgroundColor: isDropTarget ? "#F3F4F6" : "white",
          transition: "background-color 0.15s",
        }}
      >
        {/* 기사 정보 컬럼 */}
        <div
          style={{
            width: "140px",
            minWidth: "140px",
            padding: "8px 10px",
            borderRight: "1px solid #E0E0E0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            backgroundColor: "#FAFAFA",
          }}
        >
          {driver ? (
            <>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#212121" }}>{driver.name}</span>
              <span style={{ fontSize: "10px", color: "#757575", marginTop: "1px" }}>
                {driver.vehicleType} · {driver.vehicleCapacity}m³
              </span>
              {driver.licensePlate && (
                <span style={{ fontSize: "9px", color: "#9E9E9E" }}>{driver.licensePlate}</span>
              )}
            </>
          ) : (
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#9E9E9E" }}>미배차</span>
          )}
        </div>

        {/* Gantt 그리드 영역 */}
        <div
          data-gantt-grid
          ref={driverId === (drivers[0]?.id ?? null) ? gridRef : undefined}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* 시간 격자선 */}
          {Array.from({ length: GANTT_HOURS - 1 }, (_, i) => i + 1).map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i / GANTT_HOURS) * 100}%`,
                top: 0,
                bottom: 0,
                width: "1px",
                backgroundColor: "#F0F0F0",
                pointerEvents: "none",
              }}
            />
          ))}

          {/* 드롭 타임 표시 */}
          {isDropTarget && dropTarget?.time && (
            <div
              style={{
                position: "absolute",
                left: `${timeToPercent(dropTarget.time)}%`,
                top: 0,
                bottom: 0,
                width: "2px",
                backgroundColor: "#1976D2",
                opacity: 0.7,
                pointerEvents: "none",
                zIndex: 10,
              }}
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
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(255,255,255,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 20,
              }}
            >
              <span style={{ fontSize: "11px", color: "#1976D2" }}>저장 중...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        border: "1px solid #E0E0E0",
        borderRadius: "8px",
        overflow: "hidden",
        fontSize: "12px",
      }}
      onDragEnd={handleDragEnd}
    >
      {/* 헤더: 시간축 */}
      <div style={{ display: "flex", borderBottom: "2px solid #E0E0E0", backgroundColor: "#F5F5F5" }}>
        <div
          style={{
            width: "140px",
            minWidth: "140px",
            padding: "6px 10px",
            borderRight: "1px solid #E0E0E0",
            fontSize: "11px",
            fontWeight: 600,
            color: "#616161",
          }}
        >
          기사
        </div>
        <div style={{ flex: 1, position: "relative", height: "28px" }}>
          {hours.map((h) => (
            <div
              key={h}
              style={{
                position: "absolute",
                left: `${((h - GANTT_START_HOUR) / GANTT_HOURS) * 100}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "10px",
                color: "#757575",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
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
