import type { Booking } from "@/types/booking";
import { formatPrice } from "@/lib/format";

interface CollectionInfoSectionProps {
  booking: Booking;
}

export function CollectionInfoSection({ booking }: CollectionInfoSectionProps) {
  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <h3 className="text-sm font-semibold text-text-sub mb-3">
        수거 정보
      </h3>
      <div className="space-y-0 text-sm">
        <div className="flex justify-between py-2.5 border-b border-border-light">
          <span className="text-text-sub">희망일</span>
          <span className="font-medium">
            {booking.date} {booking.timeSlot}
          </span>
        </div>
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
    </div>
  );
}
