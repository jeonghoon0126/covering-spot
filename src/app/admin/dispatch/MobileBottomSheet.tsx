"use client";

import type { RefObject } from "react";
import type { Booking } from "@/types/booking";
import type { DriverStats } from "./dispatch-utils";
import OverlayCard from "./OverlayCard";

interface MobileBottomSheetProps {
  dialogRef: RefObject<HTMLDivElement | null>;
  booking: Booking;
  driverColor: string | undefined;
  driverStats: DriverStats[];
  dispatching: boolean;
  onDispatch: (driverId: string) => void;
  onUnassign: () => void;
  onDetail: () => void;
  onClose: () => void;
}

export default function MobileBottomSheet({
  dialogRef,
  booking,
  driverColor,
  driverStats,
  dispatching,
  onDispatch,
  onUnassign,
  onDetail,
  onClose,
}: MobileBottomSheetProps) {
  return (
    <div
      ref={dialogRef}
      className="lg:hidden fixed inset-0 z-30"
      role="dialog"
      aria-modal="true"
      aria-label="주문 상세"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-bg rounded-t-2xl max-h-[75vh] overflow-y-auto animate-slide-up">
        <div className="w-12 h-1 bg-fill-tint rounded-full mx-auto mt-2 mb-1" />
        <OverlayCard
          booking={booking}
          driverColor={driverColor}
          driverStats={driverStats}
          dispatching={dispatching}
          onDispatch={onDispatch}
          onUnassign={onUnassign}
          onDetail={onDetail}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
