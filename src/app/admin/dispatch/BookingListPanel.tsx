"use client";

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Booking, UnloadingPoint } from "@/types/booking";
import type { AutoDispatchResult } from "@/lib/optimizer/types";
import type { Driver, DriverStats } from "./dispatch-utils";
import { SLOT_LABELS } from "./dispatch-utils";
import BookingCard from "./BookingCard";
import SortableFlatBookingCard from "./SortableFlatBookingCard";
import AutoDispatchPreview from "./AutoDispatchPreview";
import DispatchSummaryBar from "./DispatchSummaryBar";
import RouteInfoBetweenCards from "./RouteInfoBetweenCards";

interface BookingListPanelProps {
  // 데이터
  bookings: Booking[];
  activeBookings: Booking[];
  filteredBookings: Booking[];
  groupedBySlot: [string, Booking[]][];
  slotOverload: Record<string, { total: number; driverCount: number; max: number; over: boolean }>;
  drivers: Driver[];
  driverStats: DriverStats[];
  driverColorMap: Map<string, string>;
  unloadingPoints: UnloadingPoint[];

  // 필터/선택
  selectedDate: string;
  selectedBookingId: string | null;
  filterDriverId: string;
  checkedIds: Set<string>;
  batchDriverId: string;
  dispatching: boolean;

  // 자동배차
  autoMode: "idle" | "loading" | "preview";
  autoResult: AutoDispatchResult | null;
  autoApplying: boolean;
  partialFailedIds: string[];
  showSlotConfig: boolean;
  driverSlotFilters: Record<string, string[]>;

  // 동선
  optimizingRoute: boolean;
  reordering: boolean;
  sensors: SensorDescriptor<SensorOptions>[];

  // 모바일
  mobileTab: "map" | "list";

  // 액션
  unassignedCount: number;
  onToggleCheck: (id: string) => void;
  onToggleAllUnassigned: () => void;
  onCardClick: (booking: Booking) => void;
  onDispatch: (bookingId: string, driverId: string) => void;
  onUnassign: (bookingId: string) => void;
  onBatchDispatch: () => void;
  onSetBatchDriverId: (id: string) => void;
  onSetPartialFailedIds: (ids: string[]) => void;
  onOptimizeRoute: () => void;
  onFlatListReorder: (event: DragEndEvent) => void;
  onAutoDispatch: () => void;
  onAutoApply: () => void;
  onAutoCancel: () => void;
  onAutoReorder: (driverId: string, newIds: string[]) => void;
  onToggleSlotConfig: () => void;
  onToggleDriverSlot: (driverId: string, slot: string) => void;
  onShowUnloadingModal: () => void;
  onNavigateDriver: () => void;
  cardRefs: React.RefObject<Map<string, HTMLDivElement>>;

  // 하차지 컨트롤
  onUpdateUnloadingStop: (bookingId: string, unloadingPointId: string | null) => Promise<void>;
  updatingUnloadingIds: Set<string>;

  // 방문 예상 시간
  estimatedVisitTimes?: Map<string, string>;
}

export default function BookingListPanel({
  bookings,
  activeBookings,
  filteredBookings,
  groupedBySlot,
  slotOverload,
  drivers,
  driverStats,
  driverColorMap,
  unloadingPoints,
  selectedDate,
  selectedBookingId,
  filterDriverId,
  checkedIds,
  batchDriverId,
  dispatching,
  autoMode,
  autoResult,
  autoApplying,
  partialFailedIds,
  showSlotConfig,
  driverSlotFilters,
  optimizingRoute,
  reordering,
  sensors,
  mobileTab,
  unassignedCount,
  onToggleCheck,
  onToggleAllUnassigned,
  onCardClick,
  onDispatch,
  onUnassign,
  onBatchDispatch,
  onSetBatchDriverId,
  onSetPartialFailedIds,
  onOptimizeRoute,
  onFlatListReorder,
  onAutoDispatch,
  onAutoApply,
  onAutoCancel,
  onAutoReorder,
  onToggleSlotConfig,
  onToggleDriverSlot,
  onShowUnloadingModal,
  onNavigateDriver,
  cardRefs,
  onUpdateUnloadingStop,
  updatingUnloadingIds,
  estimatedVisitTimes,
}: BookingListPanelProps) {
  return (
    <div className={`lg:w-[400px] lg:flex-shrink-0 lg:border-r border-border-light bg-bg flex flex-col overflow-hidden ${
      mobileTab === "list" ? "flex" : "hidden lg:flex"
    }`}>
      {/* 요약 + 버튼 */}
      <DispatchSummaryBar
        selectedDate={selectedDate}
        activeBookingsCount={activeBookings.length}
        unassignedCount={unassignedCount}
        autoMode={autoMode}
        filteredBookings={filteredBookings}
        checkedIds={checkedIds}
        showSlotConfig={showSlotConfig}
        drivers={drivers}
        driverSlotFilters={driverSlotFilters}
        onToggleAllUnassigned={onToggleAllUnassigned}
        onAutoDispatch={onAutoDispatch}
        onToggleSlotConfig={onToggleSlotConfig}
        onToggleDriverSlot={onToggleDriverSlot}
        onShowUnloadingModal={onShowUnloadingModal}
        onNavigateDriver={onNavigateDriver}
      />

      {/* 배차 실패 배너 (partialFailure) */}
      {partialFailedIds.length > 0 && (
        <div className="px-4 py-3 bg-semantic-orange-tint border-b border-semantic-orange/20">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-semantic-orange mb-1.5">
                ⚠ 배차 실패 {partialFailedIds.length}건 — 수동 배차 필요
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {partialFailedIds.map((id) => {
                  const b = bookings.find((bk) => bk.id === id);
                  return (
                    <div key={id} className="text-[11px] text-text-sub truncate">
                      {b ? `${b.customerName} · ${b.address}` : id}
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => onSetPartialFailedIds([])}
              className="flex-shrink-0 text-text-muted hover:text-text-sub p-0.5"
              aria-label="닫기"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 주문 목록 또는 자동배차 미리보기 */}
      <div className="flex-1 overflow-y-auto">
        {autoMode === "loading" ? (
          <div className="flex-1 p-4 space-y-2 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-bg-warm rounded-lg border border-border-light p-3 flex items-start gap-2.5">
                <div className="w-4 h-4 bg-bg-warm3 rounded mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-10 bg-bg-warm3 rounded-full" />
                    <div className="h-3.5 w-20 bg-bg-warm3 rounded" />
                  </div>
                  <div className="h-3 w-40 bg-bg-warm3 rounded" />
                </div>
              </div>
            ))}
            <p className="text-center text-xs text-text-muted pt-2">자동배차 계산 중...</p>
          </div>
        ) : autoMode === "preview" && autoResult ? (
          <AutoDispatchPreview
            result={autoResult}
            bookings={bookings}
            driverColorMap={driverColorMap}
            unloadingPoints={unloadingPoints}
            applying={autoApplying}
            onApply={onAutoApply}
            onCancel={onAutoCancel}
            onReorder={onAutoReorder}
          />
        ) : filteredBookings.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            해당 날짜에 주문이 없습니다
          </div>
        ) : filterDriverId !== "all" && filterDriverId !== "unassigned" ? (
          // 특정 기사 선택: routeOrder 순서의 flat list (DnD + 동선 최적화)
          <>
            {/* 동선 최적화 버튼 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-light bg-bg-warm">
              <span className="text-xs text-text-muted">
                {filteredBookings.filter((b) => b.routeOrder != null).length > 0
                  ? "드래그로 순서 변경"
                  : "동선 미설정 — 최적화 필요"}
              </span>
              <button
                onClick={onOptimizeRoute}
                disabled={optimizingRoute || reordering}
                className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 rounded-md px-2.5 py-1 hover:bg-primary-bg transition-colors disabled:opacity-40"
              >
                {optimizingRoute ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L8 4H4L6 1Z" fill="currentColor"/>
                    <path d="M6 11L4 8H8L6 11Z" fill="currentColor"/>
                    <path d="M1 6L4 4V8L1 6Z" fill="currentColor"/>
                    <path d="M11 6L8 8V4L11 6Z" fill="currentColor"/>
                  </svg>
                )}
                동선 최적화
              </button>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onFlatListReorder}
            >
              <SortableContext
                items={filteredBookings.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredBookings.flatMap((b, idx) => [
                      <SortableFlatBookingCard
                        key={b.id}
                        booking={b}
                        isSelected={selectedBookingId === b.id}
                        isChecked={checkedIds.has(b.id)}
                        driverColor={b.driverId ? (driverColorMap.get(b.driverId) || "#10B981") : undefined}
                        driverStats={driverStats}
                        dispatching={dispatching}
                        estimatedVisitTime={estimatedVisitTimes?.get(b.id)}
                        onCheck={() => onToggleCheck(b.id)}
                        onClick={() => onCardClick(b)}
                        onDispatch={(dId) => onDispatch(b.id, dId)}
                        onUnassign={() => onUnassign(b.id)}
                        cardRef={(el) => {
                          if (el) cardRefs.current.set(b.id, el);
                          else cardRefs.current.delete(b.id);
                        }}
                      />,
                      <RouteInfoBetweenCards
                        key={`route-${b.id}`}
                        booking={b}
                        nextBooking={filteredBookings[idx + 1]}
                        unloadingPoints={unloadingPoints}
                        onUpdateUnloadingStop={onUpdateUnloadingStop}
                        isUpdating={updatingUnloadingIds.has(b.id)}
                      />,
                    ])}
              </SortableContext>
            </DndContext>
          </>
        ) : (
          groupedBySlot.map(([slot, slotBookings]) => (
            <div key={slot}>
              <div className="sticky top-0 z-10 px-4 py-1.5 bg-bg-warm border-b border-border-light flex items-center gap-1.5">
                <span className="text-xs font-semibold text-text-sub">
                  {SLOT_LABELS[slot] || slot}
                </span>
                <span className="text-xs text-text-muted">({slotBookings.length}건)</span>
                {slotOverload[slot]?.over && (
                  <span
                    className="ml-auto text-[11px] font-semibold text-semantic-orange bg-semantic-orange-tint px-1.5 py-0.5 rounded"
                    title={`배차된 ${slotOverload[slot].total}건 / 기사 ${slotOverload[slot].driverCount}명 기준 최대 ${slotOverload[slot].max}건`}
                  >
                    ⚠ 과부하
                  </span>
                )}
              </div>
              {slotBookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  isSelected={selectedBookingId === b.id}
                  isChecked={checkedIds.has(b.id)}
                  driverColor={b.driverId ? (driverColorMap.get(b.driverId) || "#10B981") : undefined}
                  driverStats={driverStats}
                  dispatching={dispatching}
                  onCheck={() => onToggleCheck(b.id)}
                  onClick={() => onCardClick(b)}
                  onDispatch={(dId) => onDispatch(b.id, dId)}
                  onUnassign={() => onUnassign(b.id)}
                  ref={(el) => {
                    if (el) cardRefs.current.set(b.id, el);
                    else cardRefs.current.delete(b.id);
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* 일괄 배차 바 */}
      {checkedIds.size > 0 && (
        <div className="border-t border-border-light bg-bg px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">{checkedIds.size}건 선택</span>
            <select
              value={batchDriverId}
              onChange={(e) => onSetBatchDriverId(e.target.value)}
              className="flex-1 text-sm px-2 py-1.5 border border-border rounded-lg bg-bg"
            >
              <option value="">기사 선택</option>
              {(() => {
                const checkedCube = filteredBookings
                  .filter((b) => checkedIds.has(b.id) && b.driverId == null)
                  .reduce((sum, b) => sum + (b.totalLoadingCube || 0), 0);
                return driverStats.map((stat) => {
                  const remaining = stat.vehicleCapacity - stat.totalLoadingCube;
                  const wouldExceed = stat.totalLoadingCube + checkedCube > stat.vehicleCapacity;
                  return (
                    <option key={stat.driverId} value={stat.driverId}>
                      {wouldExceed ? "⚠ " : ""}{stat.driverName} ({remaining.toFixed(1)}m³ 여유)
                    </option>
                  );
                });
              })()}
            </select>
            <button
              onClick={onBatchDispatch}
              disabled={!batchDriverId || dispatching}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40 transition-colors hover:bg-primary-dark"
            >
              {dispatching ? "..." : "배차"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
