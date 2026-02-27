"use client";

import type { Booking } from "@/types/booking";
import type { Driver, DriverStats } from "./dispatch-utils";
import { SLOT_ORDER, SLOT_LABELS, UNASSIGNED_COLOR, formatDateShort } from "./dispatch-utils";

/* ── 타입 ── */

export interface DispatchSummaryBarProps {
  selectedDate: string;
  activeBookingsCount: number;
  unassignedCount: number;
  autoMode: "idle" | "loading" | "preview";
  filteredBookings: Booking[];
  checkedIds: Set<string>;
  showSlotConfig: boolean;
  drivers: Driver[];
  driverSlotFilters: Record<string, string[]>;
  onToggleAllUnassigned: () => void;
  onAutoDispatch: () => void;
  onToggleSlotConfig: () => void;
  onToggleDriverSlot: (driverId: string, slot: string) => void;
  onShowUnloadingModal: () => void;
  onNavigateDriver: () => void;
}

/* ── 요약 + 자동배차/하차지 관리 버튼 ── */

export default function DispatchSummaryBar({
  selectedDate,
  activeBookingsCount,
  unassignedCount,
  autoMode,
  filteredBookings,
  checkedIds,
  showSlotConfig,
  drivers,
  driverSlotFilters,
  onToggleAllUnassigned,
  onAutoDispatch,
  onToggleSlotConfig,
  onToggleDriverSlot,
  onShowUnloadingModal,
  onNavigateDriver,
}: DispatchSummaryBarProps) {
  return (
    <div className="px-4 py-3 border-b border-border-light bg-bg-warm space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold">{formatDateShort(selectedDate)}</span>
          <span className="text-text-muted ml-2">전체 {activeBookingsCount}건</span>
          {unassignedCount > 0 && (
            <span className="ml-2" style={{ color: UNASSIGNED_COLOR }}>
              미배차 {unassignedCount}건
            </span>
          )}
        </div>
        {autoMode === "idle" && unassignedCount > 0 && (
          <button
            onClick={onToggleAllUnassigned}
            className="text-xs text-primary font-medium hover:underline"
          >
            {filteredBookings.filter((b) => !b.driverId).every((b) => checkedIds.has(b.id))
              ? "선택 해제"
              : "미배차 전체 선택"
            }
          </button>
        )}
      </div>
      {/* 자동배차 + 하차지 관리 버튼 */}
      {autoMode === "idle" && (
        <div className="flex flex-col gap-2">
          {/* 기사별 시간대 제약 설정 패널 */}
          {showSlotConfig && drivers.length > 0 && (
            <div className="bg-bg-warm border border-border-light rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-muted font-medium">기사별 허용 시간대 (비활성 = 해당 슬롯 배제)</span>
                <button
                  onClick={onNavigateDriver}
                  className="text-[11px] font-medium text-primary hover:underline shrink-0"
                >
                  기사 관리에서 저장 →
                </button>
              </div>
              <p className="text-[11px] text-text-muted/70">
                기사 프로필에 저장된 슬롯이 자동 적용됩니다. 아래 설정은 이번 배차에만 적용됩니다.
              </p>
              {drivers.map((d) => {
                const allowed = driverSlotFilters[d.id] ?? [];
                return (
                  <div key={d.id} className="flex items-center gap-1.5">
                    <span className="text-xs font-medium w-14 truncate flex-shrink-0">{d.name}</span>
                    {SLOT_ORDER.map((slot) => {
                      const active = allowed.length === 0 || allowed.includes(slot);
                      return (
                        <button
                          key={slot}
                          onClick={() => onToggleDriverSlot(d.id, slot)}
                          className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                            active
                              ? "bg-primary text-white border-primary"
                              : "text-text-muted border-border bg-bg"
                          }`}
                        >
                          {SLOT_LABELS[slot]}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onAutoDispatch}
              disabled={unassignedCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary-dark transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.75V12.25M1.75 7H12.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              자동배차
            </button>
            <button
              onClick={onToggleSlotConfig}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showSlotConfig
                  ? "border-primary text-primary bg-primary-bg"
                  : "border-border text-text-muted hover:bg-fill-tint"
              }`}
              title="기사별 시간대 제약 설정 (기사 프로필 우선)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1.75 4.5h10.5M1.75 9.5h10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="4.5" cy="4.5" r="1.75" fill="currentColor"/>
                <circle cx="9.5" cy="9.5" r="1.75" fill="currentColor"/>
              </svg>
              슬롯 설정
            </button>
            <button
              onClick={onShowUnloadingModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-sub hover:bg-fill-tint transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 3.5V10.5M7 3.5L5.25 5.25M7 3.5L8.75 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="2.5" y="2" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              하차지 관리
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
