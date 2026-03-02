"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Booking, UnloadingPoint } from "@/types/booking";
import type { Driver } from "./types";

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

export const GANTT_STATUS_LABELS: Record<string, string> = {
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

export { GANTT_BLOCK_BG, GANTT_BLOCK_BORDER };

/* ── Gantt 타입 ── */

interface DragState {
  bookingId: string;
  originalDriverId: string | null;
  originalTime: string | null;
}

interface ActiveAddMenuState {
  bookingId: string;
  rect: DOMRect;
}

/* ── 유틸리티 훅 ── */

function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
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

function calculateUnloadingTimeInfo(booking: Booking): { time: string; isValid: boolean } {
  const startTime = booking.confirmedTime || booking.timeSlot;
  if (!startTime) return { time: "", isValid: false };
  const duration = booking.confirmedDuration ?? 1;
  const afterHours = timeToHours(startTime) + duration;
  if (afterHours >= GANTT_END_HOUR) return { time: "", isValid: false };
  const h = Math.floor(afterHours);
  const m = afterHours % 1 >= 0.5 ? 30 : 0;
  return { time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, isValid: true };
}

/* ── GanttBlock 컴포넌트 ── */

interface GanttBlockProps {
  booking: Booking;
  isUnloading?: boolean;
  unloadingPoints?: UnloadingPoint[];
  isUpdating?: boolean;
  driverColorMap: Map<string, string>;
  onDragStart: (e: React.DragEvent, bookingId: string, driverId: string | null, time: string | null) => void;
  onClick: (bookingId: string) => void;
  onRemoveUnloadingStop?: (bookingId: string) => void;
  onToggleAddUnloadingMenu?: (e: React.MouseEvent, bookingId: string) => void;
}

function GanttBlock({
  booking,
  isUnloading = false,
  unloadingPoints,
  isUpdating,
  driverColorMap,
  onDragStart,
  onClick,
  onRemoveUnloadingStop,
  onToggleAddUnloadingMenu,
}: GanttBlockProps) {
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
    const point = unloadingPoints?.find(p => p.id === booking.unloadingStopAfter);
    const pointName = point?.name ?? "하차지";

    return (
      <div
        className="absolute inset-y-1 flex items-center justify-between px-1.5 overflow-visible rounded z-[1] group cursor-default"
        style={{
          left: `${leftPercent}%`,
          width: `${Math.max(clampedWidth, 5)}%`,
          backgroundColor: "#EEF2F6",
          borderLeft: "3px solid #8A96A8",
        }}
        title={pointName}
      >
        <span className="text-[9px] font-bold text-[#374151] truncate">
          {pointName.slice(0, 4)}
        </span>
        {onRemoveUnloadingStop && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveUnloadingStop(booking.id); }}
            disabled={isUpdating}
            className="ml-0.5 flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[#8A96A8] text-white opacity-40 group-hover:opacity-100 transition-opacity disabled:opacity-30 hover:bg-[#6B7280]"
            title="하차지 제거"
          >
            <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
              <path d="M1 1L7 7M1 7L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
    );
  }

  const UNASSIGNED_BG = "#E5E7EB";
  const UNASSIGNED_BORDER = "#9CA3AF";

  const color = booking.driverId ? driverColorMap.get(booking.driverId) : undefined;
  const bg = color ? `${color}4D` : UNASSIGNED_BG;
  const border = color || UNASSIGNED_BORDER;

  const hasUnloadingPoints = unloadingPoints && unloadingPoints.length > 0;
  const hasUnloadingStop = !!booking.unloadingStopAfter;

  return (
    <div
      className="absolute inset-y-1 group z-[2]"
      style={{
        left: `${leftPercent}%`,
        width: `${Math.max(clampedWidth, 3)}%`,
      }}
    >
      <div
        draggable
        onDragStart={(e) => onDragStart(e, booking.id, booking.driverId ?? null, time)}
        onClick={() => onClick(booking.id)}
        className="w-full h-full flex flex-col justify-center px-1.5 py-0.5 overflow-hidden rounded cursor-grab shadow-sm"
        style={{ backgroundColor: bg, borderLeft: `3px solid ${border}` }}
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

      {/* 하차지 추가 버튼 — 하차지 없고 unloadingPoints 있을 때 hover 시 노출 */}
      {!hasUnloadingStop && hasUnloadingPoints && onToggleAddUnloadingMenu && (
        <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 z-[5]">
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleAddUnloadingMenu(e, booking.id); }}
              disabled={isUpdating}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded-full bg-primary text-white shadow disabled:opacity-30 hover:bg-primary-dark"
              title="하차지 추가"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M4 1v6M1 4h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── GanttView 컴포넌트 ── */

export interface GanttViewProps {
  drivers: Driver[];
  bookings: Booking[];
  token: string;
  driverColorMap: Map<string, string>;
  onBookingUpdated: () => void;
  onBookingClick: (id: string) => void;
  unloadingPoints?: UnloadingPoint[];
  onUpdateUnloadingStop?: (bookingId: string, unloadingPointId: string | null) => Promise<void>;
  updatingUnloadingIds?: Set<string>;
}

export default function GanttView({
  drivers,
  bookings,
  token,
  driverColorMap,
  onBookingUpdated,
  onBookingClick,
  unloadingPoints = [],
  onUpdateUnloadingStop,
  updatingUnloadingIds = new Set(),
}: GanttViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ driverId: string | null; time: string } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [localBookings, setLocalBookings] = useState<Booking[]>(() => bookings);
  const [activeAddMenu, setActiveAddMenu] = useState<ActiveAddMenuState | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(addMenuRef, () => setActiveAddMenu(null));

  useEffect(() => {
    if (updating === null) {
      setLocalBookings(bookings);
    }
  }, [bookings, updating]);

  useEffect(() => {
    if (activeAddMenu && updatingUnloadingIds.has(activeAddMenu.bookingId)) {
      setActiveAddMenu(null);
    }
  }, [updatingUnloadingIds, activeAddMenu]);

  const handleToggleAddMenu = useCallback(
    (e: React.MouseEvent, bookingId: string) => {
      e.stopPropagation();
      if (activeAddMenu?.bookingId === bookingId) {
        setActiveAddMenu(null);
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        setActiveAddMenu({ bookingId, rect });
      }
    },
    [activeAddMenu],
  );

  const driverBookingsMap = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const d of drivers) {
      map[d.id] = localBookings.filter((b) => b.driverId === d.id);
    }
    map["__unassigned__"] = localBookings.filter((b) => !b.driverId);
    return map;
  }, [drivers, localBookings]);

  const unloadingTargetIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of localBookings) {
      if (b.unloadingStopAfter) set.add(b.id);
    }
    return set;
  }, [localBookings]);

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
  
      const { bookingId, originalDriverId, originalTime } = dragState;
  
      const row = (e.currentTarget as HTMLElement).querySelector("[data-gantt-grid]") as HTMLElement | null;
      let confirmedTime = originalTime;
      if (row) {
        const rect = row.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        confirmedTime = pixelOffsetToTime(offsetX, rect.width);
      }
  
      if (targetDriverId === originalDriverId && confirmedTime === originalTime) {
        setDragState(null);
        setDropTarget(null);
        return;
      }
  
      const originalBooking = localBookings.find(b => b.id === bookingId);
      if (!originalBooking) return;
  
      const targetDriverName = targetDriverId
        ? drivers.find((d) => d.id === targetDriverId)?.name ?? null
        : null;
  
      const updatedBooking: Booking = {
        ...originalBooking,
        driverId: targetDriverId,
        confirmedTime,
      };
  
      setLocalBookings(prevBookings => 
        prevBookings.map(b => b.id === bookingId ? updatedBooking : b)
      );
      setUpdating(bookingId);
      setDragState(null);
      setDropTarget(null);
  
      try {
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
          throw new Error(await res.text());
        }
        onBookingUpdated();
      } catch (err) {
        console.error("[GanttView] 배차 업데이트 오류, 롤백", err);
        setLocalBookings(prevBookings => 
          prevBookings.map(b => b.id === bookingId ? originalBooking : b)
        );
      } finally {
        setUpdating(null);
      }
    },
    [dragState, drivers, token, onBookingUpdated, localBookings],
  );

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  const hours = Array.from({ length: GANTT_HOURS + 1 }, (_, i) => GANTT_START_HOUR + i);

  const activeMenuBooking = useMemo(
    () => (activeAddMenu ? localBookings.find((b) => b.id === activeAddMenu.bookingId) : null),
    [activeAddMenu, localBookings],
  );

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
          className="flex-1 relative" // overflow-hidden 제거 → 드롭다운 메뉴 잘림 방지
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
              unloadingPoints={unloadingPoints}
              isUpdating={updatingUnloadingIds.has(b.id) || updating === b.id}
              driverColorMap={driverColorMap}
              onDragStart={handleDragStart}
              onClick={onBookingClick}
              onToggleAddUnloadingMenu={onUpdateUnloadingStop ? handleToggleAddMenu : undefined}
            />
          ))}

          {rowBookings
            .filter((b) => unloadingTargetIds.has(b.id))
            .map((b) => {
              const { time, isValid } = calculateUnloadingTimeInfo(b);
              if (!isValid) return null;
              const fakeUnloading = { ...b, confirmedTime: time, confirmedDuration: 0.5 };
              return (
                <GanttBlock
                  key={`${b.id}-unloading`}
                  booking={fakeUnloading as Booking}
                  isUnloading={true}
                  unloadingPoints={unloadingPoints}
                  isUpdating={updatingUnloadingIds.has(b.id)}
                  driverColorMap={driverColorMap}
                  onDragStart={() => {}} // 하차지 블록은 드래그 불가
                  onClick={() => {}} // 하차지 블록은 클릭 불가
                  onRemoveUnloadingStop={onUpdateUnloadingStop ? (bookingId) => onUpdateUnloadingStop(bookingId, null) : undefined}
                />
              );
            })}

          {updating && rowBookings.some((b) => b.id === updating) && (
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

      {/* 하차지 추가 메뉴 (Portal-like) */}
      {activeAddMenu && activeMenuBooking && onUpdateUnloadingStop && (
        <div
          ref={addMenuRef}
          className="bg-bg border border-border-light rounded-lg shadow-lg z-[200] min-w-[140px] py-1"
          style={{
            position: "fixed",
            top: `${activeAddMenu.rect.bottom + 4}px`,
            left: `${activeAddMenu.rect.right}px`,
            transform: "translateX(-100%)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-text-muted border-b border-border-light mb-0.5">
            하차지 선택
          </div>
          {unloadingPoints.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onUpdateUnloadingStop(activeMenuBooking.id, p.id);
                setActiveAddMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-text-primary hover:bg-bg-warm transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

