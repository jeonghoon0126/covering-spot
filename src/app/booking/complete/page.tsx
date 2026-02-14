"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Booking } from "@/types/booking";

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function BookingCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
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
        else setError("예약 정보를 찾을 수 없습니다");
      })
      .catch(() => setError("조회 실패"));
  }, [id]);

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted mb-4">{error}</p>
        <Link href="/booking" className="text-primary font-semibold">
          다시 예약하기
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-text-muted mt-4 text-sm">예약 정보 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 완료 헤더 */}
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">예약이 접수되었습니다</h1>
        <p className="text-text-sub text-sm">
          담당자 확인 후 연락드리겠습니다
        </p>
      </div>

      {/* 예약 요약 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-lg">예약 정보</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border-light">
            <span className="text-text-sub">예약번호</span>
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
          <span className="font-semibold">총 견적 금액</span>
          <span className="text-xl font-bold text-primary">
            {formatPrice(booking.totalPrice)}원
          </span>
        </div>
        <p className="text-xs text-text-muted mt-2">
          인력 {booking.crewSize}명 배정
          {booking.needLadder ? ` / 사다리차 포함` : ""}
        </p>
      </div>

      {/* 안내 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">안내 사항</h2>
        <ul className="space-y-2 text-sm text-text-sub">
          <li className="flex gap-2">
            <span className="text-primary shrink-0">1.</span>
            담당자가 예약 내용을 확인하고 확정 연락을 드립니다.
          </li>
          <li className="flex gap-2">
            <span className="text-primary shrink-0">2.</span>
            현장 상황에 따라 견적이 조정될 수 있습니다.
          </li>
          <li className="flex gap-2">
            <span className="text-primary shrink-0">3.</span>
            예약 변경/취소는 예약 관리 페이지에서 가능합니다.
          </li>
        </ul>
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-3">
        <Link
          href="/booking/manage"
          className="flex-1 py-3.5 rounded-2xl border border-border text-center text-text-sub font-semibold text-sm"
        >
          예약 조회/관리
        </Link>
        <Link
          href="/"
          className="flex-1 py-3.5 rounded-2xl bg-primary text-white text-center font-semibold text-sm"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
