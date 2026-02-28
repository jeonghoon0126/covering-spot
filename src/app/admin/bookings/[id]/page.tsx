"use client";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { useBookingDetail } from "./useBookingDetail";
import { CustomerInfoSection } from "./CustomerInfoSection";
import { CollectionInfoSection } from "./CollectionInfoSection";
import { ItemsSection } from "./ItemsSection";
import { QuoteSection } from "./QuoteSection";
import { StatusActionsSection } from "./StatusActionsSection";
import { AdminMemoSection } from "./AdminMemoSection";
import {
  PhotosSection,
  CompletionPhotosUpload,
  CompletionPhotosReadonly,
} from "./PhotosSection";
import { AuditLogSection } from "./AuditLogSection";

export default function AdminBookingDetailPage() {
  const {
    router,
    booking,
    loading,
    saving,
    isLocked,
    nextActions,
    finalPriceInput,
    setFinalPriceInput,
    adminMemoInput,
    setAdminMemoInput,
    confirmedTimeInput,
    setConfirmedTimeInput,
    slotAvailability,
    confirmedDurationInput,
    setConfirmedDurationInput,
    crewSizeInput,
    setCrewSizeInput,
    editingItems,
    itemEdits,
    startEditingItems,
    cancelEditingItems,
    updateItemEdit,
    completionPhotos,
    uploadingPhotos,
    handlePhotoUpload,
    removeCompletionPhoto,
    auditLogs,
    auditOpen,
    setAuditOpen,
    loadAuditLogs,
    handleStatusChange,
    handleSaveCrewSize,
    handleSaveMemo,
    handleSaveItems,
  } = useBookingDetail();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-warm flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-bg-warm flex items-center justify-center">
        <p className="text-text-muted">예약을 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/admin/dashboard`)}
            className="text-text-sub hover:text-text-primary transition-colors duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="text-lg font-bold">신청 상세</h1>
        </div>
      </div>

      <div className="max-w-[42rem] mx-auto px-4 py-4 space-y-4">
        {/* 상태 + ID */}
        <div className="bg-bg rounded-lg p-5 border border-border-light flex items-center justify-between">
          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[booking.status] || STATUS_COLORS.pending}`}
          >
            {STATUS_LABELS[booking.status] || booking.status}
          </span>
          <span className="text-xs text-text-muted font-mono">
            #{booking.id.slice(0, 12)}
          </span>
        </div>

        <CustomerInfoSection booking={booking} />

        <CollectionInfoSection booking={booking} />

        <ItemsSection
          booking={booking}
          isLocked={isLocked}
          editingItems={editingItems}
          itemEdits={itemEdits}
          saving={saving}
          onStartEditing={startEditingItems}
          onCancelEditing={cancelEditingItems}
          onUpdateItemEdit={updateItemEdit}
          onSaveItems={handleSaveItems}
        />

        <PhotosSection booking={booking} />

        <QuoteSection
          booking={booking}
          isLocked={isLocked}
          saving={saving}
          finalPriceInput={finalPriceInput}
          setFinalPriceInput={setFinalPriceInput}
          crewSizeInput={crewSizeInput}
          setCrewSizeInput={setCrewSizeInput}
          onSaveCrewSize={handleSaveCrewSize}
          confirmedTimeInput={confirmedTimeInput}
          setConfirmedTimeInput={setConfirmedTimeInput}
          slotAvailability={slotAvailability}
          confirmedDurationInput={confirmedDurationInput}
          setConfirmedDurationInput={setConfirmedDurationInput}
        />

        <AdminMemoSection
          adminMemoInput={adminMemoInput}
          setAdminMemoInput={setAdminMemoInput}
          saving={saving}
          onSaveMemo={handleSaveMemo}
        />

        {booking.status === "in_progress" && (
          <CompletionPhotosUpload
            completionPhotos={completionPhotos}
            uploadingPhotos={uploadingPhotos}
            onPhotoUpload={handlePhotoUpload}
            onRemovePhoto={removeCompletionPhoto}
          />
        )}

        {["completed", "payment_requested", "payment_completed"].includes(
          booking.status
        ) && (
          <CompletionPhotosReadonly completionPhotos={completionPhotos} />
        )}

        <StatusActionsSection
          nextActions={nextActions}
          saving={saving}
          onStatusChange={handleStatusChange}
        />

        <AuditLogSection
          auditLogs={auditLogs}
          auditOpen={auditOpen}
          onToggle={() => {
            if (!auditOpen) loadAuditLogs();
            setAuditOpen(!auditOpen);
          }}
        />

        <div className="h-8" />
      </div>
    </div>
  );
}
