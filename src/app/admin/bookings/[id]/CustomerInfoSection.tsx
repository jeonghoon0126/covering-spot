import type { Booking } from "@/types/booking";

interface CustomerInfoSectionProps {
  booking: Booking;
}

export function CustomerInfoSection({ booking }: CustomerInfoSectionProps) {
  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <h3 className="text-sm font-semibold text-text-sub mb-3">
        고객 정보
      </h3>
      <div className="space-y-0 text-sm">
        <div className="flex justify-between py-2.5 border-b border-border-light">
          <span className="text-text-sub">이름</span>
          <span className="font-medium">{booking.customerName}</span>
        </div>
        <div className="flex justify-between py-2.5 border-b border-border-light">
          <span className="text-text-sub">전화번호</span>
          <a
            href={`tel:${booking.phone}`}
            className="font-medium text-primary"
          >
            {booking.phone}
          </a>
        </div>
        <div className="flex justify-between py-2.5">
          <span className="text-text-sub shrink-0">주소</span>
          <span className="font-medium text-right max-w-[60%] break-words [overflow-wrap:anywhere]">
            {booking.address} {booking.addressDetail}
          </span>
        </div>
      </div>
    </div>
  );
}
