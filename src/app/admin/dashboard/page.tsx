"use client";

import { useCallback } from "react";
import { safeSessionSet, safeSessionRemove } from "@/lib/storage";
import { useDashboardState } from "./useDashboardState";
import { exportCSV } from "./dashboard-utils";
import { DashboardHeader } from "./DashboardHeader";
import { SearchFilters } from "./SearchFilters";
import { StatusTabs } from "./StatusTabs";
import { BookingList } from "./BookingList";
import { Pagination } from "./Pagination";
import { BulkActionBar } from "./BulkActionBar";
import { SheetImportModal } from "./SheetImportModal";

export default function AdminDashboardPage() {
  const state = useDashboardState();

  const handleExportCSV = useCallback(() => {
    exportCSV({
      token: state.token,
      activeTab: state.activeTab,
      debouncedSearch: state.debouncedSearch,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      showToast: state.showToast,
    });
  }, [state.token, state.activeTab, state.debouncedSearch, state.dateFrom, state.dateTo, state.showToast]);

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <DashboardHeader
        unreadCount={state.unreadCount}
        onSheetImport={() => state.setShowSheetImport(true)}
        onExportCSV={handleExportCSV}
        onRefresh={state.fetchBookings}
        autoRefresh={state.autoRefresh}
        onToggleAutoRefresh={() => {
          const next = !state.autoRefresh;
          state.setAutoRefresh(next);
          if (next) safeSessionSet("admin_auto_refresh", "1");
          else safeSessionRemove("admin_auto_refresh");
        }}
      />

      <div className="max-w-[56rem] mx-auto px-4 py-4">
        {/* 검색 + 필터 */}
        <SearchFilters
          search={state.search}
          onSearchChange={state.setSearch}
          showFilters={state.showFilters}
          onToggleFilters={() => state.setShowFilters(!state.showFilters)}
          dateFrom={state.dateFrom}
          dateTo={state.dateTo}
          onDateChange={state.handleDateChange}
          onResetDates={() => {
            state.handleDateChange("from", "");
            state.handleDateChange("to", "");
          }}
        />

        {/* 상태 탭 */}
        <StatusTabs
          activeTab={state.activeTab}
          counts={state.counts}
          totalCount={state.totalCount}
          onTabChange={state.handleTabChange}
        />

        {/* 예약 목록 + 퀵 액션 */}
        <BookingList
          bookings={state.bookings}
          loading={state.loading}
          debouncedSearch={state.debouncedSearch}
          dateFrom={state.dateFrom}
          dateTo={state.dateTo}
          currentPage={state.currentPage}
          currentTabTotal={state.currentTabTotal}
          selectedBookings={state.selectedBookings}
          onToggleBooking={state.toggleBooking}
          onToggleAll={state.toggleAll}
          quickLoading={state.quickLoading}
          confirmPending={state.confirmPending}
          onRequestQuickAction={state.requestQuickAction}
          onExecuteQuickAction={state.executeQuickAction}
          onCancelQuickAction={() => state.setConfirmPending(null)}
        />

        {/* 페이지네이션 */}
        {!state.loading && (
          <Pagination
            currentPage={state.currentPage}
            totalPages={state.totalPages}
            onPageChange={state.setCurrentPage}
          />
        )}
      </div>

      {/* 벌크 상태 변경 바 */}
      <BulkActionBar
        selectedCount={state.selectedBookings.size}
        bulkStatus={state.bulkStatus}
        onBulkStatusChange={state.setBulkStatus}
        bulkLoading={state.bulkLoading}
        bulkConfirmPending={state.bulkConfirmPending}
        onBulkConfirmRequest={() => {
          if (state.bulkStatus && state.selectedBookings.size > 0) state.setBulkConfirmPending(true);
        }}
        onBulkExecute={state.executeBulkStatusChange}
        onBulkConfirmCancel={() => state.setBulkConfirmPending(false)}
        onClearSelection={() => {
          state.setSelectedBookings(new Set());
          state.setBulkStatus("");
        }}
      />

      {/* 시트 임포트 모달 */}
      <SheetImportModal
        show={state.showSheetImport}
        sheetURL={state.sheetURL}
        onSheetURLChange={state.setSheetURL}
        sheetStep={state.sheetStep}
        onStepChange={state.setSheetStep}
        sheetRows={state.sheetRows}
        sheetLoading={state.sheetLoading}
        sheetResult={state.sheetResult}
        onPreview={state.handleSheetPreview}
        onImport={state.handleSheetImport}
        onClose={state.closeSheetImport}
      />

      {/* 토스트 메시지 */}
      {state.toast && (
        <div
          className={`fixed bottom-20 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all duration-200 ${
            state.toast.isError ? "bg-semantic-red text-white" : "bg-semantic-green text-white"
          }`}
        >
          {state.toast.msg}
        </div>
      )}
    </div>
  );
}
