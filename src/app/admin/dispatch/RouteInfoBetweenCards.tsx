"use client";

import React from "react";
import { haversine } from "@/lib/optimizer/haversine";
import type { Booking, UnloadingPoint } from "@/types/booking";
import { calcServiceMins, calcTravelMins, ROUTE_ROAD_FACTOR } from "./dispatch-utils";

/* ── 타입 ── */

export interface RouteInfoBetweenCardsProps {
  booking: Booking;
  nextBooking: Booking | undefined;
  unloadingPoints: UnloadingPoint[];
  onUpdateUnloadingStop?: (bookingId: string, unloadingPointId: string | null) => Promise<void>;
  isUpdating?: boolean;
}

/* ── 수거지 간 이동시간/하차지 경유 정보 ── */

export default function RouteInfoBetweenCards({
  booking: b,
  nextBooking: nextB,
  unloadingPoints,
  onUpdateUnloadingStop,
  isUpdating,
}: RouteInfoBetweenCardsProps) {
  const elements: React.ReactNode[] = [];

  // 수거 소요 시간 표시
  const serviceMins = calcServiceMins(b.totalLoadingCube);
  elements.push(
    <div key={`svc-${b.id}`} className="flex items-center justify-center gap-1 py-0.5 bg-gray-50">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-text-muted opacity-70">
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 2.5V5L6.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="text-[10px] text-text-muted">수거 약 {serviceMins}분</span>
    </div>,
  );

  // 하차지 경유 처리
  const unloadingPoint = b.unloadingStopAfter
    ? unloadingPoints.find((p) => p.id === b.unloadingStopAfter)
    : null;

  if (unloadingPoint) {
    // b → 하차지 이동시간
    if (b.latitude && b.longitude) {
      const tMins = calcTravelMins(b.latitude, b.longitude, unloadingPoint.latitude, unloadingPoint.longitude);
      elements.push(
        <div key={`t-unload-${b.id}`} className="flex items-center gap-2 py-1 px-4">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-[10px] text-text-muted whitespace-nowrap px-1">↓ 이동 약 {tMins}분</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>,
      );
    }
    // 하차지 마커
    elements.push(
      <div key={`stop-${b.id}`} className="flex items-center gap-2 py-1.5 px-4">
        <div className="flex-1 border-t border-dashed border-purple-300" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-purple-600 whitespace-nowrap px-1">
            ◆ {unloadingPoint.name}
          </span>
          {onUpdateUnloadingStop && (
            <button
              onClick={() => onUpdateUnloadingStop(b.id, null)}
              disabled={isUpdating}
              className="text-purple-400 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="하차지 제거"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1 border-t border-dashed border-purple-300" />
      </div>,
    );
  } else if (onUpdateUnloadingStop && b.driverId && nextB) {
    // 하차지 없을 때: 하차지 추가 드롭다운
    elements.push(
      <div key={`add-unload-${b.id}`} className="flex items-center justify-center py-1">
        <select
          value=""
          disabled={isUpdating}
          onChange={(e) => {
            if (e.target.value) onUpdateUnloadingStop(b.id, e.target.value);
          }}
          className="text-xs text-text-muted bg-gray-50 border border-gray-200 rounded px-2 py-0.5 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400 hover:text-text-primary"
        >
          <option value="">+ 하차지 추가</option>
          {unloadingPoints
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>,
    );
  }

  // 다음 수거지까지 이동시간
  if (nextB && nextB.latitude && nextB.longitude) {
    // 출발지: 하차지가 있으면 하차지, 없으면 현재 수거지
    const fromLat = unloadingPoint ? unloadingPoint.latitude : b.latitude;
    const fromLng = unloadingPoint ? unloadingPoint.longitude : b.longitude;
    if (fromLat && fromLng) {
      const tMins = calcTravelMins(fromLat, fromLng, nextB.latitude!, nextB.longitude!);
      const km = (haversine(fromLat, fromLng, nextB.latitude!, nextB.longitude!) * ROUTE_ROAD_FACTOR).toFixed(1);
      elements.push(
        <div key={`travel-${b.id}`} className="flex items-center gap-2 py-1 px-4">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-[10px] text-text-muted whitespace-nowrap px-1">
            ↓ 이동 약 {tMins}분 · {km}km
          </span>
          <div className="flex-1 border-t border-gray-200" />
        </div>,
      );
    }
  }

  return <>{elements}</>;
}
