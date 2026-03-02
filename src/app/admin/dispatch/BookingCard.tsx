"use client";

import { useState, forwardRef } from "react";
import type { Booking, BookingItem } from "@/types/booking";
import type { DriverStats } from "./dispatch-utils";
import { SLOT_LABELS, UNASSIGNED_COLOR, itemsSummary } from "./dispatch-utils";

/* ── 타입 ── */

export interface BookingCardProps {
  booking: Booking;
  isSelected: boolean;
  isChecked: boolean;
  driverColor?: string;
  driverStats: DriverStats[];
  dispatching: boolean;
  estimatedVisitTime?: string;
  onCheck: () => void;
  onClick: () => void;
  onDispatch: (driverId: string) => void;
  onUnassign: () => void;
}

/* ── 주문 카드 (리스트용) ── */

const BookingCard = forwardRef<HTMLDivElement, BookingCardProps>(function BookingCard(
  { booking, isSelected, isChecked, driverColor, driverStats, dispatching, estimatedVisitTime, onCheck, onClick, onDispatch, onUnassign },
  ref,
) {
  const cube = (booking.totalLoadingCube || 0).toFixed(1);
  // 배차 해제 인라인 확인 (confirm() 대체)
  const [unassignConfirm, setUnassignConfirm] = useState(false);

  return (
    <div
      ref={ref}
      className={`px-4 py-2.5 border-b border-border-light cursor-pointer transition-colors ${
        isSelected ? "bg-primary-bg" : "hover:bg-bg-warm"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* 체크박스 (미배차만) */}
        {!booking.driverId && (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => { e.stopPropagation(); onCheck(); }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded border-border accent-primary flex-shrink-0"
          />
        )}
        {/* 기사 색상 도트 (배차된 경우) */}
        {booking.driverId && driverColor && (
          <span
            className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: driverColor }}
          />
        )}

        <div className="flex-1 min-w-0">
          {/* 1줄: 시간 + 고객명 + 상태 */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-white px-1.5 py-0.5 rounded"
              style={{ background: booking.driverId ? (driverColor || "#10B981") : UNASSIGNED_COLOR }}>
              {SLOT_LABELS[booking.timeSlot] || booking.timeSlot}
            </span>
            {estimatedVisitTime && (
              <span className="text-[10px] text-text-muted font-mono flex-shrink-0">예상 {estimatedVisitTime}</span>
            )}
            <span className="text-sm font-semibold truncate">{booking.customerName}</span>
            {booking.driverId && booking.driverName && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded ml-auto flex-shrink-0"
                style={{ background: `${driverColor || "#10B981"}18`, color: driverColor || "#10B981" }}>
                {booking.driverName}{(() => {
                  const vt = driverStats.find((s) => s.driverId === booking.driverId)?.vehicleType;
                  return vt ? ` (${vt})` : "";
                })()}
              </span>
            )}
          </div>

          {/* 2줄: 주소 */}
          <div className="text-xs text-text-muted truncate mb-0.5">
            {booking.address || "-"}
          </div>

          {/* 3줄: 품목 + 큐브 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-sub truncate">
              {itemsSummary(Array.isArray(booking.items) ? booking.items : [])}
            </span>
            <span className="text-xs font-semibold text-primary flex-shrink-0">
              {cube}m&sup3;
            </span>
          </div>
        </div>

        {/* 빠른 배차 드롭다운 (미배차) */}
        {!booking.driverId && (
          <select
            className="text-xs px-1.5 py-1 border border-border rounded bg-bg flex-shrink-0 mt-1"
            value=""
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.value) onDispatch(e.target.value);
            }}
          >
            <option value="">배차</option>
            {driverStats.map((stat) => {
              const remaining = stat.vehicleCapacity - stat.totalLoadingCube;
              const bookingCube = booking.totalLoadingCube || 0;
              const wouldExceed = stat.totalLoadingCube + bookingCube > stat.vehicleCapacity;
              return (
                <option key={stat.driverId} value={stat.driverId}>
                  {wouldExceed ? "⚠ " : ""}{stat.driverName} ({remaining.toFixed(1)}m³)
                </option>
              );
            })}
          </select>
        )}
        {/* 배차 해제 — 인라인 확인 (confirm() 대체) */}
        {booking.driverId && (
          unassignConfirm ? (
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setUnassignConfirm(false); onUnassign(); }}
                disabled={dispatching}
                className="text-[11px] font-semibold text-white bg-semantic-red px-2 py-1 rounded-md transition-colors"
              >
                해제
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setUnassignConfirm(false); }}
                className="text-[11px] text-text-muted px-1.5 py-1 hover:text-text-primary"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setUnassignConfirm(true); }}
              disabled={dispatching}
              className="flex items-center gap-0.5 text-[11px] font-medium text-semantic-red bg-semantic-red-tint px-2 py-1 rounded-md hover:bg-semantic-red/10 transition-colors flex-shrink-0 mt-0.5"
              title="배차 해제"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              해제
            </button>
          )
        )}
      </div>
    </div>
  );
});

export default BookingCard;
