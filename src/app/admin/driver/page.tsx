"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import DaumPostcodeEmbed from "react-daum-postcode";
import type { Booking } from "@/types/booking";

/* ── 타입 ── */

interface BlockedSlot {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  reason?: string;
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
  workSlots: string;
  initialLoadCube: number;
  startAddress: string | null;
  endAddress: string | null;
}

interface Vehicle {
  id: string;
  name: string;
  type: string;
  capacity: number;
  licensePlate: string | null;
  active: boolean;
}

interface Assignment {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;
  driverName?: string;
  vehicle?: Vehicle;
}

/* ── 상수 ── */

// 슬롯 차단 관리: 시간대 (10:00 ~ 17:00, 1시간 단위)
const SLOT_MGMT_HOURS = Array.from({ length: 8 }, (_, i) => {
  const hour = i + 10;
  return `${String(hour).padStart(2, "0")}:00`;
});

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${weekdays[d.getDay()]})`;
}

function nextHour(time: string): string {
  const hour = parseInt(time.split(":")[0], 10) + 1;
  return `${String(hour).padStart(2, "0")}:00`;
}

const VEHICLE_TYPES = ["1톤", "1.4톤", "2.5톤", "5톤"] as const;
const VEHICLE_CAPACITY: Record<string, number> = {
  "1톤": 4.8, "1.4톤": 6.5, "2.5톤": 10.5, "5톤": 20.0,
};
const ALL_WORK_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/* ── 근무요일 토글 컴포넌트 ── */

function WorkDayToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = new Set(value ? value.split(",") : []);
  function toggle(day: string) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(ALL_WORK_DAYS.filter((d) => next.has(d)).join(","));
  }
  return (
    <div className="flex gap-1">
      {ALL_WORK_DAYS.map((day) => {
        const active = selected.has(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`flex-1 h-8 text-xs font-semibold rounded-sm border transition-colors ${
              active
                ? "bg-primary text-white border-primary"
                : "bg-bg-warm text-text-muted border-border-light"
            } ${day === "토" || day === "일" ? (active ? "bg-primary/80" : "text-text-muted/60") : ""}`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

/* ── 가능 슬롯 토글 컴포넌트 ── */

const SLOT_ORDER = ["오전 (9시~12시)", "오후 (13시~17시)", "저녁 (18시~20시)"] as const;
const SLOT_LABELS: Record<string, string> = {
  "오전 (9시~12시)": "오전",
  "오후 (13시~17시)": "오후",
  "저녁 (18시~20시)": "저녁",
};

function WorkSlotToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // 빈 문자열 = 모든 슬롯 가능 (ALL)
  const selected = new Set(value ? value.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const isAll = selected.size === 0;

  function toggle(slot: string) {
    const next = new Set(selected);
    if (next.has(slot)) {
      next.delete(slot);
    } else {
      next.add(slot);
    }
    // 모두 선택되거나 모두 해제 → 빈 문자열(전체)로 정규화
    if (next.size === 0 || next.size === SLOT_ORDER.length) {
      onChange("");
    } else {
      onChange(SLOT_ORDER.filter((s) => next.has(s)).join(","));
    }
  }

  function setAll() {
    onChange("");
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={setAll}
        className={`px-2 h-8 text-xs font-semibold rounded-sm border transition-colors ${
          isAll
            ? "bg-primary text-white border-primary"
            : "bg-bg-warm text-text-muted border-border-light"
        }`}
      >
        전체
      </button>
      {SLOT_ORDER.map((slot) => {
        const active = !isAll && selected.has(slot);
        return (
          <button
            key={slot}
            type="button"
            onClick={() => toggle(slot)}
            className={`flex-1 h-8 text-xs font-semibold rounded-sm border transition-colors ${
              active
                ? "bg-primary text-white border-primary"
                : "bg-bg-warm text-text-muted border-border-light"
            }`}
          >
            {SLOT_LABELS[slot]}
          </button>
        );
      })}
    </div>
  );
}

/* ── 가능 슬롯 읽기 전용 칩 ── */

function WorkSlotChips({ value }: { value: string }) {
  if (!value) {
    return (
      <div className="flex gap-1 mt-1">
        <span className="text-[11px] px-2 py-0.5 rounded-sm border bg-primary/10 text-primary border-primary/30 font-medium">
          전체 슬롯
        </span>
      </div>
    );
  }
  const selected = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
  return (
    <div className="flex gap-1 mt-1">
      {SLOT_ORDER.filter((s) => selected.has(s)).map((slot) => (
        <span
          key={slot}
          className="text-[11px] px-2 py-0.5 rounded-sm border bg-primary/10 text-primary border-primary/30 font-medium"
        >
          {SLOT_LABELS[slot]}
        </span>
      ))}
    </div>
  );
}

/* ── 근무요일 읽기 전용 칩 ── */

function WorkDayChips({ value }: { value: string }) {
  const selected = new Set(value ? value.split(",") : []);
  return (
    <div className="flex gap-1 mt-2">
      {ALL_WORK_DAYS.map((day) => {
        const active = selected.has(day);
        return (
          <span
            key={day}
            className={`flex-1 h-7 flex items-center justify-center text-[11px] font-semibold rounded-sm border ${
              active
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-bg-warm text-text-muted/50 border-border-light/50"
            }`}
          >
            {day}
          </span>
        );
      })}
    </div>
  );
}

/* ── Gantt 상수 ── */

// Gantt 블록 배경색 — 디자인 시스템 CSS 변수 기준 (globals.css)
const GANTT_BLOCK_BG: Record<string, string> = {
  pending:           "#FFF7E5",
  quote_confirmed:   "#E5F4FF",
  user_confirmed:    "#EDFCF6",
  change_requested:  "#FFF7E5",
  in_progress:       "#E5F4FF",
  completed:         "#EDFCF6",
  payment_requested: "#FFF7E5",
  payment_completed: "#EDFCF6",
  cancelled:         "#FFEBEE",
  rejected:          "#EEF2F6",
};

const GANTT_BLOCK_BORDER: Record<string, string> = {
  pending:           "#FF9C1A",
  quote_confirmed:   "#1AA3FF",
  user_confirmed:    "#07C576",
  change_requested:  "#FF9C1A",
  in_progress:       "#1AA3FF",
  completed:         "#07C576",
  payment_requested: "#FF9C1A",
  payment_completed: "#07C576",
  cancelled:         "#FF3358",
  rejected:          "#8A96A8",
};

const GANTT_STATUS_LABELS: Record<string, string> = {
  pending: "접수",
  quote_confirmed: "견적확정",
  user_confirmed: "견적확인완료",
  change_requested: "일정변경",
  in_progress: "진행중",
  completed: "수거완료",
};

// Gantt 시간 범위: 09:00 ~ 19:00 (10개 구간)
const GANTT_START_HOUR = 9;
const GANTT_END_HOUR = 19;
const GANTT_HOURS = GANTT_END_HOUR - GANTT_START_HOUR; // 10

/* ── Gantt 타입 ── */

interface DragState {
  bookingId: string;
  originalDriverId: string | null;
  originalTime: string | null;
}

/* ── Gantt 유틸 ── */

function timeToHours(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + m / 60;
}

function timeToPercent(timeStr: string): number {
  const hours = timeToHours(timeStr);
  return ((hours - GANTT_START_HOUR) / GANTT_HOURS) * 100;
}

function pixelOffsetToTime(offsetPx: number, totalWidth: number): string {
  const ratio = Math.max(0, Math.min(1, offsetPx / totalWidth));
  const hours = GANTT_START_HOUR + ratio * GANTT_HOURS;
  const h = Math.floor(hours);
  const m = hours - h >= 0.5 ? 30 : 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ── GanttBlock 컴포넌트 ── */

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
  const duration = booking.confirmedDuration ?? 1;
  const widthPercent = (duration / GANTT_HOURS) * 100;

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
        <span className="text-[10px] font-semibold whitespace-nowrap text-text-sub">하차지</span>
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
        <span className="text-[9px] text-text-primary font-semibold leading-[1.3]">{cube}m³</span>
      )}
    </div>
  );
}

/* ── GanttView 컴포넌트 ── */

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
  const [updating, setUpdating] = useState<string | null>(null);

  const driverBookingsMap = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const d of drivers) {
      map[d.id] = bookings.filter((b) => b.driverId === d.id);
    }
    map["__unassigned__"] = bookings.filter((b) => !b.driverId);
    return map;
  }, [drivers, bookings]);

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

  const handleDragOver = useCallback((e: React.DragEvent, driverId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const row = (e.currentTarget as HTMLElement).querySelector("[data-gantt-grid]") as HTMLElement | null;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const time = pixelOffsetToTime(offsetX, rect.width);
    setDropTarget({ driverId, time });
  }, []);

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

      if (targetDriverId === originalDriverId && confirmedTime === originalTime) {
        setDragState(null);
        setDropTarget(null);
        return;
      }

      setUpdating(bookingId);
      setDragState(null);
      setDropTarget(null);

      try {
        const targetDriverName = targetDriverId
          ? drivers.find((d) => d.id === targetDriverId)?.name ?? null
          : null;

        const body: Record<string, unknown> = { confirmedTime };
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

        <div
          data-gantt-grid
          ref={driverId === (drivers[0]?.id ?? null) ? gridRef : undefined}
          className="flex-1 relative overflow-hidden"
        >
          {Array.from({ length: GANTT_HOURS - 1 }, (_, i) => i + 1).map((i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-[#EEF2F6] pointer-events-none"
              style={{ left: `${(i / GANTT_HOURS) * 100}%` }}
            />
          ))}

          {isDropTarget && dropTarget?.time && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary opacity-70 pointer-events-none z-10"
              style={{ left: `${timeToPercent(dropTarget.time)}%` }}
            />
          )}

          {rowBookings.map((b) => (
            <GanttBlock
              key={b.id}
              booking={b}
              isUnloading={false}
              onDragStart={handleDragStart}
              onClick={onBookingClick}
            />
          ))}

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
    <div className="border border-border-light rounded-lg overflow-hidden text-xs" onDragEnd={handleDragEnd}>
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

/* ── 탭 타입 ── */

type FilterTab = "all" | "active" | "inactive";

/* ── 메인 ── */

export default function AdminDriverManagePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  // 기사 추가 폼 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newVehicleType, setNewVehicleType] = useState("1톤");
  const [newLicensePlate, setNewLicensePlate] = useState("");
  const [newWorkDays, setNewWorkDays] = useState("월,화,수,목,금,토");
  const [newWorkSlots, setNewWorkSlots] = useState("");
  const [newInitialLoadCube, setNewInitialLoadCube] = useState(0);
  const [newStartAddress, setNewStartAddress] = useState("");
  const [newEndAddress, setNewEndAddress] = useState("");
  const [showNewStartPostcode, setShowNewStartPostcode] = useState(false);
  const [showNewEndPostcode, setShowNewEndPostcode] = useState(false);

  // 기사 수정 폼 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("1톤");
  const [editLicensePlate, setEditLicensePlate] = useState("");
  const [editWorkDays, setEditWorkDays] = useState("월,화,수,목,금,토");
  const [editWorkSlots, setEditWorkSlots] = useState("");
  const [editInitialLoadCube, setEditInitialLoadCube] = useState(0);
  const [editStartAddress, setEditStartAddress] = useState("");
  const [editEndAddress, setEditEndAddress] = useState("");
  const [showEditStartPostcode, setShowEditStartPostcode] = useState(false);
  const [showEditEndPostcode, setShowEditEndPostcode] = useState(false);

  const [saving, setSaving] = useState(false);

  // 기사-차량 배정 상태
  const [assignDate, setAssignDate] = useState(getToday());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [assignError, setAssignError] = useState("");

  // 슬롯 차단 관리 상태
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [slotMgmtDate, setSlotMgmtDate] = useState(getToday());
  const [selectedDriverId, setSelectedDriverId] = useState<string>("all");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotActionLoading, setSlotActionLoading] = useState<string | null>(null);
  const [slotBookings, setSlotBookings] = useState<{ id: string; confirmedTime: string | null; timeSlot: string }[]>([]);

  // 기사별 배차 Gantt 상태
  const [ganttDate, setGanttDate] = useState(getToday());
  const [ganttBookings, setGanttBookings] = useState<Booking[]>([]);
  const [ganttLoading, setGanttLoading] = useState(false);
  const [showGantt, setShowGantt] = useState(false);

  // 토스트
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  /* ── toast timer cleanup ── */
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

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

  /* ── 기사 fetch ── */

  const fetchDrivers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/drivers?active=false", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setAllDrivers(data.drivers || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  /* ── 기사 추가 ── */

  async function handleCreateDriver() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.replace(/-/g, "").trim() || undefined,
          vehicleType: newVehicleType,
          vehicleCapacity: VEHICLE_CAPACITY[newVehicleType] || 4.8,
          licensePlate: newLicensePlate.trim() || undefined,
          workDays: newWorkDays,
          workSlots: newWorkSlots,
          initialLoadCube: newInitialLoadCube || undefined,
          startAddress: newStartAddress.trim() || undefined,
          endAddress: newEndAddress.trim() || undefined,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewPhone("");
        setNewVehicleType("1톤");
        setNewLicensePlate("");
        setNewWorkDays("월,화,수,목,금,토");
        setNewWorkSlots("");
        setNewInitialLoadCube(0);
        setNewStartAddress("");
        setNewEndAddress("");
        setShowAddForm(false);
        fetchDrivers();
      } else {
        const data = await res.json();
        showToast(data.error || "추가 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  /* ── 기사 수정 ── */

  async function handleUpdateDriver(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id,
          name: editName.trim() || undefined,
          phone: editPhone.replace(/-/g, "").trim() || undefined,
          vehicleType: editVehicleType,
          vehicleCapacity: VEHICLE_CAPACITY[editVehicleType] || 4.8,
          licensePlate: editLicensePlate.trim() || undefined,
          workDays: editWorkDays,
          workSlots: editWorkSlots,
          initialLoadCube: editInitialLoadCube,
          startAddress: editStartAddress.trim() || null,
          endAddress: editEndAddress.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchDrivers();
      } else {
        const data = await res.json();
        showToast(data.error || "수정 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  /* ── 기사-차량 배정 ── */

  const fetchAssignmentsAndVehicles = useCallback(async () => {
    if (!token) return;
    setAssignLoading(true);
    try {
      const [aRes, vRes] = await Promise.all([
        fetch(`/api/admin/assignments?date=${assignDate}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/vehicles", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [aData, vData] = await Promise.all([aRes.json(), vRes.json()]);
      setAssignments(aData.assignments || []);
      setVehicles(vData.vehicles || []);
    } catch {
      // ignore
    } finally {
      setAssignLoading(false);
    }
  }, [token, assignDate]);

  useEffect(() => {
    fetchAssignmentsAndVehicles();
  }, [fetchAssignmentsAndVehicles]);

  async function handleCreateAssignment(driverId: string, vehicleId: string) {
    if (!token || !vehicleId) return;
    setAssignError("");
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driverId, vehicleId, date: assignDate }),
      });
      const data = await res.json();
      if (!res.ok) { setAssignError(data.error || "배정 실패"); return; }
      setAssignments((prev) => [...prev, data.assignment]);
      setAssigningDriverId(null);
      setSelectedVehicleId("");
    } catch {
      setAssignError("네트워크 오류");
    }
  }

  async function handleDeleteAssignment(id: string) {
    if (!token) return;
    const res = await fetch(`/api/admin/assignments?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    }
  }

  /* ── 슬롯 차단 관리 ── */

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
      const res = await fetch(`/api/admin/bookings?dateFrom=${slotMgmtDate}&dateTo=${slotMgmtDate}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSlotBookings(
          (data.bookings || []).filter(
            (b: { date: string; status: string }) =>
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
    fetchBlockedSlots();
    fetchSlotBookings();
  }, [fetchBlockedSlots, fetchSlotBookings]);

  /* ── Gantt 배차 현황 fetch ── */

  const fetchGanttBookings = useCallback(async () => {
    if (!token) return;
    setGanttLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings?dateFrom=${ganttDate}&dateTo=${ganttDate}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGanttBookings(
          (data.bookings || []).filter(
            (b: { date: string; status: string }) =>
              b.date === ganttDate &&
              b.status !== "cancelled" &&
              b.status !== "rejected",
          ),
        );
      }
    } catch {
      // ignore
    } finally {
      setGanttLoading(false);
    }
  }, [token, ganttDate]);

  useEffect(() => {
    if (showGantt) fetchGanttBookings();
  }, [showGantt, fetchGanttBookings]);

  async function handleBlockSlot(timeStart: string) {
    const timeEnd = nextHour(timeStart);
    const driverId = selectedDriverId !== "all" ? selectedDriverId : undefined;
    setSlotActionLoading(timeStart);
    try {
      const res = await fetch("/api/admin/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: slotMgmtDate, timeStart, timeEnd, reason: "관리자 수동 차단", driverId: driverId || null }),
      });
      if (res.ok) {
        fetchBlockedSlots();
      } else {
        const data = await res.json();
        showToast(data.error || "차단 실패");
      }
    } catch {
      showToast("네트워크 오류");
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
        showToast(data.error || "해제 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setSlotActionLoading(null);
    }
  }

  /* ── 슬롯 계산 ── */

  const slotBookingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of slotBookings) {
      const time = b.confirmedTime || b.timeSlot;
      if (!time) continue;
      const hour = time.split(":")[0];
      const key = `${hour}:00`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [slotBookings]);

  const blockedSlotMap = useMemo(() => {
    const map: Record<string, BlockedSlot> = {};
    for (const slot of blockedSlots) {
      map[slot.timeStart] = slot;
    }
    return map;
  }, [blockedSlots]);

  const isSlotMgmtToday = slotMgmtDate === getToday();

  /* ── 활성화 토글 ── */

  async function handleToggleActive(driver: Driver) {
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: driver.id, active: !driver.active }),
      });
      if (res.ok) {
        fetchDrivers();
      } else {
        const data = await res.json();
        showToast(data.error || "변경 실패");
      }
    } catch {
      showToast("네트워크 오류");
    }
  }

  /* ── 필터 ── */

  const activeCount = allDrivers.filter((d) => d.active).length;
  const inactiveCount = allDrivers.filter((d) => !d.active).length;

  const filteredDrivers =
    filterTab === "active"
      ? allDrivers.filter((d) => d.active)
      : filterTab === "inactive"
      ? allDrivers.filter((d) => !d.active)
      : allDrivers;

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "전체", count: allDrivers.length },
    { key: "active", label: "활성", count: activeCount },
    { key: "inactive", label: "비활성", count: inactiveCount },
  ];

  /* ── 렌더 ── */

  return (
    <>
      <div className="min-h-screen bg-bg-warm">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
          <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold">기사 관리</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => router.push("/admin/vehicles")}
                className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
              >
                차량
              </button>
              <button
                onClick={() => router.push("/admin/calendar")}
                className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
              >
                캘린더
              </button>
              <button
                onClick={() => router.push("/admin/dispatch")}
                className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
              >
                배차
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[42rem] mx-auto px-4 py-4">
          {/* 탭 필터 + 추가 버튼 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1.5">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    filterTab === tab.key
                      ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                      : "bg-bg text-text-sub border border-border-light"
                  }`}
                >
                  {tab.label}{" "}
                  <span className={filterTab === tab.key ? "text-white/70" : "text-text-muted"}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (!showAddForm) {
                  // 폼을 열 때 이전 입력값 초기화
                  setNewName("");
                  setNewPhone("");
                  setNewVehicleType("1톤");
                  setNewLicensePlate("");
                  setNewWorkDays("월,화,수,목,금,토");
                  setNewWorkSlots("");
                  setNewInitialLoadCube(0);
                  setNewStartAddress("");
                  setNewEndAddress("");
                }
                setShowAddForm(!showAddForm);
                setEditingId(null);
              }}
              className="text-xs font-semibold text-white bg-primary rounded-md px-3 py-1.5 hover:bg-primary-dark active:scale-[0.97] transition-all"
            >
              {showAddForm ? "취소" : "+ 기사 추가"}
            </button>
          </div>

          {/* 기사 추가 인라인 폼 */}
          {showAddForm && (
            <div className="bg-bg rounded-lg border border-primary/30 p-4 mb-4 space-y-3">
              <p className="text-xs font-bold text-text-primary">새 기사 추가</p>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">이름 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="기사님 이름"
                  className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">연락처</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-text-muted font-medium mb-1">차량종류</label>
                  <select
                    value={newVehicleType}
                    onChange={(e) => setNewVehicleType(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  >
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v} value={v}>{v} ({VEHICLE_CAPACITY[v]}m³)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-text-muted font-medium mb-1">차량번호</label>
                  <input
                    type="text"
                    value={newLicensePlate}
                    onChange={(e) => setNewLicensePlate(e.target.value)}
                    placeholder="서울12가3456"
                    className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">근무요일</label>
                <WorkDayToggle value={newWorkDays} onChange={setNewWorkDays} />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">가능 슬롯 <span className="text-text-muted/60 font-normal">(전체 = 제한 없음)</span></label>
                <WorkSlotToggle value={newWorkSlots} onChange={setNewWorkSlots} />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">
                  초기 적재량 <span className="text-text-muted/60 font-normal">(m³, 전날 미하차 분)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  value={newInitialLoadCube}
                  onChange={(e) => setNewInitialLoadCube(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">
                  출발지 주소 <span className="text-text-muted/60 font-normal">(가장 가까운 수거지 우선 배정)</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewStartPostcode(true)}
                    className="flex-1 h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  >
                    {newStartAddress ? (
                      <span className="text-text-primary">{newStartAddress}</span>
                    ) : (
                      <span className="text-text-muted">주소 검색</span>
                    )}
                  </button>
                  {newStartAddress && (
                    <button
                      type="button"
                      onClick={() => setNewStartAddress("")}
                      className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md border border-border-light bg-bg-warm text-text-muted hover:text-text-primary transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">
                  퇴근지 주소 <span className="text-text-muted/60 font-normal">(귀가 동선 참고용)</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewEndPostcode(true)}
                    className="flex-1 h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  >
                    {newEndAddress ? (
                      <span className="text-text-primary">{newEndAddress}</span>
                    ) : (
                      <span className="text-text-muted">주소 검색</span>
                    )}
                  </button>
                  {newEndAddress && (
                    <button
                      type="button"
                      onClick={() => setNewEndAddress("")}
                      className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md border border-border-light bg-bg-warm text-text-muted hover:text-text-primary transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={handleCreateDriver}
                disabled={saving || !newName.trim()}
                className="w-full h-10 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? "추가 중..." : "추가"}
              </button>
            </div>
          )}

          {/* 기사 목록 */}
          {loading ? (
            <div className="text-center py-12 text-text-muted text-sm">불러오는 중...</div>
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">
              {filterTab === "active" ? "활성 기사가 없습니다" : filterTab === "inactive" ? "비활성 기사가 없습니다" : "등록된 기사가 없습니다"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDrivers.map((driver) => {
                const isEditing = editingId === driver.id;

                return (
                  <div
                    key={driver.id}
                    className={`bg-bg rounded-lg border p-4 transition-all ${
                      driver.active ? "border-border-light" : "border-border-light/50 opacity-60"
                    }`}
                  >
                    {isEditing ? (
                      /* 인라인 수정 모드 */
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-text-muted mb-2">수정 중</p>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="이름"
                          className="w-full h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                        />
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="연락처"
                          className="w-full h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editVehicleType}
                            onChange={(e) => setEditVehicleType(e.target.value)}
                            className="h-9 px-2 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                          >
                            {VEHICLE_TYPES.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editLicensePlate}
                            onChange={(e) => setEditLicensePlate(e.target.value)}
                            placeholder="차량번호"
                            className="h-9 px-2 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-text-muted font-medium mb-1">근무요일</label>
                          <WorkDayToggle value={editWorkDays} onChange={setEditWorkDays} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-text-muted font-medium mb-1">가능 슬롯 <span className="text-text-muted/60 font-normal">(전체 = 제한 없음)</span></label>
                          <WorkSlotToggle value={editWorkSlots} onChange={setEditWorkSlots} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-text-muted font-medium mb-1">
                            초기 적재량 <span className="text-text-muted/60 font-normal">(m³)</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={30}
                            step={0.1}
                            value={editInitialLoadCube}
                            onChange={(e) => setEditInitialLoadCube(parseFloat(e.target.value) || 0)}
                            className="w-full h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-text-muted font-medium mb-1">출발지 주소</label>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowEditStartPostcode(true)}
                              className="flex-1 h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                            >
                              {editStartAddress ? (
                                <span className="text-text-primary">{editStartAddress}</span>
                              ) : (
                                <span className="text-text-muted">주소 검색</span>
                              )}
                            </button>
                            {editStartAddress && (
                              <button
                                type="button"
                                onClick={() => setEditStartAddress("")}
                                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-sm border border-border-light bg-bg-warm text-text-muted hover:text-text-primary transition-colors text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-text-muted font-medium mb-1">퇴근지 주소</label>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowEditEndPostcode(true)}
                              className="flex-1 h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                            >
                              {editEndAddress ? (
                                <span className="text-text-primary">{editEndAddress}</span>
                              ) : (
                                <span className="text-text-muted">주소 검색</span>
                              )}
                            </button>
                            {editEndAddress && (
                              <button
                                type="button"
                                onClick={() => setEditEndAddress("")}
                                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-sm border border-border-light bg-bg-warm text-text-muted hover:text-text-primary transition-colors text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleUpdateDriver(driver.id)}
                            disabled={saving}
                            className="flex-1 h-9 rounded-sm bg-primary text-white text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            {saving ? "..." : "저장"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 h-9 rounded-sm bg-bg-warm text-text-sub text-xs font-medium border border-border-light active:scale-[0.98] transition-all"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 보기 모드 */
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                driver.active ? "bg-semantic-green" : "bg-text-muted"
                              }`} />
                              <span className="text-sm font-semibold text-text-primary">
                                {driver.name}
                              </span>
                              <span className="text-xs text-primary font-medium">
                                {driver.vehicleType || "1톤"}
                              </span>
                              {driver.licensePlate && (
                                <span className="text-xs text-text-muted">
                                  {driver.licensePlate}
                                </span>
                              )}
                              {!driver.active && (
                                <span className="text-[10px] font-medium text-text-muted bg-fill-tint px-1.5 py-0.5 rounded">
                                  비활성
                                </span>
                              )}
                            </div>
                            {driver.phone && (
                              <p className="text-xs text-text-muted mt-1 ml-4">{driver.phone}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingId(driver.id);
                                setEditName(driver.name);
                                setEditPhone(driver.phone || "");
                                setEditVehicleType(driver.vehicleType || "1톤");
                                setEditLicensePlate(driver.licensePlate || "");
                                setEditWorkDays(driver.workDays || "월,화,수,목,금,토");
                                setEditWorkSlots(driver.workSlots || "");
                                setEditInitialLoadCube(driver.initialLoadCube || 0);
                                setEditStartAddress(driver.startAddress || "");
                                setEditEndAddress(driver.endAddress || "");
                                setShowAddForm(false);
                              }}
                              className="text-[11px] font-medium text-text-sub hover:text-text-primary px-2 py-1.5 rounded-sm hover:bg-bg-warm transition-colors"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleToggleActive(driver)}
                              className={`text-[11px] font-medium px-2 py-1.5 rounded-sm transition-colors ${
                                driver.active
                                  ? "text-semantic-red hover:bg-red-50"
                                  : "text-semantic-green hover:bg-green-50"
                              }`}
                            >
                              {driver.active ? "비활성화" : "활성화"}
                            </button>
                          </div>
                        </div>
                        {/* 근무요일 칩 */}
                        <WorkDayChips value={driver.workDays || ""} />
                        {/* 가능 슬롯 칩 */}
                        <WorkSlotChips value={driver.workSlots || ""} />
                        {/* 초기 적재량 / 출발지 / 퇴근지 */}
                        {(driver.initialLoadCube > 0 || driver.startAddress || driver.endAddress) && (
                          <div className="mt-2 space-y-0.5">
                            {driver.initialLoadCube > 0 && (
                              <p className="text-[11px] text-text-muted">
                                초기 적재: <span className="text-text-primary font-medium">{driver.initialLoadCube}m³</span>
                              </p>
                            )}
                            {driver.startAddress && (
                              <p className="text-[11px] text-text-muted truncate">
                                출발: <span className="text-text-sub">{driver.startAddress}</span>
                              </p>
                            )}
                            {driver.endAddress && (
                              <p className="text-[11px] text-text-muted truncate">
                                퇴근: <span className="text-text-sub">{driver.endAddress}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 기사-차량 일별 배정 ── */}
      <div className="max-w-[42rem] mx-auto px-4">
        <div className="mt-8 mb-4 border-t border-border-light pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-primary mb-1">기사-차량 일별 배정</h2>
              <p className="text-[11px] text-text-muted">특정일에 기사와 차량을 매칭합니다</p>
            </div>
            <button
              onClick={() => router.push("/admin/vehicles")}
              className="text-xs text-primary font-medium hover:underline"
            >
              차량 관리 →
            </button>
          </div>
        </div>

        {/* 날짜 선택 */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setAssignDate(addDays(assignDate, -1))}
            className="shrink-0 p-2 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <input
            type="date"
            value={assignDate}
            onChange={(e) => setAssignDate(e.target.value)}
            className="flex-1 h-10 px-3 rounded-md border border-border-light bg-bg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          <button
            onClick={() => setAssignDate(addDays(assignDate, 1))}
            className="shrink-0 p-2 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {vehicles.length === 0 && (
          <div className="text-center py-6 text-text-muted text-xs border border-dashed border-border-light rounded-lg">
            차량이 없습니다.{" "}
            <button onClick={() => router.push("/admin/vehicles")} className="text-primary font-medium hover:underline">
              차량 먼저 등록하세요 →
            </button>
          </div>
        )}

        {assignError && (
          <p className="text-xs text-red-500 mb-2">{assignError}</p>
        )}

        {assignLoading ? (
          <div className="text-center py-6 text-text-muted text-xs">불러오는 중...</div>
        ) : (
          <div className="space-y-2">
            {allDrivers.filter((d) => d.active).map((driver) => {
              const assignment = assignments.find((a) => a.driverId === driver.id);
              const isAssigning = assigningDriverId === driver.id;

              return (
                <div key={driver.id} className="bg-bg rounded-lg border border-border-light p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-text-primary">{driver.name}</span>
                      {assignment ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-semantic-green shrink-0" />
                          <span className="text-xs text-text-sub">
                            {assignment.vehicle?.name} ({assignment.vehicle?.type} · {assignment.vehicle?.capacity}m³)
                          </span>
                          {assignment.vehicle?.licensePlate && (
                            <span className="text-xs text-text-muted">{assignment.vehicle.licensePlate}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-text-muted shrink-0" />
                          <span className="text-xs text-text-muted">차량 미배정</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {assignment ? (
                        <button
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          className="text-[11px] font-medium text-semantic-red px-2 py-1 rounded-sm hover:bg-red-50 transition-colors"
                        >
                          해제
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setAssigningDriverId(isAssigning ? null : driver.id);
                            setSelectedVehicleId("");
                            setAssignError("");
                          }}
                          className="text-[11px] font-medium text-primary px-2 py-1 rounded-sm hover:bg-primary/5 transition-colors"
                        >
                          {isAssigning ? "취소" : "배정"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 차량 선택 드롭다운 (배정 모드) */}
                  {isAssigning && !assignment && (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="flex-1 h-9 px-2 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                      >
                        <option value="">차량 선택</option>
                        {vehicles
                          .filter((v) => !assignments.find((a) => a.vehicleId === v.id))
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.type} · {v.capacity}m³{v.licensePlate ? ` · ${v.licensePlate}` : ""})
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => handleCreateAssignment(driver.id, selectedVehicleId)}
                        disabled={!selectedVehicleId}
                        className="shrink-0 h-9 px-4 bg-primary text-white text-xs font-semibold rounded-sm hover:bg-primary-dark disabled:opacity-40 transition-colors"
                      >
                        확인
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 기사별 배차 현황 (Gantt) ── */}
      <div className="max-w-[56rem] mx-auto px-4">
        <div className="mt-8 mb-4 border-t border-border-light pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-primary mb-1">기사별 배차 현황</h2>
              <p className="text-[11px] text-text-muted">시간 블록을 드래그해 기사·시간을 변경할 수 있습니다</p>
            </div>
            <button
              onClick={() => setShowGantt((prev) => !prev)}
              className="text-xs px-3 py-1.5 rounded-md border border-border-light text-text-sub hover:bg-bg transition-colors font-medium flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="3" width="10" height="2" rx="1" fill="currentColor"/>
                <rect x="1" y="7" width="7" height="2" rx="1" fill="currentColor"/>
              </svg>
              {showGantt ? "접기" : "펼치기"}
            </button>
          </div>
        </div>

        {showGantt && (
          <div className="mb-8">
            {/* 날짜 선택 */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setGanttDate(addDays(ganttDate, -1))}
                className="shrink-0 p-2 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <input
                type="date"
                value={ganttDate}
                onChange={(e) => setGanttDate(e.target.value)}
                className="flex-1 h-10 px-3 rounded-md border border-border-light bg-bg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <button
                onClick={() => setGanttDate(addDays(ganttDate, 1))}
                className="shrink-0 p-2 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={fetchGanttBookings}
                className="shrink-0 h-10 px-3 rounded-md border border-border-light text-text-sub hover:bg-bg-warm transition-colors text-xs font-medium"
              >
                새로고침
              </button>
            </div>

            {/* Gantt 본문 */}
            <div className="overflow-x-auto" style={{ minWidth: 0 }}>
              {ganttLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                  <span className="ml-2 text-sm text-text-muted">불러오는 중...</span>
                </div>
              ) : allDrivers.filter((d) => d.active).length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm">등록된 기사가 없습니다</div>
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
                        <span className="text-[10px] text-text-muted">{GANTT_STATUS_LABELS[s]}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1">
                      <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "#ECEFF1", borderLeft: "3px solid #90A4AE" }} />
                      <span className="text-[10px] text-text-muted">하차지</span>
                    </div>
                    <span className="text-[10px] text-text-muted ml-auto">드래그로 기사/시간 변경 가능</span>
                  </div>

                  <GanttView
                    drivers={allDrivers.filter((d) => d.active)}
                    bookings={ganttBookings}
                    token={token}
                    onBookingUpdated={fetchGanttBookings}
                    onBookingClick={(id) => router.push(`/admin/bookings/${id}`)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 슬롯 차단 관리 ── */}
      <div className="max-w-[42rem] mx-auto px-4 pb-8">
        <div className="mt-8 mb-4 border-t border-border-light pt-6">
          <h2 className="text-sm font-bold text-text-primary mb-1">슬롯 차단 관리</h2>
          <p className="text-[11px] text-text-muted">특정 날짜/시간에 신규 예약을 차단합니다</p>
        </div>

        {/* 날짜 + 기사 선택 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-[11px] text-text-muted font-medium mb-1">날짜</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSlotMgmtDate(addDays(slotMgmtDate, -1))}
                className="shrink-0 p-2 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <input
                type="date"
                value={slotMgmtDate}
                onChange={(e) => setSlotMgmtDate(e.target.value)}
                className="flex-1 h-10 px-3 rounded-md border border-border-light bg-bg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <button
                onClick={() => setSlotMgmtDate(addDays(slotMgmtDate, 1))}
                className="shrink-0 p-2 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            {!isSlotMgmtToday && (
              <button
                onClick={() => setSlotMgmtDate(getToday())}
                className="text-[11px] text-primary font-medium mt-1 hover:underline"
              >
                오늘로 이동
              </button>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-text-muted font-medium mb-1">기사 선택</label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border-light bg-bg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="all">전체</option>
              {allDrivers.filter((d) => d.active).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.phone ? ` (${d.phone})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-text-muted text-center mb-3">
          {formatDate(slotMgmtDate)} ·{" "}
          {blockedSlots.length > 0 ? `차단 ${blockedSlots.length}개` : "차단 없음"} ·{" "}
          예약 {slotBookings.length}건
        </p>

        {/* 시간대 그리드 */}
        {slotsLoading ? (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="bg-bg rounded-lg border border-border-light overflow-hidden">
            {SLOT_MGMT_HOURS.map((time) => {
              const blocked = blockedSlotMap[time];
              const bookingCount = slotBookingCounts[time] || 0;
              const isActionLoading = slotActionLoading === time;
              return (
                <div
                  key={time}
                  className={`flex items-stretch border-b border-border-light/50 last:border-0 transition-colors ${blocked ? "bg-red-50" : ""}`}
                >
                  <div className="w-16 shrink-0 py-3 pr-2 text-right flex flex-col justify-center">
                    <span className={`text-xs font-medium ${blocked ? "text-semantic-red" : bookingCount > 0 ? "text-text-primary" : "text-text-muted"}`}>
                      {time}
                    </span>
                  </div>
                  <div className="flex-1 border-l border-border-light min-h-[3rem] flex items-center px-3 gap-3">
                    {bookingCount > 0 && (
                      <span className="text-[11px] font-medium text-text-sub bg-bg-warm px-2 py-1 rounded-sm">
                        예약 {bookingCount}건
                      </span>
                    )}
                    {blocked ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-semantic-red shrink-0" />
                          <span className="text-xs font-medium text-semantic-red">차단됨</span>
                        </span>
                        {blocked.reason && (
                          <span className="text-[11px] text-text-muted truncate">{blocked.reason}</span>
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

      {/* 주소 검색 팝업 - 추가 폼 출발지 */}
      {showNewStartPostcode && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim"
          onClick={() => setShowNewStartPostcode(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <DaumPostcodeEmbed
              onComplete={(data) => {
                setNewStartAddress(data.roadAddress || data.jibunAddress);
                setShowNewStartPostcode(false);
              }}
              style={{ height: 400 }}
            />
          </div>
        </div>
      )}

      {/* 주소 검색 팝업 - 추가 폼 퇴근지 */}
      {showNewEndPostcode && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim"
          onClick={() => setShowNewEndPostcode(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <DaumPostcodeEmbed
              onComplete={(data) => {
                setNewEndAddress(data.roadAddress || data.jibunAddress);
                setShowNewEndPostcode(false);
              }}
              style={{ height: 400 }}
            />
          </div>
        </div>
      )}

      {/* 주소 검색 팝업 - 수정 폼 출발지 */}
      {showEditStartPostcode && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim"
          onClick={() => setShowEditStartPostcode(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <DaumPostcodeEmbed
              onComplete={(data) => {
                setEditStartAddress(data.roadAddress || data.jibunAddress);
                setShowEditStartPostcode(false);
              }}
              style={{ height: 400 }}
            />
          </div>
        </div>
      )}

      {/* 주소 검색 팝업 - 수정 폼 퇴근지 */}
      {showEditEndPostcode && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim"
          onClick={() => setShowEditEndPostcode(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <DaumPostcodeEmbed
              onComplete={(data) => {
                setEditEndAddress(data.roadAddress || data.jibunAddress);
                setShowEditEndPostcode(false);
              }}
              style={{ height: 400 }}
            />
          </div>
        </div>
      )}

      {/* 에러 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-text-primary text-bg text-sm font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </>
  );
}
