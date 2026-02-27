"use client";

import type { Booking } from "@/types/booking";
import type { DriverStats } from "./dispatch-utils";
import { SLOT_ORDER, SLOT_LABELS, UNASSIGNED_COLOR, getToday } from "./dispatch-utils";
import { AdminLogo } from "@/components/ui/AdminLogo";

/* ── 타입 ── */

export interface DispatchHeaderProps {
  selectedDate: string;
  filterDriverId: string;
  filterSlot: string;
  activeBookings: Booking[];
  unassignedCount: number;
  driverStats: DriverStats[];
  driverColorMap: Map<string, string>;
  onDateChange: (date: string) => void;
  onMoveDate: (delta: number) => void;
  onFilterDriverChange: (value: string) => void;
  onFilterSlotChange: (value: string) => void;
  onNavigateCalendar: () => void;
  onNavigateDriver: () => void;
}

/* ── 헤더 (날짜, 필터, 범례) ── */

export default function DispatchHeader({
  selectedDate,
  filterDriverId,
  filterSlot,
  activeBookings,
  unassignedCount,
  driverStats,
  driverColorMap,
  onDateChange,
  onMoveDate,
  onFilterDriverChange,
  onFilterSlotChange,
  onNavigateCalendar,
  onNavigateDriver,
}: DispatchHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
      <div className="max-w-[100rem] mx-auto px-4 py-3">
        {/* 1행: 제목(좌) + 날짜 선택(우) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AdminLogo />
            <h1 className="text-lg font-bold truncate">배차 관리</h1>
            <button
              onClick={onNavigateDriver}
              className="text-xs font-medium text-text-sub hover:text-primary transition-colors shrink-0 hidden sm:block"
            >
              기사님 관리
            </button>
          </div>

          {/* 날짜 선택 */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onMoveDate(-1)} aria-label="이전 날" className="p-1.5 rounded-md hover:bg-fill-tint text-text-sub">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-2 py-1.5 text-sm font-medium border border-border rounded-lg bg-bg min-w-0 w-40 sm:w-auto"
            />
            <button onClick={() => onMoveDate(1)} aria-label="다음 날" className="p-1.5 rounded-md hover:bg-fill-tint text-text-sub">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <button
              onClick={() => onDateChange(getToday())}
              className="hidden sm:block text-xs font-medium text-primary px-2 py-1 rounded-md hover:bg-primary-bg"
            >
              오늘
            </button>
          </div>
        </div>

        {/* 2행: 필터(좌) + 범례(우) */}
        <div className="flex items-center gap-2 mt-2">
          {/* 필터 — flex-1로 가용 공간 확보 */}
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <select
              value={filterDriverId}
              onChange={(e) => onFilterDriverChange(e.target.value)}
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
            <select
              value={filterSlot}
              onChange={(e) => onFilterSlotChange(e.target.value)}
              className="text-xs px-2 py-1.5 border border-border rounded-lg bg-bg"
              aria-label="시간대 필터"
            >
              <option value="all">전체 시간대</option>
              {SLOT_ORDER.map((slot) => {
                const cnt = activeBookings.filter((b) => b.timeSlot === slot).length;
                return cnt > 0 ? (
                  <option key={slot} value={slot}>{SLOT_LABELS[slot]} ({cnt}건)</option>
                ) : null;
              })}
            </select>
          </div>

          {/* 범례 + 가이드 — 데스크탑에서만 표시, overflow 방지 */}
          <div className="hidden lg:flex items-center gap-2 text-xs shrink-0">
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
            <span className="text-xs text-text-muted border-l border-border-light pl-2 whitespace-nowrap">
              체크 선택 → 기사 지정 → 일괄 배차
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
