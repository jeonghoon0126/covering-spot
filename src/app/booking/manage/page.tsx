"use client";

import { useState } from "react";
import Link from "next/link";
import type { Booking } from "@/types/booking";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/[^\d]/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "견적 산정 중",
  quote_confirmed: "견적 확정",
  in_progress: "수거 진행중",
  completed: "수거 완료",
  payment_requested: "정산 요청",
  payment_completed: "정산 완료",
  cancelled: "취소",
  rejected: "수거 불가",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-[#F97316]/10 text-[#F97316]",
  quote_confirmed: "bg-[#3B82F6]/10 text-[#3B82F6]",
  in_progress: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
  completed: "bg-[#22C55E]/10 text-[#22C55E]",
  payment_requested: "bg-[#EAB308]/10 text-[#EAB308]",
  payment_completed: "bg-[#059669]/10 text-[#059669]",
  cancelled: "bg-[#EF4444]/10 text-[#EF4444]",
  rejected: "bg-[#6B7280]/10 text-[#6B7280]",
};

const STATUS_MESSAGES: Record<string, string> = {
  pending: "담당자가 견적을 확인 중입니다",
  quote_confirmed: "최종 견적이 확정되었습니다",
  in_progress: "수거 팀이 방문 중입니다",
  completed: "수거가 완료되었습니다",
  payment_requested: "정산 요청이 발송되었습니다",
  payment_completed: "정산이 완료되었습니다",
  cancelled: "신청이 취소되었습니다",
  rejected: "수거가 불가한 건입니다",
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
    if (!confirm("정말 신청을 취소하시겠습니까?")) return;
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
        <h1 className="text-2xl font-bold mb-2">신청 조회/관리</h1>
        <p className="text-text-sub text-sm">
          신청 시 입력한 전화번호로 조회하세요
        </p>
      </div>

      {/* 전화번호 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2 items-end">
        <div className="flex-1">
          <TextField
            type="tel"
            placeholder="전화번호 (예: 010-1234-5678)"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={loading || !phone.trim()}
          loading={loading}
        >
          조회
        </Button>
      </form>

      {/* 결과 */}
      {searched && !loading && bookings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-muted mb-4">신청 내역이 없습니다</p>
          <Link href="/booking" className="text-primary font-semibold text-sm">
            새 수거 신청하기
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
                {/* 카드 헤더 */}
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
                      {b.estimateMin > 0 && b.estimateMax > 0
                        ? `${formatPrice(b.estimateMin)} ~ ${formatPrice(b.estimateMax)}원`
                        : `${formatPrice(b.totalPrice)}원`}
                    </p>
                  </div>
                  <span className="text-text-muted text-sm shrink-0 ml-3">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </button>

                {/* 상세 정보 */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-border-light">
                    {/* 상태별 안내 메시지 */}
                    <div className={`mt-4 mb-4 p-3 rounded-xl text-sm ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}>
                      <p className="font-medium">
                        {b.status === "quote_confirmed" && b.finalPrice
                          ? `${STATUS_MESSAGES[b.status]} 견적: ${formatPrice(b.finalPrice)}원`
                          : STATUS_MESSAGES[b.status] || "처리 중입니다"}
                      </p>
                    </div>

                    <div className="space-y-3 text-sm">
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

                      {/* 작업 환경 */}
                      <div className="flex justify-between">
                        <span className="text-text-sub">엘리베이터</span>
                        <span>{b.hasElevator ? "사용 가능" : "사용 불가"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-sub">주차</span>
                        <span>{b.hasParking ? "가능" : "불가능"}</span>
                      </div>

                      {/* 예상 견적 */}
                      {b.estimateMin > 0 && b.estimateMax > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-sub">예상 견적</span>
                          <span className="font-medium">
                            {formatPrice(b.estimateMin)} ~ {formatPrice(b.estimateMax)}원
                          </span>
                        </div>
                      )}

                      {/* 최종 견적 (확정된 경우만) */}
                      {b.finalPrice !== null && b.finalPrice !== undefined && b.finalPrice > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-sub font-semibold">최종 견적</span>
                          <span className="font-bold text-primary">
                            {formatPrice(b.finalPrice)}원
                          </span>
                        </div>
                      )}

                      {b.needLadder && (
                        <div className="flex justify-between">
                          <span className="text-text-sub">사다리차</span>
                          <span>
                            {b.ladderType} ({formatPrice(b.ladderPrice)}원)
                          </span>
                        </div>
                      )}

                      {/* 사진 수 */}
                      {b.photos && b.photos.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-sub">첨부 사진</span>
                          <span>{b.photos.length}장</span>
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
                      {b.status !== "cancelled" &&
                        b.status !== "completed" &&
                        b.status !== "rejected" &&
                        b.status !== "payment_requested" &&
                        b.status !== "payment_completed" && (
                        <Button
                          variant="danger"
                          size="md"
                          fullWidth
                          className="mt-3"
                          onClick={() => handleCancel(b.id)}
                          disabled={cancelling === b.id}
                          loading={cancelling === b.id}
                        >
                          {cancelling === b.id ? "" : "신청 취소"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 새 신청 링크 */}
      <div className="pt-4">
        <Button variant="primary" size="lg" fullWidth href="/booking">
          새 수거 신청하기
        </Button>
      </div>
    </div>
  );
}
