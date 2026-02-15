"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
  pending: "bg-orange-100 text-orange-600",
  quote_confirmed: "bg-blue-100 text-blue-600",
  in_progress: "bg-purple-100 text-purple-600",
  completed: "bg-green-100 text-green-600",
  payment_requested: "bg-yellow-100 text-yellow-700",
  payment_completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
  rejected: "bg-gray-100 text-gray-600",
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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminBookingDetailContent />
    </Suspense>
  );
}

function AdminBookingDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const id = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [adminMemoInput, setAdminMemoInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    fetch(`/api/admin/bookings/${id}?token=${token}`)
      .then((r) => {
        if (r.status === 401) {
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

    const confirmMsg =
      `상태를 "${STATUS_LABELS[newStatus]}"(으)로 변경하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        status: newStatus,
        token,
      };
      if (finalPriceInput.trim()) {
        body.finalPrice = Number(finalPriceInput.replace(/[^0-9]/g, ""));
      }
      if (adminMemoInput.trim()) {
        body.adminMemo = adminMemoInput;
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
        token,
      };
      if (finalPriceInput.trim()) {
        body.finalPrice = Number(finalPriceInput.replace(/[^0-9]/g, ""));
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
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <p className="text-gray-500">예약을 찾을 수 없습니다</p>
      </div>
    );
  }

  const nextActions = NEXT_STATUS[booking.status] || [];

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/admin/dashboard`)}
            className="text-gray-500 hover:text-gray-800"
          >
            ← 목록
          </button>
          <h1 className="text-lg font-bold">신청 상세</h1>
        </div>
      </div>

      <div className="max-w-[42rem] mx-auto px-4 py-4 space-y-4">
        {/* 상태 + ID */}
        <div className="bg-white rounded-xl p-4 flex items-center justify-between">
          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[booking.status] || STATUS_COLORS.pending}`}
          >
            {STATUS_LABELS[booking.status] || booking.status}
          </span>
          <span className="text-xs text-gray-400 font-mono">
            #{booking.id.slice(0, 12)}
          </span>
        </div>

        {/* 고객 정보 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            고객 정보
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">이름</span>
              <span className="font-medium">{booking.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">전화번호</span>
              <a
                href={`tel:${booking.phone}`}
                className="font-medium text-[#2563EB]"
              >
                {booking.phone}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">주소</span>
              <span className="font-medium text-right max-w-[60%]">
                {booking.address} {booking.addressDetail}
              </span>
            </div>
          </div>
        </div>

        {/* 수거 정보 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            수거 정보
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">희망일</span>
              <span className="font-medium">
                {booking.date} {booking.timeSlot}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">지역</span>
              <span className="font-medium">{booking.area}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">엘리베이터</span>
              <span className="font-medium">
                {booking.hasElevator === true
                  ? "사용 가능"
                  : booking.hasElevator === false
                    ? "사용 불가"
                    : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">주차</span>
              <span className="font-medium">
                {booking.hasParking === true
                  ? "가능"
                  : booking.hasParking === false
                    ? "불가능"
                    : "-"}
              </span>
            </div>
            {booking.needLadder && (
              <div className="flex justify-between">
                <span className="text-gray-500">사다리차</span>
                <span className="font-medium">
                  {booking.ladderType} | {formatPrice(booking.ladderPrice)}원
                </span>
              </div>
            )}
            {booking.memo && (
              <div className="flex justify-between">
                <span className="text-gray-500">요청사항</span>
                <span className="font-medium text-right max-w-[60%]">
                  {booking.memo}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 품목 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            품목 ({booking.items.length}종)
          </h3>
          <div className="space-y-1.5">
            {booking.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-700 truncate max-w-[65%]">
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
          <div className="bg-white rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">
              사진 ({booking.photos.length}장)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {booking.photos.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square bg-gray-100 rounded-lg overflow-hidden"
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
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">견적</h3>
          <div className="space-y-2 text-sm">
            {booking.estimateMin != null && booking.estimateMax != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">예상 견적</span>
                <span className="font-medium">
                  {formatPrice(booking.estimateMin)} ~{" "}
                  {formatPrice(booking.estimateMax)}원
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">자동 산정</span>
              <span className="font-medium">
                {formatPrice(booking.totalPrice)}원 ({booking.crewSize}명)
              </span>
            </div>
            {booking.finalPrice != null && (
              <div className="flex justify-between text-[#2563EB] font-bold">
                <span>최종 견적</span>
                <span>{formatPrice(booking.finalPrice)}원</span>
              </div>
            )}
          </div>

          {/* 최종 견적 입력 */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <label className="text-sm text-gray-500 block mb-1.5">
              최종 견적 입력 (원)
            </label>
            <input
              type="text"
              value={finalPriceInput}
              onChange={(e) =>
                setFinalPriceInput(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="금액 입력"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-[#2563EB]"
            />
            {finalPriceInput && (
              <p className="text-xs text-gray-400 mt-1">
                {formatPrice(Number(finalPriceInput))}원
              </p>
            )}
          </div>
        </div>

        {/* 관리자 메모 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            관리자 메모
          </h3>
          <textarea
            value={adminMemoInput}
            onChange={(e) => setAdminMemoInput(e.target.value)}
            placeholder="내부 메모 (고객에게 노출되지 않음)"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-[#2563EB] resize-none"
          />
          <button
            onClick={handleSaveMemo}
            disabled={saving}
            className="mt-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-40"
          >
            {saving ? "저장 중..." : "메모 저장"}
          </button>
        </div>

        {/* 상태 변경 버튼 */}
        {nextActions.length > 0 && (
          <div className="space-y-2">
            {nextActions.map((action) => {
              const isPrimary =
                action.status !== "cancelled" &&
                action.status !== "rejected";
              return (
                <button
                  key={action.status}
                  onClick={() => handleStatusChange(action.status)}
                  disabled={saving}
                  className={`w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 ${
                    isPrimary
                      ? "bg-[#2563EB] text-white"
                      : "border border-red-300 text-red-500 hover:bg-red-50"
                  }`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
