"use client";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDispatchState } from "./useDispatchState";
import DispatchToast from "./DispatchToast";
import DispatchHeader from "./DispatchHeader";
import MobileTabBar from "./MobileTabBar";
import BookingListPanel from "./BookingListPanel";
import MapPanel from "./MapPanel";
import UnloadingModal from "./UnloadingModal";
import MobileBottomSheet from "./MobileBottomSheet";

/* ── 메인 페이지 ── */

export default function AdminDispatchPage() {
  const s = useDispatchState();

  if (!s.token) return null;

  return (
    <div className="h-screen bg-bg-warm flex flex-col overflow-hidden">
      {/* 토스트 */}
      <DispatchToast toast={s.toast} />

      {/* ── 헤더 ── */}
      <DispatchHeader
        selectedDate={s.selectedDate}
        filterDriverId={s.filterDriverId}
        filterSlot={s.filterSlot}
        activeBookings={s.activeBookings}
        unassignedCount={s.unassignedCount}
        driverStats={s.driverStats}
        driverColorMap={s.driverColorMap}
        onDateChange={s.setSelectedDate}
        onMoveDate={s.moveDate}
        onFilterDriverChange={(v) => { s.setFilterDriverId(v); s.setCheckedIds(new Set()); }}
        onFilterSlotChange={(v) => { s.setFilterSlot(v); s.setCheckedIds(new Set()); }}
        onNavigateCalendar={() => s.router.push("/admin/calendar")}
        onNavigateDriver={() => s.router.push("/admin/driver")}
      />

      {s.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : s.fetchError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-text-muted">데이터를 불러오지 못했습니다</p>
          <button
            onClick={() => s.fetchData()}
            className="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary-bg transition-colors"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          {/* ── 모바일 탭 전환 ── */}
          <MobileTabBar
            mobileTab={s.mobileTab}
            onSelectTab={(tab) => { s.setMobileTab(tab); if (tab === "map") s.setMobileDetail(false); }}
          />

          {/* ── 데스크톱: 좌우 분할 / 모바일: 탭 전환 ── */}
          <div className="flex-1 flex min-h-0">
            {/* ── 왼쪽: 주문 리스트 패널 ── */}
            <BookingListPanel
              bookings={s.bookings}
              activeBookings={s.activeBookings}
              filteredBookings={s.filteredBookings}
              groupedBySlot={s.groupedBySlot}
              slotOverload={s.slotOverload}
              drivers={s.drivers}
              driverStats={s.driverStats}
              driverColorMap={s.driverColorMap}
              unloadingPoints={s.unloadingPoints}
              selectedDate={s.selectedDate}
              selectedBookingId={s.selectedBookingId}
              filterDriverId={s.filterDriverId}
              checkedIds={s.checkedIds}
              batchDriverId={s.batchDriverId}
              dispatching={s.dispatching}
              autoMode={s.autoMode}
              autoResult={s.autoResult}
              autoApplying={s.autoApplying}
              partialFailedIds={s.partialFailedIds}
              showSlotConfig={s.showSlotConfig}
              driverSlotFilters={s.driverSlotFilters}
              optimizingRoute={s.optimizingRoute}
              reordering={s.reordering}
              sensors={s.sensors}
              mobileTab={s.mobileTab}
              unassignedCount={s.unassignedCount}
              onToggleCheck={s.toggleCheck}
              onToggleAllUnassigned={s.toggleAllUnassigned}
              onCardClick={s.handleCardClick}
              onDispatch={s.handleDispatch}
              onUnassign={s.handleUnassign}
              onBatchDispatch={s.handleBatchDispatch}
              onSetBatchDriverId={s.setBatchDriverId}
              onSetPartialFailedIds={s.setPartialFailedIds}
              onOptimizeRoute={s.handleOptimizeRoute}
              onFlatListReorder={s.handleFlatListReorder}
              onAutoDispatch={s.handleAutoDispatch}
              onAutoApply={s.handleAutoApply}
              onAutoCancel={s.handleAutoCancel}
              onAutoReorder={s.handleAutoReorder}
              onToggleSlotConfig={() => s.setShowSlotConfig((v) => !v)}
              onToggleDriverSlot={s.toggleDriverSlot}
              onShowUnloadingModal={() => s.setShowUnloadingModal(true)}
              onNavigateDriver={() => s.router.push("/admin/driver")}
              cardRefs={s.cardRefs}
            />

            {/* ── 오른쪽: 지도 ── */}
            <MapPanel
              mapRef={s.mapRef}
              markers={s.autoMode === "preview" ? s.previewMapMarkers : s.mapMarkers}
              unloadingMarkers={s.unloadingMapMarkers}
              routeLines={s.mapRouteLines}
              selectedMarkerId={s.selectedBookingId}
              onMarkerClick={s.handleMarkerClick}
              driverStats={s.driverStats}
              driverColorMap={s.driverColorMap}
              driverSlotBreakdown={s.driverSlotBreakdown}
              filterDriverId={s.filterDriverId}
              driverPanelOpen={s.driverPanelOpen}
              activeBookings={s.activeBookings}
              unloadingPoints={s.unloadingPoints}
              onToggleDriverPanel={s.setDriverPanelOpen}
              onSelectDriver={s.setFilterDriverId}
              selectedDate={s.selectedDate}
              activeBookingsCount={s.activeBookings.length}
              unassignedCount={s.unassignedCount}
              selectedBooking={s.selectedBooking}
              dispatching={s.dispatching}
              onDispatch={s.handleDispatch}
              onUnassign={s.handleUnassign}
              onDetail={(id) => s.router.push(`/admin/bookings/${id}`)}
              onCloseOverlay={() => s.setSelectedBookingId(null)}
              mobileTab={s.mobileTab}
              autoMode={s.autoMode}
            />
          </div>

          {/* ── 하차지 관리 모달 ── */}
          {s.showUnloadingModal && (
            <UnloadingModal
              token={s.token}
              points={s.unloadingPoints}
              onClose={() => s.setShowUnloadingModal(false)}
              onRefresh={s.fetchUnloadingPoints}
              onToast={s.showToast}
            />
          )}

          {/* ── 모바일 바텀시트 ── */}
          {s.mobileDetail && s.selectedBooking && (
            <MobileBottomSheet
              dialogRef={s.mobileDialogRef}
              booking={s.selectedBooking}
              driverColor={s.selectedBooking.driverId ? s.driverColorMap.get(s.selectedBooking.driverId) : undefined}
              driverStats={s.driverStats}
              dispatching={s.dispatching}
              onDispatch={(dId) => s.handleDispatch(s.selectedBooking!.id, dId)}
              onUnassign={() => s.handleUnassign(s.selectedBooking!.id)}
              onDetail={() => s.router.push(`/admin/bookings/${s.selectedBooking!.id}`)}
              onClose={() => s.setMobileDetail(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
