import type { Booking } from "@/types/booking";
import { TextField } from "@/components/ui/TextField";
import { formatPrice, formatManWon } from "@/lib/format";
import { TIME_SLOT_OPTIONS, DURATION_OPTIONS } from "./booking-detail-constants";

interface QuoteSectionProps {
  booking: Booking;
  isLocked: boolean;
  saving: boolean;
  finalPriceInput: string;
  setFinalPriceInput: (v: string) => void;
  crewSizeInput: number | null;
  setCrewSizeInput: (v: number) => void;
  onSaveCrewSize: () => void;
  confirmedTimeInput: string;
  setConfirmedTimeInput: (v: string) => void;
  slotAvailability: Record<string, { available: boolean; count: number }>;
  confirmedDurationInput: number | null;
  setConfirmedDurationInput: (v: number) => void;
}

export function QuoteSection({
  booking,
  isLocked,
  saving,
  finalPriceInput,
  setFinalPriceInput,
  crewSizeInput,
  setCrewSizeInput,
  onSaveCrewSize,
  confirmedTimeInput,
  setConfirmedTimeInput,
  slotAvailability,
  confirmedDurationInput,
  setConfirmedDurationInput,
}: QuoteSectionProps) {
  return (
    <>
      {/* 견적 */}
      <div className="bg-bg rounded-lg p-5 border border-border-light">
        <h3 className="text-sm font-semibold text-text-sub mb-3">견적</h3>
        <div className="space-y-0 text-sm">
          {booking.estimateMin != null && booking.estimateMax != null && (
            <div className="flex justify-between py-2.5 border-b border-border-light">
              <span className="text-text-sub">예상 견적</span>
              <span className="font-medium">
                {formatManWon(booking.estimateMin)} ~{" "}
                {formatManWon(booking.estimateMax)}원
              </span>
            </div>
          )}
          <div
            className={`flex justify-between items-center py-2.5 ${
              booking.finalPrice != null ? "border-b border-border-light" : ""
            }`}
          >
            <span className="text-text-sub">자동 산정</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {formatPrice(booking.totalPrice)}원
              </span>
              {isLocked ? (
                <span className="text-sm text-text-muted">
                  ({booking.crewSize}명)
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-text-muted">(인력</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={crewSizeInput ?? booking.crewSize}
                    onChange={(e) =>
                      setCrewSizeInput(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className="w-10 h-7 px-1 text-center text-sm rounded border border-border-light bg-bg-warm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
                  />
                  <span className="text-sm text-text-muted">명)</span>
                  {crewSizeInput !== booking.crewSize && (
                    <button
                      onClick={onSaveCrewSize}
                      disabled={saving}
                      className="text-[11px] font-semibold text-primary border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/5 transition-colors disabled:opacity-50"
                    >
                      저장
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {booking.finalPrice != null && (
            <div className="flex justify-between py-2.5 text-primary font-bold">
              <span>최종 견적</span>
              <span>{formatPrice(booking.finalPrice)}원</span>
            </div>
          )}
        </div>

        {/* 최종 견적 입력 — 수거 시작 이후 잠금 */}
        {!isLocked && (
          <div className="mt-4 pt-3 border-t border-border-light">
            <TextField
              label="최종 견적 (원)"
              value={finalPriceInput}
              onChange={(e) =>
                setFinalPriceInput(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder={
                booking.estimateMin != null && booking.estimateMax != null
                  ? `${formatManWon(booking.estimateMin)} ~ ${formatManWon(booking.estimateMax)}원`
                  : "금액 입력"
              }
            />
            <div className="flex items-center gap-2 mt-1">
              {finalPriceInput && (
                <p className="text-xs text-text-muted">
                  {formatPrice(Number(finalPriceInput))}원
                </p>
              )}
              {!finalPriceInput &&
                booking.estimateMin != null &&
                booking.estimateMax != null && (
                  <button
                    type="button"
                    onClick={() =>
                      setFinalPriceInput(
                        String(
                          Math.round(
                            (booking.estimateMin! + booking.estimateMax!) /
                              2 /
                              10000
                          ) * 10000
                        )
                      )
                    }
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    예상 견적 적용
                  </button>
                )}
            </div>
          </div>
        )}
      </div>

      {/* 수거 시간 확정 */}
      <div className="bg-bg rounded-lg p-5 border border-border-light">
        <h3 className="text-sm font-semibold text-text-sub mb-3">
          수거 시간 확정
        </h3>
        {/* 고객 희망 시간대 표시 */}
        {booking.preferredSlots && booking.preferredSlots.length > 1 ? (
          <p className="text-xs text-text-muted mb-2">
            고객 희망:{" "}
            <span className="font-semibold text-text-primary">
              {booking.preferredSlots.join(", ")}
            </span>
          </p>
        ) : booking.timeSlot && (
          <p className="text-xs text-text-muted mb-2">
            고객 희망:{" "}
            <span className="font-semibold text-text-primary">
              {booking.timeSlot}
            </span>
          </p>
        )}
        {booking.confirmedTime && (
          <p className="text-sm text-primary font-semibold mb-3">
            확정: {booking.confirmedTime}
          </p>
        )}
        {isLocked ? (
          <p className="text-xs text-text-muted">
            {booking.confirmedTime
              ? "수거 진행 중에는 시간을 변경할 수 없습니다"
              : "확정된 시간이 없습니다"}
          </p>
        ) : (
          <div className="grid grid-cols-4 max-sm:grid-cols-3 gap-2">
            {TIME_SLOT_OPTIONS.map((slot) => {
              const info = slotAvailability[slot];
              const isFull = info && !info.available;
              return (
                <button
                  key={slot}
                  onClick={() => !isFull && setConfirmedTimeInput(slot)}
                  disabled={isFull}
                  className={`py-2.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    isFull
                      ? "bg-fill-tint text-text-muted cursor-not-allowed"
                      : confirmedTimeInput === slot
                        ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                        : "bg-bg-warm hover:bg-primary-bg"
                  }`}
                >
                  {slot}
                  {isFull && (
                    <span className="block text-[10px] text-semantic-red/70">
                      예약됨
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 소요시간 선택 — 수거 시작 이후 잠금 */}
        {!isLocked && (
          <div className="mt-4 pt-3 border-t border-border-light">
            <p className="text-xs font-medium text-text-sub mb-2">
              예상 소요시간
            </p>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setConfirmedDurationInput(opt.value)}
                  className={`py-2.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    confirmedDurationInput === opt.value
                      ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                      : "bg-bg-warm hover:bg-primary-bg"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {isLocked && booking.confirmedDuration != null && (
          <div className="mt-4 pt-3 border-t border-border-light">
            <p className="text-xs font-medium text-text-sub mb-1">
              예상 소요시간
            </p>
            <p className="text-sm font-medium">
              {booking.confirmedDuration >= 60
                ? `${Math.floor(booking.confirmedDuration / 60)}시간${
                    booking.confirmedDuration % 60
                      ? `${booking.confirmedDuration % 60}분`
                      : ""
                  }`
                : `${booking.confirmedDuration}분`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
