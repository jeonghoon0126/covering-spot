"use client";

import { useState, useEffect } from "react";
import type { Booking, BookingItem } from "@/types/booking";
import type { DriverStats } from "./dispatch-utils";
import { STATUS_LABELS, SLOT_LABELS } from "./dispatch-utils";

/* ── 타입 ── */

export interface OverlayCardProps {
  booking: Booking;
  driverColor?: string;
  driverStats: DriverStats[];
  dispatching: boolean;
  onDispatch: (driverId: string) => void;
  onUnassign: () => void;
  onDetail: () => void;
  onClose: () => void;
}

/* ── 오버레이 카드 (지도 위 + 모바일 바텀시트) ── */

export default function OverlayCard({
  booking,
  driverColor,
  driverStats,
  dispatching,
  onDispatch,
  onUnassign,
  onDetail,
  onClose,
}: OverlayCardProps) {
  const [selectedDriverId, setSelectedDriverId] = useState(booking.driverId ?? "");
  // 배차 해제 인라인 확인 (confirm() 대체)
  const [unassignConfirm, setUnassignConfirm] = useState(false);

  useEffect(() => {
    setSelectedDriverId(booking.driverId ?? "");
    setUnassignConfirm(false); // 예약 변경 시 확인 상태 초기화
  }, [booking.id, booking.driverId]);

  const cube = (booking.totalLoadingCube ?? 0).toFixed(1);

  return (
    <div className="p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">{booking.customerName}</h3>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            booking.status === "pending" ? "bg-semantic-orange-tint text-semantic-orange"
            : booking.status === "in_progress" ? "bg-primary-tint text-primary"
            : "bg-semantic-green-tint text-semantic-green"
          }`}>
            {STATUS_LABELS[booking.status] || booking.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDetail}
            className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-fill-tint"
          >
            상세
          </button>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* 주문 정보 */}
      <div className="space-y-1.5 text-sm">
        {booking.phone && (
          <div className="flex items-center gap-2">
            <a href={`tel:${booking.phone}`} className="text-xs text-primary">{booking.phone}</a>
          </div>
        )}
        <div className="text-xs text-text-muted">
          {booking.address || ""} {booking.addressDetail || ""}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span>{SLOT_LABELS[booking.timeSlot] || booking.timeSlot || "-"}</span>
          <span className="font-semibold text-primary">{cube}m&sup3;</span>
          <span className="text-text-muted">
            엘베 {booking.hasElevator ? "O" : "X"} / 주차 {booking.hasParking ? "O" : "X"}
          </span>
        </div>

        {/* 품목 */}
        {Array.isArray(booking.items) && booking.items.length > 0 && (
          <div className="bg-bg-warm rounded-lg p-2 space-y-0.5">
            {booking.items.map((item: BookingItem, idx: number) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-text-sub">
                  {item?.category || ""} {item?.name || ""} x{item?.quantity ?? 0}
                </span>
                <span className="text-text-muted">
                  {((item?.loadingCube ?? 0) * (item?.quantity ?? 0)).toFixed(1)}m&sup3;
                </span>
              </div>
            ))}
          </div>
        )}

        {booking.memo && (
          <div className="text-xs text-text-muted">
            <span className="font-medium">요청: </span>{booking.memo}
          </div>
        )}
      </div>

      {/* 배차 */}
      <div className="border-t border-border-light pt-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="flex-1 text-sm px-2 py-1.5 border border-border rounded-lg bg-bg"
          >
            <option value="">기사 선택</option>
            {driverStats.map((stat) => {
              const remaining = stat.vehicleCapacity - stat.totalLoadingCube;
              const bookingCube = booking.totalLoadingCube || 0;
              const wouldExceed = stat.totalLoadingCube + bookingCube > stat.vehicleCapacity;
              return (
                <option key={stat.driverId} value={stat.driverId}>
                  {wouldExceed ? "⚠ " : ""}{stat.driverName} {stat.vehicleType} ({remaining.toFixed(1)}m&sup3; 여유)
                </option>
              );
            })}
          </select>
          <button
            onClick={() => {
              if (selectedDriverId) onDispatch(selectedDriverId);
            }}
            disabled={!selectedDriverId || dispatching || selectedDriverId === booking.driverId}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40 transition-colors hover:bg-primary-dark"
          >
            {dispatching ? "..." : "배차"}
          </button>
          {booking.driverId && (
            unassignConfirm ? (
              <>
                <button
                  onClick={() => { setUnassignConfirm(false); onUnassign(); }}
                  disabled={dispatching}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-semantic-red text-white transition-colors disabled:opacity-40"
                >
                  해제 확인
                </button>
                <button
                  onClick={() => setUnassignConfirm(false)}
                  className="px-2 py-1.5 rounded-lg text-sm text-text-muted hover:text-text-primary"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                onClick={() => setUnassignConfirm(true)}
                disabled={dispatching}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-semantic-red/30 text-semantic-red hover:bg-semantic-red-tint transition-colors disabled:opacity-40"
              >
                해제
              </button>
            )
          )}
        </div>
        {booking.driverId && booking.driverName && (
          <div className="mt-1.5 text-xs text-text-muted flex items-center gap-1.5">
            {driverColor && (
              <span className="w-2 h-2 rounded-full" style={{ background: driverColor }} />
            )}
            현재: {booking.driverName}
          </div>
        )}
      </div>
    </div>
  );
}
