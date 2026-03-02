"use client";

import type { Booking, UnloadingPoint } from "@/types/booking";
import type { DriverStats } from "./dispatch-utils";
import { SLOT_ORDER, SLOT_LABELS, getLoadingPercent } from "./dispatch-utils";

/* ── 타입 ── */

export interface DriverLoadingPanelProps {
  driverStats: DriverStats[];
  driverColorMap: Map<string, string>;
  driverSlotBreakdown: Map<string, Record<string, number>>;
  filterDriverId: string;
  isOpen: boolean;
  activeBookings: Booking[];
  unloadingPoints: UnloadingPoint[];
  onToggleOpen: (open: boolean) => void;
  onSelectDriver: (driverId: string) => void;
  onFitToPositions: (positions: { lat: number; lng: number }[]) => void;
}

/* ── 기사 적재 현황 오버레이 (지도 우측 상단) ── */

export default function DriverLoadingPanel({
  driverStats,
  driverColorMap,
  driverSlotBreakdown,
  filterDriverId,
  isOpen,
  activeBookings,
  unloadingPoints,
  onToggleOpen,
  onSelectDriver,
  onFitToPositions,
}: DriverLoadingPanelProps) {
  if (driverStats.length === 0) return null;

  return (
    <div className="hidden lg:block absolute top-4 right-4 z-10">
      {isOpen ? (
        <div className="w-[280px] bg-bg/95 backdrop-blur-sm rounded-lg border border-border-light shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-light">
            <span className="text-xs font-semibold text-text-sub">기사 적재 현황</span>
            <button
              onClick={() => onToggleOpen(false)}
              className="p-0.5 text-text-muted hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="p-2 space-y-1.5 max-h-[calc(100vh-300px)] overflow-y-auto">
            {driverStats.map((stat) => {
              const pct = getLoadingPercent(stat.totalLoadingCube, stat.vehicleCapacity);
              const isOver = stat.totalLoadingCube > stat.vehicleCapacity;
              const color = driverColorMap.get(stat.driverId) || "#10B981";
              return (
                <button
                  key={stat.driverId}
                  onClick={() => {
                    const next = filterDriverId === stat.driverId ? "all" : stat.driverId;
                    onSelectDriver(next);
                    if (next !== "all") {
                      const positions: { lat: number; lng: number }[] = [];
                      const driverBookings = activeBookings.filter(
                        (b) => b.driverId === stat.driverId && b.latitude != null && b.longitude != null,
                      );
                      driverBookings.forEach((b) => positions.push({ lat: b.latitude!, lng: b.longitude! }));
                      // 이 기사가 실제 경유하는 하차지만 포함 (전체 활성 하차지 X)
                      const visitedUnloadingIds = new Set(
                        driverBookings.filter((b) => b.unloadingStopAfter != null).map((b) => b.unloadingStopAfter!),
                      );
                      unloadingPoints
                        .filter((p) => visitedUnloadingIds.has(p.id))
                        .forEach((p) => positions.push({ lat: p.latitude, lng: p.longitude }));
                      if (positions.length > 0) onFitToPositions(positions);
                    }
                  }}
                  className={`w-full p-2 rounded-md border transition-all text-left ${
                    filterDriverId === stat.driverId
                      ? "border-primary bg-primary-bg"
                      : "border-transparent hover:bg-fill-tint"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs font-semibold truncate">{stat.driverName}</span>
                    <span className="text-[11px] text-text-muted">{stat.vehicleType}{stat.licensePlate ? ` (${stat.licensePlate})` : ""}</span>
                    <span className="ml-auto text-[11px] text-text-muted">{stat.assignedCount}건</span>
                  </div>
                  <div className="h-1.5 bg-fill-tint rounded-full overflow-hidden mb-0.5">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: isOver ? "#EF4444" : pct > 80 ? "#F97316" : color,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={isOver ? "text-semantic-red font-semibold" : "text-text-muted"}>
                      {stat.totalLoadingCube.toFixed(1)}/{stat.vehicleCapacity}m&sup3;
                    </span>
                    {isOver && <span className="text-semantic-red font-medium">초과</span>}
                  </div>
                  {/* 시간대 분포 칩 */}
                  {(() => {
                    const breakdown = driverSlotBreakdown.get(stat.driverId);
                    if (!breakdown || Object.keys(breakdown).length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {SLOT_ORDER.filter((s) => breakdown[s]).map((s) => (
                          <span key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-fill-tint text-text-muted leading-4">
                            {SLOT_LABELS[s] || s} {breakdown[s]}
                          </span>
                        ))}
                        {breakdown["기타"] ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-fill-tint text-text-muted leading-4">
                            기타 {breakdown["기타"]}
                          </span>
                        ) : null}
                      </div>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={() => onToggleOpen(true)}
          className="bg-bg/95 backdrop-blur-sm rounded-lg border border-border-light shadow-md px-3 py-2 text-xs font-semibold text-text-sub hover:bg-fill-tint transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="3" width="10" height="1.5" rx="0.75" fill="currentColor"/>
            <rect x="2" y="6.25" width="7" height="1.5" rx="0.75" fill="currentColor"/>
            <rect x="2" y="9.5" width="4" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
          기사 현황
          {driverStats.some(s => s.totalLoadingCube > s.vehicleCapacity) && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-semantic-red text-white text-[10px] font-bold">
              {driverStats.filter(s => s.totalLoadingCube > s.vehicleCapacity).length}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
