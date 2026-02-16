"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import type { Booking } from "@/types/booking";

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
  pending: "bg-semantic-orange-tint text-semantic-orange",
  quote_confirmed: "bg-primary-tint text-primary",
  in_progress: "bg-primary-tint text-primary-dark",
  completed: "bg-semantic-green-tint text-semantic-green",
  payment_requested: "bg-semantic-orange-tint text-semantic-orange",
  payment_completed: "bg-semantic-green-tint text-semantic-green",
  cancelled: "bg-semantic-red-tint text-semantic-red",
  rejected: "bg-fill-tint text-text-muted",
};

// 다음 상태 전이 맵
const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  pending: [
    { status: "quote_confirmed", label: "견적 확정" },
    { status: "rejected", label: "수거 불가" },
    { status: "cancelled", label: "취소" },
  ],
  quote_confirmed: [
    { status: "in_progress", label: "수거 시작" },
    { status: "cancelled", label: "취소" },
  ],
  in_progress: [{ status: "completed", label: "수거 완료" }],
  completed: [{ status: "payment_requested", label: "정산 요청" }],
  payment_requested: [{ status: "payment_completed", label: "정산 완료" }],
};

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function AdminBookingDetailPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const id = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [adminMemoInput, setAdminMemoInput] = useState("");
  const [confirmedTimeInput, setConfirmedTimeInput] = useState("");
  const [saving, setSaving] = useState(false);

  // sessionStorage에서 token 가져오기
  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) {
      sessionStorage.setItem("admin_return_url", window.location.pathname);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token || !id) return;
    fetch(`/api/admin/bookings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem("admin_token");
          sessionStorage.setItem("admin_return_url", window.location.pathname);
          router.push("/admin");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.booking) {
          setBooking(data.booking);
          if (data.booking.finalPrice != null) {
            setFinalPriceInput(String(data.booking.finalPrice));
          }
          if (data.booking.adminMemo) {
            setAdminMemoInput(data.booking.adminMemo);
          }
          if (data.booking.confirmedTime) {
            setConfirmedTimeInput(data.booking.confirmedTime);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [token, id, router]);

  async function handleStatusChange(newStatus: string) {
    if (!booking || !token) return;
    const needsPrice =
      newStatus === "quote_confirmed" && !finalPriceInput.trim();
    if (needsPrice) {
      alert("최종 견적을 입력해주세요");
      return;
    }
    const needsTime =
      newStatus === "quote_confirmed" && !confirmedTimeInput;
    if (needsTime) {
      alert("수거 시간을 확정해주세요");
      return;
    }

    const confirmMsg =
      `상태를 "${STATUS_LABELS[newStatus]}"(으)로 변경하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        status: newStatus,
      };
      if (finalPriceInput.trim()) {
        body.finalPrice = Number(finalPriceInput.replace(/[^0-9]/g, ""));
      }
      if (adminMemoInput.trim()) {
        body.adminMemo = adminMemoInput;
      }
      if (confirmedTimeInput) {
        body.confirmedTime = confirmedTimeInput;
      }

      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking(data.booking);
        alert("상태가 변경되었습니다");
      } else {
        alert(data.error || "변경 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMemo() {
    if (!booking || !token) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        adminMemo: adminMemoInput,
      };
      if (finalPriceInput.trim()) {
        body.finalPrice = Number(finalPriceInput.replace(/[^0-9]/g, ""));
      }
      if (confirmedTimeInput) {
        body.confirmedTime = confirmedTimeInput;
      }
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking(data.booking);
        alert("저장되었습니다");
      }
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-warm flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-bg-warm flex items-center justify-center">
        <p className="text-text-muted">예약을 찾을 수 없습니다</p>
      </div>
    );
  }

  const nextActions = NEXT_STATUS[booking.status] || [];

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/admin/dashboard`)}
            className="text-text-sub hover:text-text-primary transition-colors duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-lg font-bold">신청 상세</h1>
        </div>
      </div>

      <div className="max-w-[42rem] mx-auto px-4 py-4 space-y-4">
        {/* 상태 + ID */}
        <div className="bg-bg rounded-2xl p-5 border border-border-light flex items-center justify-between">
          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[booking.status] || STATUS_COLORS.pending}`}
          >
            {STATUS_LABELS[booking.status] || booking.status}
          </span>
          <span className="text-xs text-text-muted font-mono">
            #{booking.id.slice(0, 12)}
          </span>
        </div>

        {/* 고객 정보 */}
        <div className="bg-bg rounded-2xl p-5 border border-border-light">
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
              <span className="text-text-sub">주소</span>
              <span className="font-medium text-right max-w-[60%]">
                {booking.address} {booking.addressDetail}
              </span>
            </div>
          </div>
        </div>

        {/* 수거 정보 */}
        <div className="bg-bg rounded-2xl p-5 border border-border-light">
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
            <div className={`flex justify-between py-2.5 ${booking.needLadder || booking.memo ? "border-b border-border-light" : ""}`}>
              <span className="text-text-sub">주차</span>
              <span className="font-medium">
                {booking.hasParking === true
                  ? "가능"
                  : booking.hasParking === false
                    ? "불가능"
                    : "-"}
              </span>
            </div>
            {booking.needLadder && (
              <div className={`flex justify-between py-2.5 ${booking.memo ? "border-b border-border-light" : ""}`}>
                <span className="text-text-sub">사다리차</span>
                <span className="font-medium">
                  {booking.ladderType} | {formatPrice(booking.ladderPrice)}원
                </span>
              </div>
            )}
            {booking.memo && (
              <div className="flex justify-between py-2.5">
                <span className="text-text-sub">요청사항</span>
                <span className="font-medium text-right max-w-[60%]">
                  {booking.memo}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 품목 */}
        <div className="bg-bg rounded-2xl p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-3">
            품목 ({booking.items.length}종)
          </h3>
          <div className="space-y-1.5">
            {booking.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-text-sub truncate max-w-[65%]">
                  {item.category} - {item.name} x{item.quantity}
                </span>
                <span className="font-medium">
                  {formatPrice(item.price * item.quantity)}원
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 사진 */}
        {booking.photos && booking.photos.length > 0 && (
          <div className="bg-bg rounded-2xl p-5 border border-border-light">
            <h3 className="text-sm font-semibold text-text-sub mb-3">
              사진 ({booking.photos.length}장)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {booking.photos.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square bg-bg-warm rounded-xl overflow-hidden"
                >
                  <img
                    src={url}
                    alt={`사진 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 견적 */}
        <div className="bg-bg rounded-2xl p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-3">견적</h3>
          <div className="space-y-0 text-sm">
            {booking.estimateMin != null && booking.estimateMax != null && (
              <div className="flex justify-between py-2.5 border-b border-border-light">
                <span className="text-text-sub">예상 견적</span>
                <span className="font-medium">
                  {formatPrice(booking.estimateMin)} ~{" "}
                  {formatPrice(booking.estimateMax)}원
                </span>
              </div>
            )}
            <div className={`flex justify-between py-2.5 ${booking.finalPrice != null ? "border-b border-border-light" : ""}`}>
              <span className="text-text-sub">자동 산정</span>
              <span className="font-medium">
                {formatPrice(booking.totalPrice)}원 ({booking.crewSize}명)
              </span>
            </div>
            {booking.finalPrice != null && (
              <div className="flex justify-between py-2.5 text-primary font-bold">
                <span>최종 견적</span>
                <span>{formatPrice(booking.finalPrice)}원</span>
              </div>
            )}
          </div>

          {/* 최종 견적 입력 */}
          <div className="mt-4 pt-3 border-t border-border-light">
            <TextField
              label="최종 견적 (원)"
              value={finalPriceInput}
              onChange={(e) =>
                setFinalPriceInput(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="금액 입력"
            />
            {finalPriceInput && (
              <p className="text-xs text-text-muted mt-1">
                {formatPrice(Number(finalPriceInput))}원
              </p>
            )}
          </div>
        </div>

        {/* 수거 시간 확정 */}
        <div className="bg-bg rounded-2xl p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-3">
            수거 시간 확정
          </h3>
          {booking.confirmedTime && (
            <p className="text-sm text-primary font-semibold mb-3">
              확정: {booking.confirmedTime}
            </p>
          )}
          <div className="grid grid-cols-4 max-sm:grid-cols-3 gap-2">
            {Array.from({ length: 19 }, (_, i) => {
              const hour = Math.floor(i / 2) + 9;
              const min = i % 2 === 0 ? "00" : "30";
              const slot = `${String(hour).padStart(2, "0")}:${min}`;
              return (
                <button
                  key={slot}
                  onClick={() => setConfirmedTimeInput(slot)}
                  className={`py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                    confirmedTimeInput === slot
                      ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                      : "bg-bg-warm hover:bg-primary-bg"
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>

        {/* 관리자 메모 */}
        <div className="bg-bg rounded-2xl p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-3">
            관리자 메모
          </h3>
          <TextArea
            value={adminMemoInput}
            onChange={(e) => setAdminMemoInput(e.target.value)}
            placeholder="내부 메모 (고객에게 노출되지 않음)"
            rows={3}
          />
          <div className="mt-3">
            <Button
              variant="secondary"
              size="md"
              onClick={handleSaveMemo}
              disabled={saving}
              loading={saving}
            >
              메모 저장
            </Button>
          </div>
        </div>

        {/* 상태 변경 버튼 */}
        {nextActions.length > 0 && (
          <div className="space-y-2">
            {nextActions.map((action) => {
              const isPrimary =
                action.status !== "cancelled" &&
                action.status !== "rejected";
              return (
                <Button
                  key={action.status}
                  variant={isPrimary ? "primary" : "tertiary"}
                  size="lg"
                  fullWidth
                  onClick={() => handleStatusChange(action.status)}
                  disabled={saving}
                  className={!isPrimary ? "border border-semantic-red/30 text-semantic-red bg-semantic-red-tint hover:bg-semantic-red/10" : ""}
                >
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
