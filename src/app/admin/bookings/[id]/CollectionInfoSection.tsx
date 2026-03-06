import type { Booking } from "@/types/booking";
import { formatPrice } from "@/lib/format";
import { TIME_SLOT_OPTIONS, DURATION_OPTIONS } from "./booking-detail-constants";

interface CollectionInfoSectionProps {
  booking: Booking;
  isLocked: boolean;
  dateInput: string;
  setDateInput: (v: string) => void;
  confirmedTimeInput: string;
  setConfirmedTimeInput: (v: string) => void;
  slotAvailability: Record<string, { available: boolean; count: number }>;
  confirmedDurationInput: number | null;
  setConfirmedDurationInput: (v: number) => void;
}

export function CollectionInfoSection({
  booking,
  isLocked,
  dateInput,
  setDateInput,
  confirmedTimeInput,
  setConfirmedTimeInput,
  slotAvailability,
  confirmedDurationInput,
  setConfirmedDurationInput,
}: CollectionInfoSectionProps) {
  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <h3 className="text-sm font-semibold text-text-sub mb-3">
        수거 정보
      </h3>
      <div className="space-y-0 text-sm">
        <div className={`flex justify-between py-2.5 border-b border-border-light`}>
          <span className="text-text-sub">희망일</span>
          <span className="font-medium">
            {booking.date} {booking.timeSlot}
          </span>
        </div>
        {booking.preferredSlots && booking.preferredSlots.length > 0 && (
          <div className="flex justify-between py-2.5 border-b border-border-light">
            <span className="text-text-sub">선호 시간대</span>
            <span className="font-medium text-right">{booking.preferredSlots.join(", ")}</span>
          </div>
        )}
        <div className="flex justify-between py-2.5 border-b border-border-light">
          <span className="text-text-sub">지역</span>
          <span className="font-medium">{booking.area}</span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-border-light">
          <span className="text-text-sub">엘리베이터</span>
          <span className="font-medium">
            {booking.hasElevator === true
              ? "사용 가능"
              : booking.hasElevator === false
                ? "사용 불가"
                : "-"}
          </span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-border-light">
          <span className="text-text-sub">주차</span>
          <span className="font-medium">
            {booking.hasParking === true
              ? "가능"
              : booking.hasParking === false
                ? "불가능"
                : "-"}
          </span>
        </div>
        <div
          className={`flex justify-between py-2.5 ${
            booking.needLadder || booking.memo ? "border-b border-border-light" : ""
          }`}
        >
          <span className="text-text-sub">지상 출입</span>
          <span className="font-medium">
            {booking.hasGroundAccess === true
              ? "가능"
              : booking.hasGroundAccess === false
                ? "불가"
                : "-"}
          </span>
        </div>
        {booking.needLadder && (
          <div
            className={`flex justify-between py-2.5 ${
              booking.memo ? "border-b border-border-light" : ""
            }`}
          >
            <span className="text-text-sub">사다리차</span>
            <span className="font-medium">
              {booking.ladderType} | {formatPrice(booking.ladderPrice)}원
            </span>
          </div>
        )}
        {booking.memo && (
          <div className="flex justify-between py-2.5 border-b border-border-light">
            <span className="text-text-sub shrink-0">요청사항</span>
            <span className="font-medium text-right max-w-[60%] break-words [overflow-wrap:anywhere]">
              {booking.memo}
            </span>
          </div>
        )}
        {(booking.totalLoadingCube ?? 0) > 0 && (
          <div
            className={`flex justify-between py-2.5 ${
              booking.driverName ? "border-b border-border-light" : ""
            }`}
          >
            <span className="text-text-sub">적재 큐브</span>
            <span className="font-semibold text-primary">
              {(booking.totalLoadingCube || 0).toFixed(1)}m&sup3;
            </span>
          </div>
        )}
        {booking.driverName && (
          <div className="flex justify-between py-2.5">
            <span className="text-text-sub">배차 기사</span>
            <span className="font-medium">{booking.driverName}</span>
          </div>
        )}
      </div>

      {/* 수거 일자/시간 확정 */}
      <div className="mt-4 pt-4 border-t border-border-light">
        <h3 className="text-sm font-semibold text-text-sub mb-3">수거 일자/시간 확정</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text-sub mb-2 block">수거일</label>
            {isLocked ? (
              <p className="text-sm font-medium">{dateInput || booking.date}</p>
            ) : (
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg-warm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
              />
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-text-sub mb-2 block">수거시간</label>
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
          </div>

          <div>
             <label className="text-xs font-medium text-text-sub mb-2 block">예상 소요시간</label>
             {isLocked ? (
                <>
                {booking.confirmedDuration != null && (
                    <p className="text-sm font-medium">
                      {booking.confirmedDuration >= 60
                        ? `${Math.floor(booking.confirmedDuration / 60)}시간${
                            booking.confirmedDuration % 60
                              ? `${booking.confirmedDuration % 60}분`
                              : ""
                          }`
                        : `${booking.confirmedDuration}분`}
                    </p>
                  )}
                </>
             ) : (
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
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
