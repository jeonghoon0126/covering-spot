import type { Booking } from "@/types/booking";
import { TextField } from "@/components/ui/TextField";
import { formatPrice, formatManWon } from "@/lib/format";

interface QuoteSectionProps {
  booking: Booking;
  isLocked: boolean;
  saving: boolean;
  finalPriceInput: string;
  setFinalPriceInput: (v: string) => void;
  crewSizeInput: number | null;
  setCrewSizeInput: (v: number) => void;
  onSaveCrewSize: () => void;
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
}: QuoteSectionProps) {
  return (
    <>
      {/* 견적 */}
      <div className="bg-bg rounded-lg p-5 border border-border-light">
        <h3 className="text-sm font-semibold text-text-sub mb-3">견적</h3>
        <div className="space-y-0 text-sm">
          {booking.estimateMin != null && booking.estimateMax != null && (
            <div className="flex justify-between py-2.5 border-b border-border-light">
              <span className="text-text-sub">예상 견적 <span className="text-xs text-text-muted">(부가세 포함)</span></span>
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
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setCrewSizeInput(null as unknown as number);
                      } else {
                        setCrewSizeInput(Math.max(1, parseInt(raw) || 1));
                      }
                    }}
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
    </>
  );
}
