"use client";

import type { RefObject } from "react";
import KakaoMap from "@/components/admin/KakaoMap";
import type { KakaoMapHandle, MapMarker, UnloadingMarker, RouteLine } from "@/components/admin/KakaoMap";
import type { Booking, UnloadingPoint } from "@/types/booking";
import type { DriverStats } from "./dispatch-utils";
import { UNASSIGNED_COLOR, formatDateShort } from "./dispatch-utils";
import OverlayCard from "./OverlayCard";
import DriverLoadingPanel from "./DriverLoadingPanel";

interface MapPanelProps {
  mapRef: RefObject<KakaoMapHandle | null>;
  markers: MapMarker[];
  unloadingMarkers: UnloadingMarker[];
  routeLines: RouteLine[];
  selectedMarkerId: string | null;
  onMarkerClick: (id: string) => void;

  // 기사 패널
  driverStats: DriverStats[];
  driverColorMap: Map<string, string>;
  driverSlotBreakdown: Map<string, Record<string, number>>;
  filterDriverId: string;
  driverPanelOpen: boolean;
  activeBookings: Booking[];
  unloadingPoints: UnloadingPoint[];
  onToggleDriverPanel: (open: boolean) => void;
  onSelectDriver: (id: string) => void;

  // 요약 오버레이
  selectedDate: string;
  activeBookingsCount: number;
  unassignedCount: number;

  // 선택된 예약 오버레이 (데스크톱)
  selectedBooking: Booking | null;
  dispatching: boolean;
  onDispatch: (bookingId: string, driverId: string) => void;
  onUnassign: (bookingId: string) => void;
  onDetail: (bookingId: string) => void;
  onCloseOverlay: () => void;

  // 모바일
  mobileTab: "map" | "list";
  autoMode: "idle" | "loading" | "preview";
}

export default function MapPanel({
  mapRef,
  markers,
  unloadingMarkers,
  routeLines,
  selectedMarkerId,
  onMarkerClick,
  driverStats,
  driverColorMap,
  driverSlotBreakdown,
  filterDriverId,
  driverPanelOpen,
  activeBookings,
  unloadingPoints,
  onToggleDriverPanel,
  onSelectDriver,
  selectedDate,
  activeBookingsCount,
  unassignedCount,
  selectedBooking,
  dispatching,
  onDispatch,
  onUnassign,
  onDetail,
  onCloseOverlay,
  mobileTab,
  autoMode,
}: MapPanelProps) {
  return (
    <div className={`flex-1 relative ${
      mobileTab === "map" ? "flex" : "hidden lg:flex"
    }`}>
      <KakaoMap
        ref={mapRef}
        markers={markers}
        unloadingMarkers={unloadingMarkers}
        routeLines={routeLines}
        selectedMarkerId={selectedMarkerId}
        onMarkerClick={onMarkerClick}
        disableAutoFit={filterDriverId !== "all" && filterDriverId !== "unassigned"}
        className="w-full h-full min-h-[400px]"
      />

      {/* 요약 오버레이 */}
      <div className="absolute top-4 left-4 bg-bg/90 backdrop-blur-sm rounded-lg border border-border-light px-3 py-2 text-xs space-y-0.5 pointer-events-none">
        <div className="font-semibold">{formatDateShort(selectedDate)}</div>
        <div>전체 {activeBookingsCount}건</div>
        <div style={{ color: UNASSIGNED_COLOR }}>미배차 {unassignedCount}건</div>
      </div>

      {/* 기사 적재 현황 오버레이 — 우측 상단 */}
      <DriverLoadingPanel
        driverStats={driverStats}
        driverColorMap={driverColorMap}
        driverSlotBreakdown={driverSlotBreakdown}
        filterDriverId={filterDriverId}
        isOpen={driverPanelOpen}
        activeBookings={activeBookings}
        unloadingPoints={unloadingPoints}
        onToggleOpen={onToggleDriverPanel}
        onSelectDriver={onSelectDriver}
        onFitToPositions={(positions) => setTimeout(() => mapRef.current?.fitToPositions(positions), 50)}
      />

      {/* 지도 위 선택된 주문 오버레이 — 데스크톱 */}
      {selectedBooking && (
        <div className="hidden lg:block absolute bottom-4 right-4 z-10 w-[320px] bg-bg rounded-xl border border-border-light shadow-lg overflow-hidden">
          <OverlayCard
            booking={selectedBooking}
            driverColor={selectedBooking.driverId ? driverColorMap.get(selectedBooking.driverId) : undefined}
            driverStats={driverStats}
            dispatching={dispatching}
            onDispatch={(dId) => onDispatch(selectedBooking.id, dId)}
            onUnassign={() => onUnassign(selectedBooking.id)}
            onDetail={() => onDetail(selectedBooking.id)}
            onClose={onCloseOverlay}
          />
        </div>
      )}
    </div>
  );
}
