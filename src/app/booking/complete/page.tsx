"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Booking } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

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
      {/* 완료 헤더 */}
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#EDFCF6" />
            <circle cx="24" cy="24" r="17" fill="#D1FAE5" />
            <path d="M15 24l6 6L33 18" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">수거 신청이 접수되었습니다</h1>
        <p className="text-text-sub text-sm">
          담당자가 확인 후 최종 견적을 안내드립니다 (영업일 기준 24시간 이내)
        </p>
      </div>

      {/* 상태 표시 */}
      <div className="bg-semantic-orange-tint rounded-2xl p-4 flex items-center gap-3">
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
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
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
            <span className="text-text-sub">주소</span>
            <span className="font-medium text-right max-w-[60%]">
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
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">품목 내역</h2>
        <div className="space-y-2 text-sm">
          {booking.items.map((item, i) => (
            <div key={i} className="flex justify-between py-1.5">
              <span className="text-text-sub truncate max-w-[60%]">
                {item.category} - {item.name} x{item.quantity}
              </span>
              <span>{formatPrice(item.price * item.quantity)}원</span>
            </div>
          ))}
        </div>
      </div>

      {/* 견적 금액 */}
      <div className="bg-primary-bg rounded-2xl p-5">
        <div className="flex justify-between items-center">
          <span className="font-semibold">예상 견적</span>
          <span className="text-xl font-bold text-primary">
            {formatPrice(booking.estimateMin)} ~ {formatPrice(booking.estimateMax)}원
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

      {/* 안내 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
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
        </ul>
      </div>

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
