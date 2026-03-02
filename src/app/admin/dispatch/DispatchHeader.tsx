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
  onOpenReassign?: () => void; // 재배차 도구 임시 비활성화
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
  onOpenReassign,
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
              className="flex items-center gap-1.5 text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-2.5 py-1 hover:bg-bg-warm transition-colors shrink-0"
            >
              {/* 사람 아이콘 */}
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.167 13.5V12.833C12.167 11.522 11.144 10.5 10 10.5H6C4.856 10.5 3.833 11.522 3.833 12.833V13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 8.5C9.381 8.5 10.5 7.381 10.5 6C10.5 4.619 9.381 3.5 8 3.5C6.619 3.5 5.5 4.619 5.5 6C5.5 7.381 6.619 8.5 8 8.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>기사님 관리</span>
            </button>
            {/* 재배차 도구 버튼 — 임시 비활성화
            <button
              onClick={onOpenReassign}
              className="text-xs font-medium text-semantic-orange hover:text-semantic-orange/80 transition-colors shrink-0 hidden sm:block border border-semantic-orange/30 px-2 py-0.5 rounded-md hover:bg-semantic-orange-tint"
            >
              재배차 도구
            </button>
            */}
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
          {/* 필터 */}
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

          {/* 범례 + 가이드 — 데스크탑에서만 표시 */}
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
