"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDuration, formatDistance } from "@/lib/kakao-directions";
import { haversine } from "@/lib/optimizer/haversine";
import type { Booking, UnloadingPoint } from "@/types/booking";
import type { AutoDispatchResult, DriverPlan } from "@/lib/optimizer/types";
import { calcServiceMins, calcTravelMins, ROUTE_ROAD_FACTOR } from "./dispatch-utils";

/* ── 타입 ── */

export interface AutoDispatchPreviewProps {
  result: AutoDispatchResult;
  bookings: Booking[];
  driverColorMap: Map<string, string>;
  unloadingPoints: UnloadingPoint[];
  applying: boolean;
  onApply: () => void;
  onCancel: () => void;
  onReorder: (driverId: string, newIds: string[]) => void;
}

/* ── 드래그 핸들 아이콘 ── */

function DragHandle({ listeners, attributes }: { listeners?: SyntheticListenerMap; attributes?: DraggableAttributes }) {
  return (
    <button
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing p-0.5 text-text-muted hover:text-text-primary touch-none flex-shrink-0"
      title="순서 변경"
      tabIndex={-1}
    >
      <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
        <circle cx="4" cy="3" r="1.2" fill="currentColor"/>
        <circle cx="8" cy="3" r="1.2" fill="currentColor"/>
        <circle cx="4" cy="7" r="1.2" fill="currentColor"/>
        <circle cx="8" cy="7" r="1.2" fill="currentColor"/>
        <circle cx="4" cy="11" r="1.2" fill="currentColor"/>
        <circle cx="8" cy="11" r="1.2" fill="currentColor"/>
      </svg>
    </button>
  );
}

/* ── 드래그 가능한 배차 행 ── */

function SortableBookingRow({
  booking,
  color,
}: {
  booking: DriverPlan["bookings"][number];
  color: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: booking.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <div className="flex items-center gap-2 py-1">
        <DragHandle listeners={listeners} attributes={attributes} />
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: color }}
        >
          {booking.routeOrder}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{booking.customerName}</div>
          <div className="text-[11px] text-text-muted truncate">{booking.address}</div>
        </div>
        <span className="text-[11px] font-semibold text-primary flex-shrink-0">
          {booking.loadCube.toFixed(1)}m³
        </span>
      </div>
    </div>
  );
}

/* ── 레그별 적재량 바 ── */

function LegLoadBars({ driverPlan, color }: { driverPlan: DriverPlan; color: string }) {
  // 하차지를 기준으로 레그 분할
  const legs: { bookings: typeof driverPlan.bookings; load: number }[] = [];
  let currentLeg: typeof driverPlan.bookings = [];
  let currentLoad = 0;
  const stopOrders = new Set(driverPlan.unloadingStops.map((s) => s.afterRouteOrder));

  for (const b of driverPlan.bookings) {
    currentLeg.push(b);
    currentLoad += b.loadCube;
    if (stopOrders.has(b.routeOrder)) {
      legs.push({ bookings: currentLeg, load: currentLoad });
      currentLeg = [];
      currentLoad = 0;
    }
  }
  if (currentLeg.length > 0) {
    legs.push({ bookings: currentLeg, load: currentLoad });
  }

  const cap = driverPlan.vehicleCapacity;

  return (
    <div className="space-y-1">
      {legs.map((leg, i) => {
        const pct = cap > 0 ? Math.min(100, Math.round((leg.load / cap) * 100)) : 0;
        const isOver = leg.load > cap;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted w-8">{i + 1}차</span>
            <div className="flex-1 h-1.5 bg-fill-tint rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, pct)}%`, background: isOver ? "#EF4444" : color }}
              />
            </div>
            <span className={`text-[11px] ${isOver ? "text-semantic-red font-semibold" : "text-text-muted"}`}>
              {leg.load.toFixed(1)}/{cap}m³
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── 자동배차 미리보기 ── */

export default function AutoDispatchPreview({
  result,
  bookings,
  driverColorMap,
  unloadingPoints,
  applying,
  onApply,
  onCancel,
  onReorder,
}: AutoDispatchPreviewProps) {
  // 포인터 + 터치 센서 (모바일 지원)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragEnd(driverId: string, event: DragEndEvent, driverBookings: DriverPlan["bookings"]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = driverBookings.findIndex((b) => b.id === active.id);
    const newIndex = driverBookings.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(driverBookings, oldIndex, newIndex);
    onReorder(driverId, newOrder.map((b) => b.id));
  }

  return (
    <div className="flex flex-col h-full">
      {/* 상단 요약 */}
      <div className="px-4 py-3 bg-primary-bg border-b border-primary/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-primary">자동배차 제안</span>
          <span className="text-xs text-text-muted">
            {result.stats.assigned}건 배차 / 총 거리 {result.stats.totalDistance}km
          </span>
        </div>
        {result.unassigned.length > 0 && (
          <div className="text-xs text-semantic-orange">
            미배차 {result.unassigned.length}건 (용량 부족/좌표 없음)
          </div>
        )}
      </div>

      {/* 기사별 플랜 목록 */}
      <div className="flex-1 overflow-y-auto">
        {result.plan.map((dp) => {
          const color = driverColorMap.get(dp.driverId) || "#10B981";
          return (
            <div key={dp.driverId} className="border-b border-border-light">
              <div className="px-4 py-2 bg-bg-warm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs font-bold">{dp.driverName}</span>
                <span className="text-[11px] text-text-muted">{dp.vehicleType}</span>
                <span className="ml-auto text-[11px] text-text-muted">
                  {dp.bookings.length}건 · {dp.totalLoad.toFixed(1)}/{dp.vehicleCapacity}m³ · {dp.totalDistance.toFixed(1)}km
                  {dp.estimatedDuration != null && (
                    <span className="ml-1 text-[11px] font-medium text-primary">
                      · 약 {formatDuration(dp.estimatedDuration)} {dp.estimatedDistance != null ? `· ${formatDistance(dp.estimatedDistance)}` : ""}
                    </span>
                  )}
                </span>
              </div>
              <div className="px-4 py-1.5">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(dp.driverId, e, dp.bookings)}
                >
                  <SortableContext
                    items={dp.bookings.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {dp.bookings.flatMap((b, idx) => {
                      const stopAfterThis = dp.unloadingStops.find(
                        (s) => s.afterRouteOrder === b.routeOrder,
                      );
                      const fullBooking = bookings.find((bk) => bk.id === b.id);
                      const nextDpB = dp.bookings[idx + 1];
                      const nextFullBooking = nextDpB ? bookings.find((bk) => bk.id === nextDpB.id) : null;
                      const unloadingUp = stopAfterThis
                        ? unloadingPoints.find((p) => p.id === stopAfterThis.pointId)
                        : null;

                      // Kakao 실측 구간 데이터 (있을 경우 haversine 대체)
                      const segFromThis = dp.segments?.find((s) => s.fromBookingId === b.id);
                      const segFromUnloading = stopAfterThis
                        ? dp.segments?.find((s) => s.fromUnloadingId === stopAfterThis.pointId)
                        : undefined;

                      const elements: React.ReactNode[] = [
                        <SortableBookingRow key={b.id} booking={b} color={color} />,
                      ];

                      // 수거 소요 시간
                      const serviceMins = calcServiceMins(b.loadCube);
                      elements.push(
                        <div key={`svc-${b.id}`} className="flex items-center justify-center gap-1 py-0.5 bg-gray-50">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-text-muted opacity-70">
                            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                            <path d="M5 2.5V5L6.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                          <span className="text-[10px] text-text-muted">수거 약 {serviceMins}분</span>
                        </div>,
                      );

                      // 하차지 경유
                      if (stopAfterThis) {
                        // 현재 수거지 → 하차지 이동 (Kakao 실측 우선, fallback 하버사인)
                        if (segFromThis?.isUnloadingLeg) {
                          elements.push(
                            <div key={`t-unload-${b.id}`} className="flex items-center gap-2 py-1 px-2">
                              <div className="flex-1 border-t border-gray-200" />
                              <span className="text-[10px] text-primary-dark whitespace-nowrap px-1">
                                {segFromThis.departureTime} → {segFromThis.arrivalTime} · {Math.round(segFromThis.travelSecs / 60)}분 · {(segFromThis.distanceMeters / 1000).toFixed(1)}km
                              </span>
                              <div className="flex-1 border-t border-gray-200" />
                            </div>,
                          );
                        } else if (fullBooking?.latitude && fullBooking?.longitude && unloadingUp) {
                          const tMins = calcTravelMins(
                            fullBooking.latitude, fullBooking.longitude,
                            unloadingUp.latitude, unloadingUp.longitude,
                          );
                          elements.push(
                            <div key={`t-unload-${b.id}`} className="flex items-center gap-2 py-1 px-2">
                              <div className="flex-1 border-t border-gray-200" />
                              <span className="text-[10px] text-text-muted whitespace-nowrap px-1">↓ 이동 약 {tMins}분</span>
                              <div className="flex-1 border-t border-gray-200" />
                            </div>,
                          );
                        }
                        // 하차지 마커
                        elements.push(
                          <div key={`stop-${b.id}`} className="flex items-center gap-2 py-1.5 pl-2">
                            <div className="flex-1 border-t border-dashed border-purple-300" />
                            <span className="text-[11px] font-bold text-purple-600 whitespace-nowrap px-1">
                              ◆ {stopAfterThis.pointName}
                            </span>
                            <div className="flex-1 border-t border-dashed border-purple-300" />
                          </div>,
                        );
                        // 하차지 → 다음 수거지 이동 (Kakao 실측 우선, fallback 하버사인)
                        if (segFromUnloading && !segFromUnloading.isUnloadingLeg) {
                          elements.push(
                            <div key={`travel-${b.id}`} className="flex items-center gap-2 py-1 px-2">
                              <div className="flex-1 border-t border-gray-200" />
                              <span className="text-[10px] text-primary-dark whitespace-nowrap px-1">
                                {segFromUnloading.departureTime} → {segFromUnloading.arrivalTime} · {Math.round(segFromUnloading.travelSecs / 60)}분 · {(segFromUnloading.distanceMeters / 1000).toFixed(1)}km
                              </span>
                              <div className="flex-1 border-t border-gray-200" />
                            </div>,
                          );
                        } else if (nextFullBooking?.latitude && nextFullBooking?.longitude && unloadingUp) {
                          const tMins = calcTravelMins(unloadingUp.latitude, unloadingUp.longitude, nextFullBooking.latitude!, nextFullBooking.longitude!);
                          const km = (haversine(unloadingUp.latitude, unloadingUp.longitude, nextFullBooking.latitude!, nextFullBooking.longitude!) * ROUTE_ROAD_FACTOR).toFixed(1);
                          elements.push(
                            <div key={`travel-${b.id}`} className="flex items-center gap-2 py-1 px-2">
                              <div className="flex-1 border-t border-gray-200" />
                              <span className="text-[10px] text-text-muted whitespace-nowrap px-1">↓ 이동 약 {tMins}분 · {km}km</span>
                              <div className="flex-1 border-t border-gray-200" />
                            </div>,
                          );
                        }
                      } else if (nextFullBooking) {
                        // 하차지 없이 다음 수거지로 직접 이동 (Kakao 실측 우선, fallback 하버사인)
                        if (segFromThis && !segFromThis.isUnloadingLeg) {
                          elements.push(
                            <div key={`travel-${b.id}`} className="flex items-center gap-2 py-1 px-2">
                              <div className="flex-1 border-t border-gray-200" />
                              <span className="text-[10px] text-primary-dark whitespace-nowrap px-1">
                                {segFromThis.departureTime} → {segFromThis.arrivalTime} · {Math.round(segFromThis.travelSecs / 60)}분 · {(segFromThis.distanceMeters / 1000).toFixed(1)}km
                              </span>
                              <div className="flex-1 border-t border-gray-200" />
                            </div>,
                          );
                        } else if (nextFullBooking.latitude && nextFullBooking.longitude) {
                          const fromLat = fullBooking?.latitude;
                          const fromLng = fullBooking?.longitude;
                          if (fromLat && fromLng) {
                            const tMins = calcTravelMins(fromLat, fromLng, nextFullBooking.latitude!, nextFullBooking.longitude!);
                            const km = (haversine(fromLat, fromLng, nextFullBooking.latitude!, nextFullBooking.longitude!) * ROUTE_ROAD_FACTOR).toFixed(1);
                            elements.push(
                              <div key={`travel-${b.id}`} className="flex items-center gap-2 py-1 px-2">
                                <div className="flex-1 border-t border-gray-200" />
                                <span className="text-[10px] text-text-muted whitespace-nowrap px-1">↓ 이동 약 {tMins}분 · {km}km</span>
                                <div className="flex-1 border-t border-gray-200" />
                              </div>,
                            );
                          }
                        }
                      }

                      return elements;
                    })}
                  </SortableContext>
                </DndContext>
              </div>
              {/* 레그별 적재 현황 바 */}
              {dp.legs > 1 && (
                <div className="px-4 pb-2">
                  <LegLoadBars driverPlan={dp} color={color} />
                </div>
              )}
            </div>
          );
        })}

        {/* 미배차 */}
        {result.unassigned.length > 0 && (
          <div className="border-b border-border-light">
            <div className="px-4 py-2 bg-semantic-orange-tint/50">
              <span className="text-xs font-bold text-semantic-orange">미배차 {result.unassigned.length}건</span>
            </div>
            <div className="px-4 py-1.5 space-y-1">
              {result.unassigned.map((u) => {
                const booking = bookings.find((b) => b.id === u.id);
                return (
                  <div key={u.id} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="text-text-sub truncate flex-1">
                      {booking?.customerName || u.id} · {booking?.address || ""}
                    </span>
                    <span className="text-text-muted flex-shrink-0">{u.reason}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 하단 액션 바 */}
      <div className="border-t border-border-light px-4 py-3 flex items-center gap-2 bg-bg">
        <button
          onClick={onCancel}
          disabled={applying}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-border text-text-sub hover:bg-fill-tint transition-colors disabled:opacity-40"
        >
          취소
        </button>
        <button
          onClick={onApply}
          disabled={applying || result.plan.length === 0}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
        >
          {applying ? "적용 중..." : `${result.stats.assigned}건 배차 적용`}
        </button>
      </div>
    </div>
  );
}
