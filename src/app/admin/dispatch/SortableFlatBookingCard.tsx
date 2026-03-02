"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BookingCard from "./BookingCard";
import type { BookingCardProps } from "./BookingCard";

/* ── 타입 ── */

export interface SortableFlatBookingCardProps extends BookingCardProps {
  cardRef: (el: HTMLDivElement | null) => void;
}

/* ── 드래그 가능한 배차 카드 (flat list DnD용) ── */

export default function SortableFlatBookingCard({
  cardRef,
  booking,
  isSelected,
  isChecked,
  driverColor,
  driverStats,
  dispatching,
  estimatedVisitTime,
  onCheck,
  onClick,
  onDispatch,
  onUnassign,
}: SortableFlatBookingCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: booking.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex"
    >
      {/* 드래그 핸들 컬럼 (좌측) — 배차 해제 버튼과 겹치지 않도록 별도 컬럼 */}
      <button
        {...listeners}
        {...attributes}
        className="flex flex-col items-center justify-center gap-0.5 w-6 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-text-muted hover:text-text-primary hover:bg-fill-tint transition-colors border-r border-border-light/50"
        title="순서 변경"
        tabIndex={-1}
        aria-hidden="true"
      >
        {booking.routeOrder != null && (
          <span className="text-[10px] font-bold leading-none tabular-nums">{booking.routeOrder}</span>
        )}
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
          <circle cx="3" cy="2" r="1" fill="currentColor"/>
          <circle cx="7" cy="2" r="1" fill="currentColor"/>
          <circle cx="3" cy="6" r="1" fill="currentColor"/>
          <circle cx="7" cy="6" r="1" fill="currentColor"/>
          <circle cx="3" cy="10" r="1" fill="currentColor"/>
          <circle cx="7" cy="10" r="1" fill="currentColor"/>
        </svg>
      </button>
      {/* 카드 본체 */}
      <div className="flex-1 min-w-0">
        <BookingCard
          ref={cardRef}
          booking={booking}
          isSelected={isSelected}
          isChecked={isChecked}
          driverColor={driverColor}
          driverStats={driverStats}
          dispatching={dispatching}
          estimatedVisitTime={estimatedVisitTime}
          onCheck={onCheck}
          onClick={onClick}
          onDispatch={onDispatch}
          onUnassign={onUnassign}
        />
      </div>
    </div>
  );
}
