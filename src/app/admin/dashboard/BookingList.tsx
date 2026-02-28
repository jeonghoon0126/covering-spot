"use client";

import { useRouter } from "next/navigation";
import type { Booking } from "@/types/booking";
import { formatPrice, formatManWon } from "@/lib/format";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { QUICK_ACTIONS, PAGE_SIZE } from "./dashboard-constants";

interface BookingListProps {
  bookings: Booking[];
  loading: boolean;
  debouncedSearch: string;
  dateFrom: string;
  dateTo: string;
  currentPage: number;
  currentTabTotal: number;
  // 선택
  selectedBookings: Set<string>;
  onToggleBooking: (id: string) => void;
  onToggleAll: () => void;
  // 퀵 액션
  quickLoading: string | null;
  confirmPending: { bookingId: string; newStatus: string; label: string } | null;
  onRequestQuickAction: (booking: Booking, newStatus: string, label: string) => void;
  onExecuteQuickAction: (booking: Booking) => void;
  onCancelQuickAction: () => void;
}

export function BookingList({
  bookings,
  loading,
  debouncedSearch,
  dateFrom,
  dateTo,
  currentPage,
  currentTabTotal,
  selectedBookings,
  onToggleBooking,
  onToggleAll,
  quickLoading,
  confirmPending,
  onRequestQuickAction,
  onExecuteQuickAction,
  onCancelQuickAction,
}: BookingListProps) {
  const router = useRouter();

  return (
    <>
      {/* 결과 카운트 */}
      {!loading && (
        <p className="text-xs text-text-muted mb-3">
          {currentTabTotal > 0
            ? `${((currentPage - 1) * PAGE_SIZE) + 1}–${Math.min(currentPage * PAGE_SIZE, currentTabTotal)}건 / 총 ${currentTabTotal}건`
            : "0건"}
        </p>
      )}

      {/* 전체 선택 */}
      {!loading && bookings.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={selectedBookings.size === bookings.length && bookings.length > 0}
            onChange={onToggleAll}
            className="w-4 h-4 rounded-[3px] border-border accent-primary cursor-pointer"
          />
          <span className="text-xs text-text-sub">
            이 페이지 전체 선택 {selectedBookings.size > 0 && `(${selectedBookings.size}건)`}
          </span>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-bg rounded-lg border border-border-light animate-pulse">
              <div className="flex items-start p-4">
                <div className="w-4 h-4 bg-bg-warm3 rounded mr-3 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-14 bg-bg-warm3 rounded-full" />
                      <div className="h-4 w-16 bg-bg-warm3 rounded" />
                    </div>
                    <div className="h-4 w-20 bg-bg-warm3 rounded" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-32 bg-bg-warm3 rounded" />
                      <div className="h-3 w-48 bg-bg-warm3 rounded" />
                    </div>
                    <div className="h-5 w-16 bg-bg-warm3 rounded shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">
          {debouncedSearch || dateFrom || dateTo
            ? "검색 결과가 없습니다"
            : "해당 상태의 신청이 없습니다"}
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const quickAction = QUICK_ACTIONS[b.status];
            const isQuickLoading = quickLoading === b.id;

            return (
              <div
                key={b.id}
                className="group bg-bg rounded-lg border border-border-light hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* 메인 영역 (클릭 -> 상세) */}
                <div className="flex items-start">
                  <div className="flex items-center pt-4 pl-3 max-sm:pt-3.5 max-sm:pl-2.5">
                    <input
                      type="checkbox"
                      checked={selectedBookings.has(b.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleBooking(b.id);
                      }}
                      className="w-4 h-4 rounded border-border accent-primary shrink-0"
                    />
                  </div>
                  <button
                    onClick={() => router.push(`/admin/bookings/${b.id}`)}
                    className="flex-1 p-4 max-sm:p-3.5 text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}
                        >
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                        <span className="text-xs text-text-muted font-mono">
                          #{b.id.slice(0, 8)}
                        </span>
                      </div>
                      <span className="text-xs text-text-muted shrink-0 ml-2">
                        {new Date(b.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {b.customerName} <span className="text-text-muted max-sm:hidden">|</span> <span className="max-sm:hidden">{b.phone}</span>
                        </p>
                        <p className="text-xs text-text-sub mt-0.5 truncate">
                          {b.date} {b.timeSlot} · {b.area} · {b.items.length}종
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {b.finalPrice != null ? (
                          <p className="text-sm font-bold text-primary">
                            {formatPrice(b.finalPrice)}원
                          </p>
                        ) : b.estimateMin && b.estimateMax ? (
                          <p className="text-sm font-medium text-text-neutral">
                            {formatManWon(b.estimateMin)}~{formatManWon(b.estimateMax)}원
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-text-neutral">
                            {formatPrice(b.totalPrice)}원
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </div>

                {/* 퀵 액션 바: 호버 시 표시, confirm 중이면 항상 표시 */}
                {quickAction && (
                  <div className={`px-4 max-sm:px-3.5 pb-3 max-sm:pb-2.5 transition-opacity duration-150 ${
                    confirmPending?.bookingId === b.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}>
                    {confirmPending?.bookingId === b.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-sub">&quot;{quickAction.label}&quot; 변경할까요?</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onExecuteQuickAction(b); }}
                          className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white"
                        >확인</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCancelQuickAction(); }}
                          className="px-3 py-1.5 rounded-full text-xs text-text-sub border border-border-light"
                        >취소</button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestQuickAction(b, quickAction.status, quickAction.label);
                        }}
                        disabled={isQuickLoading}
                        className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${quickAction.color} ${
                          isQuickLoading ? "opacity-50" : "hover:opacity-90"
                        }`}
                      >
                        {isQuickLoading ? "..." : quickAction.label}
                      </button>
                    )}
                  </div>
                )}
                {/* pending은 상세에서 견적 확정해야 하므로 안내 (호버 시 표시) */}
                {b.status === "pending" && (
                  <div className="px-4 max-sm:px-3.5 pb-3 max-sm:pb-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={() => router.push(`/admin/bookings/${b.id}`)}
                      className="px-4 py-2 rounded-full text-xs font-medium bg-semantic-orange-tint text-semantic-orange transition-all duration-200 hover:opacity-90"
                    >
                      견적 확정하기 →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
