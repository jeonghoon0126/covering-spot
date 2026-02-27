"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import type { Booking } from "@/types/booking";
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

export interface GanttViewProps {
  drivers: Driver[];
  bookings: Booking[];
  token: string;
  onBookingUpdated: () => void;
  onBookingClick: (id: string) => void;
}

export default function GanttView({ drivers, bookings, token, onBookingUpdated, onBookingClick }: GanttViewProps) {
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
