"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Booking } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { subscribeToPush } from "@/lib/push-subscription";
import { KAKAO_CHAT_URL } from "@/lib/constants";
import { KakaoIcon } from "@/components/ui/KakaoIcon";
import { track, identify } from "@/lib/analytics";
import { formatPrice, formatManWon } from "@/lib/format";

export default function BookingCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20">
          <LoadingSpinner size="lg" />
          <p className="text-text-muted mt-4 text-sm">로딩 중...</p>
        </div>
      }
    >
      <BookingCompleteContent />
    </Suspense>
  );
}

function BookingCompleteContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushDenied, setPushDenied] = useState(false);
  const [supportsNotification, setSupportsNotification] = useState(false);

  // 마운트 시 알림 권한 체크
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setSupportsNotification(true);
      if (Notification.permission === "granted") {
        setPushSubscribed(true);
      } else if (Notification.permission === "denied") {
        setPushDenied(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.booking) setBooking(d.booking);
        else setError("신청 정보를 찾을 수 없습니다");
      })
      .catch(() => setError("조회 실패"));
  }, [id]);

  // 예약 완료 트래킹
  useEffect(() => {
    if (id) {
      track("[EVENT] SpotBookingComplete", { bookingId: id });
      // bookingId로 identify (폰번호는 complete 페이지에서 알 수 없으므로 bookingId 사용)
      identify(id);
    }
  }, [id]);

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted mb-4">{error}</p>
        <Link href="/booking" className="text-primary font-semibold">
          다시 신청하기
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20 flex flex-col items-center">
        <LoadingSpinner size="lg" />
        <p className="text-text-muted mt-4 text-sm">신청 정보 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 완료 헤더 — 성공 애니메이션 */}
      <div className="text-center py-8">
        <div className="relative w-24 h-24 flex items-center justify-center mx-auto mb-5">
          {/* 확산 링 */}
          <div className="animate-success-ring1" />
          <div className="animate-success-ring2" />
          {/* 컨페티 파티클 */}
          {[0,1,2,3,4,5,6,7].map((i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ['#059669','#10B981','#34D399','#6EE7B7','#1AA3FF','#FCD34D','#F472B6','#A78BFA'][i],
                top: '50%', left: '50%',
                transform: `rotate(${i * 45}deg) translateX(${28}px)`,
                opacity: 0,
                animation: `success-confetti 0.7s cubic-bezier(0.16,1,0.3,1) ${0.5 + i * 0.04}s both`,
              }}
            />
          ))}
          {/* 메인 원 + 체크 */}
          <svg width="80" height="80" viewBox="0 0 48 48" fill="none" className="animate-success-circle relative z-10">
            <circle cx="24" cy="24" r="22" fill="#EDFCF6" />
            <circle cx="24" cy="24" r="17" fill="#D1FAE5" />
            <path d="M15 24l6 6L33 18" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="animate-success-check" />
          </svg>
          {/* 반짝임 */}
          <div className="absolute inset-0 rounded-full overflow-hidden animate-success-shimmer z-20 pointer-events-none" />
        </div>
        <h1 className="text-2xl font-bold mb-2 animate-success-fadeup" style={{ animationDelay: '0.7s' }}>
          수거 신청이 접수되었습니다
        </h1>
        <p className="text-text-sub text-sm animate-success-fadeup" style={{ animationDelay: '0.85s' }}>
          담당자가 확인 후 최종 견적을 안내드립니다 (영업일 기준 24시간 이내)
        </p>
      </div>

      {/* 상태 표시 */}
      <div className="bg-semantic-orange-tint rounded-lg p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="16" fill="#FFF7E5" />
            <circle cx="18" cy="18" r="13" fill="#FFEDD5" />
            <path d="M18 10v8l4.5 2.5" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18" cy="18" r="1.5" fill="#D97706" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-semantic-orange">견적 산정 중</p>
          <p className="text-xs text-text-sub mt-0.5">담당자가 품목을 확인하고 있습니다</p>
        </div>
      </div>

      {/* 신청 요약 */}
      <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5 space-y-4">
        <h2 className="font-semibold text-lg">신청 정보</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub">신청번호</span>
            <span className="font-mono text-xs">{booking.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub">날짜</span>
            <span className="font-medium">{booking.date} {booking.timeSlot}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub">지역</span>
            <span className="font-medium">{booking.area}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub">고객명</span>
            <span className="font-medium">{booking.customerName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub">연락처</span>
            <span className="font-medium">{booking.phone}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub shrink-0">주소</span>
            <span className="font-medium text-right max-w-[60%] break-words [overflow-wrap:anywhere]">
              {booking.address} {booking.addressDetail}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub">엘리베이터</span>
            <span className="font-medium">{booking.hasElevator ? "사용 가능" : "사용 불가"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub">주차</span>
            <span className="font-medium">{booking.hasParking ? "가능" : "불가능"}</span>
          </div>
          {booking.photos && booking.photos.length > 0 && (
            <div className="flex justify-between py-2 border-b border-border-light">
              <span className="text-text-sub">첨부 사진</span>
              <span className="font-medium">{booking.photos.length}장</span>
            </div>
          )}
        </div>
      </div>

      {/* 품목 내역 */}
      <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5">
        <h2 className="font-semibold mb-3">품목 내역</h2>
        <div className="space-y-2 text-sm">
          {booking.items.map((item, i) => (
            <div key={i} className="flex justify-between py-1.5">
              <span className="text-text-sub truncate max-w-[60%]">
                {item.category} - {item.name} x{item.quantity}
              </span>
              <span>{item.price === 0 ? "가격 미정" : `${formatPrice(item.price * item.quantity)}원`}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 견적 금액 */}
      <div className="bg-primary-bg rounded-lg p-5">
        <div className="flex justify-between items-center">
          <span className="font-semibold">예상 견적</span>
          <span className="text-xl font-bold text-primary">
            {formatManWon(booking.estimateMin)} ~ {formatManWon(booking.estimateMax)}원
          </span>
        </div>
        <p className="text-xs text-text-muted mt-2">
          인력 {booking.crewSize}명 배정
          {booking.needLadder ? " / 사다리차 포함" : ""}
        </p>
        <p className="text-xs text-text-muted mt-1">
          정확한 금액은 담당자 확인 후 안내드립니다
        </p>
      </div>

      {/* 푸시 알림 */}
      {!pushSubscribed && !pushDenied && supportsNotification && (
        <div className="bg-primary-bg rounded-lg border border-primary/20 p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1AA3FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">진행 상황 알림 받기</p>
            <p className="text-xs text-text-sub">견적 확정, 수거 출발, 수거 완료 시 브라우저 푸시 알림을 보내드려요</p>
          </div>
          <button
            onClick={async () => {
              if (booking) {
                const ok = await subscribeToPush(booking.id);
                if (ok) {
                  setPushSubscribed(true);
                } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
                  setPushDenied(true);
                }
              }
            }}
            className="shrink-0 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-md"
          >
            허용
          </button>
        </div>
      )}
      {pushDenied && (
        <div className="bg-semantic-orange-tint rounded-lg p-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <p className="text-sm text-semantic-orange font-medium">브라우저 설정에서 알림을 허용해주세요</p>
        </div>
      )}
      {pushSubscribed && (
        <div className="bg-semantic-green-tint rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p className="text-sm text-semantic-green font-medium">알림이 설정되었습니다</p>
          </div>
          <p className="text-xs text-text-sub pl-6">
            견적 확정, 수거 출발, 수거 완료 시 이 브라우저로 푸시 알림이 전송됩니다.
            문자 알림도 함께 발송되니 안심하세요.
          </p>
        </div>
      )}

      {/* 안내 */}
      <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5">
        <h2 className="font-semibold mb-3">안내 사항</h2>
        <ul className="space-y-2 text-sm text-text-sub">
          <li className="flex gap-2">
            <span className="text-primary shrink-0">1.</span>
            담당자가 신청 내용과 사진을 확인하고 최종 견적을 안내드립니다.
          </li>
          <li className="flex gap-2">
            <span className="text-primary shrink-0">2.</span>
            현장 상황에 따라 견적이 조정될 수 있습니다.
          </li>
          <li className="flex gap-2">
            <span className="text-primary shrink-0">3.</span>
            신청 변경/취소는 신청 관리 페이지에서 가능합니다.
          </li>
          <li className="flex gap-2">
            <span className="text-semantic-orange shrink-0">⚠</span>
            <span className="text-text-primary font-medium">수거 전 귀중품(현금, 귀금속, 중요 서류 등)은 반드시 따로 보관해 주세요.</span>
          </li>
        </ul>
      </div>

      {/* 카카오톡 문의 */}
      <a
        href={KAKAO_CHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-md bg-[#FEE500] text-[#191919] font-semibold text-[15px] hover:brightness-95 active:scale-[0.98] transition-all"
      >
        <KakaoIcon size={20} />
        카카오톡으로 문의하기
      </a>

      {/* 하단 버튼 */}
      <div className="flex gap-3">
        <Button variant="tertiary" size="lg" fullWidth href="/booking/manage">
          신청 조회/관리
        </Button>
        <Button variant="primary" size="lg" fullWidth href="/">
          홈으로
        </Button>
      </div>
    </div>
  );
}
