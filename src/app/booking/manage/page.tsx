"use client";

import { useState } from "react";
import Link from "next/link";
import type { Booking } from "@/types/booking";

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

const STATUS_LABELS: Record<string, string> = {
  pending: "접수 대기",
  confirmed: "확정",
  completed: "완료",
  cancelled: "취소",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-[#F97316]/10 text-[#F97316]",
  confirmed: "bg-[#3B82F6]/10 text-[#3B82F6]",
  completed: "bg-[#22C55E]/10 text-[#22C55E]",
  cancelled: "bg-[#EF4444]/10 text-[#EF4444]",
};

export default function BookingManagePage() {
  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/bookings?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("정말 예약을 취소하시겠습니까?")) return;
    setCancelling(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, status: "cancelled" as const } : b,
          ),
        );
      } else {
        alert("취소 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">예약 조회/관리</h1>
        <p className="text-text-sub text-sm">
          예약 시 입력한 전화번호로 조회하세요
        </p>
      </div>

      {/* 전화번호 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="tel"
          placeholder="전화번호 (예: 01012345678)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1 px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading || !phone.trim()}
          className="px-6 py-3 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-40"
        >
          {loading ? "..." : "조회"}
        </button>
      </form>

      {/* 결과 */}
      {searched && !loading && bookings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-muted mb-4">예약 내역이 없습니다</p>
          <Link href="/booking" className="text-primary font-semibold text-sm">
            새 예약하기
          </Link>
        </div>
      )}

      {bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((b) => {
            const isExpanded = expandedId === b.id;
            return (
              <div
                key={b.id}
                className="bg-white rounded-2xl shadow-sm overflow-hidden"
              >
                {/* 예약 카드 헤더 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}
                      >
                        {STATUS_LABELS[b.status] || b.status}
                      </span>
                      <span className="text-xs text-text-muted font-mono">
                        #{b.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="font-medium text-sm">
                      {b.date} {b.timeSlot} | {b.area}
                    </p>
                    <p className="text-sm text-primary font-semibold">
                      {formatPrice(b.totalPrice)}원
                    </p>
                  </div>
                  <span className="text-text-muted text-sm shrink-0 ml-3">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </button>

                {/* 상세 정보 */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-border-light">
                    <div className="space-y-3 pt-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-sub">주소</span>
                        <span className="font-medium text-right max-w-[60%]">
                          {b.address} {b.addressDetail}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-sub">인력</span>
                        <span>{b.crewSize}명</span>
                      </div>
                      {b.needLadder && (
                        <div className="flex justify-between">
                          <span className="text-text-sub">사다리차</span>
                          <span>
                            {b.ladderType} ({formatPrice(b.ladderPrice)}원)
                          </span>
                        </div>
                      )}
                      {b.memo && (
                        <div className="flex justify-between">
                          <span className="text-text-sub">메모</span>
                          <span className="text-right max-w-[60%]">
                            {b.memo}
                          </span>
                        </div>
                      )}

                      {/* 품목 목록 */}
                      <div className="pt-2 border-t border-border-light">
                        <p className="text-text-sub mb-2">품목</p>
                        {b.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between py-1">
                            <span className="truncate max-w-[60%]">
                              {item.category} - {item.name} x{item.quantity}
                            </span>
                            <span>{formatPrice(item.price * item.quantity)}원</span>
                          </div>
                        ))}
                      </div>

                      {/* 취소 버튼 */}
                      {b.status !== "cancelled" && b.status !== "completed" && (
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={cancelling === b.id}
                          className="w-full mt-3 py-2.5 rounded-xl border border-[#EF4444] text-[#EF4444] text-sm font-semibold hover:bg-[#EF4444]/5 disabled:opacity-40"
                        >
                          {cancelling === b.id
                            ? "취소 처리 중..."
                            : "예약 취소"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 새 예약 링크 */}
      <div className="pt-4">
        <Link
          href="/booking"
          className="block w-full py-3.5 rounded-2xl bg-primary text-white text-center font-semibold text-sm"
        >
          새 예약하기
        </Link>
      </div>
    </div>
  );
}
