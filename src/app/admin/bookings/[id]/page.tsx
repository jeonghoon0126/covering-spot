"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import type { Booking } from "@/types/booking";
import { formatPrice, formatManWon } from "@/lib/format";

interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  status_change: "상태 변경",
  info_update: "정보 수정",
  items_update: "품목 수정",
};

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

export default function AdminBookingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [token, setToken] = useState("");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [adminMemoInput, setAdminMemoInput] = useState("");
  const [confirmedTimeInput, setConfirmedTimeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [slotAvailability, setSlotAvailability] = useState<Record<string, { available: boolean; count: number }>>({});
  const [editingItems, setEditingItems] = useState(false);
  const [itemEdits, setItemEdits] = useState<{ price: string; category: string }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [confirmedDurationInput, setConfirmedDurationInput] = useState<number | null>(null);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [crewSizeInput, setCrewSizeInput] = useState<number | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

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

  // 슬롯 가용성 조회
  useEffect(() => {
    if (!booking) return;
    fetch(`/api/slots?date=${booking.date}&excludeId=${booking.id}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, { available: boolean; count: number }> = {};
        for (const s of data.slots || []) {
          map[s.time] = { available: s.available, count: s.count };
        }
        setSlotAvailability(map);
      })
      .catch(() => {});
  }, [booking]);

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
          if (data.booking.confirmedDuration != null) {
            setConfirmedDurationInput(data.booking.confirmedDuration);
          }
          if (data.booking.completionPhotos?.length) {
            setCompletionPhotos(data.booking.completionPhotos);
          }
          setCrewSizeInput(data.booking.crewSize ?? 1);
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

    // 슬롯 충돌 경고: 견적 확정 시 시간대 가용 여부 재확인
    if (newStatus === "quote_confirmed" && confirmedTimeInput) {
      try {
        const slotRes = await fetch(`/api/slots?date=${booking.date}&excludeId=${booking.id}`);
        const slotData = await slotRes.json();
        const slotInfo = (slotData.slots || []).find(
          (s: { time: string; available: boolean }) => s.time === confirmedTimeInput
        );
        if (slotInfo && !slotInfo.available) {
          const proceed = confirm(
            "선택한 시간대가 이미 마감되었습니다. 그래도 확정하시겠습니까?"
          );
          if (!proceed) return;
        }
      } catch {
        // 슬롯 조회 실패 시 그냥 진행
      }
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
      if (confirmedDurationInput != null) {
        body.confirmedDuration = confirmedDurationInput;
      }
      if (newStatus === "completed" && completionPhotos.length > 0) {
        body.completionPhotos = completionPhotos;
      }
      body.expectedUpdatedAt = booking.updatedAt;

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
      } else if (res.status === 409) {
        alert("다른 탭에서 이미 수정되었습니다. 최신 데이터를 불러옵니다.");
        await refetchBooking();
      } else {
        alert(data.error || "변경 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  async function refetchBooking() {
    if (!token || !id) return;
    try {
      const r = await fetch(`/api/admin/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data?.booking) {
        setBooking(data.booking);
        if (data.booking.finalPrice != null) setFinalPriceInput(String(data.booking.finalPrice));
        setAdminMemoInput(data.booking.adminMemo || "");
        if (data.booking.confirmedTime) setConfirmedTimeInput(data.booking.confirmedTime);
        if (data.booking.confirmedDuration != null) setConfirmedDurationInput(data.booking.confirmedDuration);
        if (data.booking.completionPhotos?.length) setCompletionPhotos(data.booking.completionPhotos);
        setCrewSizeInput(data.booking.crewSize ?? 1);
      }
    } catch { /* ignore */ }
  }

  async function handleSaveCrewSize() {
    if (!booking || !token || crewSizeInput == null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ crewSize: crewSizeInput, expectedUpdatedAt: booking.updatedAt }),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking(data.booking);
      } else if (res.status === 409) {
        alert("다른 탭에서 이미 수정되었습니다.");
        await refetchBooking();
      } else {
        alert(data.error || "저장 실패");
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
      // adminMemo만 저장 — finalPrice/confirmedTime은 견적 확정 플로우에서만 변경
      const body: Record<string, unknown> = {
        adminMemo: adminMemoInput,
        expectedUpdatedAt: booking.updatedAt,
      };
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
      } else if (res.status === 409) {
        alert("다른 탭에서 이미 수정되었습니다. 최신 데이터를 불러옵니다.");
        await refetchBooking();
      } else {
        alert(data.error || "저장 실패");
      }
    } catch {
      alert("네트워크 오류");
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

  function loadAuditLogs() {
    if (!token || !id) return;
    fetch(`/api/admin/bookings/${id}/audit`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.logs) setAuditLogs(data.logs);
      })
      .catch(() => {});
  }

  const nextActions = NEXT_STATUS[booking.status] || [];
  // 수거 시작(in_progress) 이후 상태에서는 견적/시간/품목 수정 불가
  const isLocked = !["pending", "quote_confirmed"].includes(booking.status);

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
        <div className="bg-bg rounded-lg p-5 border border-border-light flex items-center justify-between">
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

        {/* 수거 정보 */}
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
              <div className="flex justify-between py-2.5 border-b border-border-light">
                <span className="text-text-sub shrink-0">요청사항</span>
                <span className="font-medium text-right max-w-[60%] break-words [overflow-wrap:anywhere]">
                  {booking.memo}
                </span>
              </div>
            )}
            {(booking.totalLoadingCube ?? 0) > 0 && (
              <div className={`flex justify-between py-2.5 ${booking.driverName ? "border-b border-border-light" : ""}`}>
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

        {/* 품목 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-sub">
              품목 ({booking.items.length}종)
            </h3>
            {!isLocked && booking.items.some((i) => i.price === 0) && !editingItems && (
              <button
                onClick={() => {
                  setEditingItems(true);
                  setItemEdits(
                    booking.items.map((i) => ({
                      price: String(i.price),
                      category: i.category,
                    })),
                  );
                }}
                className="text-xs text-primary font-medium"
              >
                가격 편집
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {booking.items.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm">
                  <span className="text-text-sub truncate max-w-[65%]">
                    {item.category === "직접입력" ? (
                      <span className="text-semantic-orange">직접입력</span>
                    ) : (
                      item.category
                    )}
                    {" - "}{item.name} x{item.quantity}
                  </span>
                  <span className={`font-medium ${item.price === 0 ? "text-semantic-orange" : ""}`}>
                    {item.price === 0 ? "가격 미정" : `${formatPrice(item.price * item.quantity)}원`}
                  </span>
                </div>
                {editingItems && (
                  <div className="flex gap-2 mt-1.5 ml-2">
                    <input
                      type="text"
                      placeholder="가격"
                      value={itemEdits[idx]?.price || ""}
                      onChange={(e) => {
                        const next = [...itemEdits];
                        next[idx] = { ...next[idx], price: e.target.value.replace(/[^0-9]/g, "") };
                        setItemEdits(next);
                      }}
                      className="w-24 px-2 py-1 text-xs rounded-lg border border-border bg-bg-warm"
                    />
                    <select
                      value={itemEdits[idx]?.category || item.category}
                      onChange={(e) => {
                        const next = [...itemEdits];
                        next[idx] = { ...next[idx], category: e.target.value };
                        setItemEdits(next);
                      }}
                      className="px-2 py-1 text-xs rounded-lg border border-border bg-bg-warm"
                    >
                      {["장롱", "침대", "소파", "가전", "식탁/의자", "서랍장", "수납장", "기타 가구", "운동기구", "직접입력"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
          {editingItems && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border-light">
              <Button
                variant="primary"
                size="sm"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const updatedItems = booking.items.map((item, idx) => ({
                      ...item,
                      price: Number(itemEdits[idx]?.price || item.price),
                      category: itemEdits[idx]?.category || item.category,
                    }));
                    const res = await fetch(`/api/admin/bookings/${booking.id}`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ items: updatedItems, expectedUpdatedAt: booking.updatedAt }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setBooking(data.booking);
                      setEditingItems(false);
                      setItemEdits([]);
                    }
                  } catch {
                    alert("저장 실패");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                저장
              </Button>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => { setEditingItems(false); setItemEdits([]); }}
              >
                취소
              </Button>
            </div>
          )}
        </div>

        {/* 사진 */}
        {booking.photos && booking.photos.length > 0 && (
          <div className="bg-bg rounded-lg p-5 border border-border-light">
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
                  className="aspect-square bg-bg-warm rounded-md overflow-hidden"
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
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-3">견적</h3>
          <div className="space-y-0 text-sm">
            {booking.estimateMin != null && booking.estimateMax != null && (
              <div className="flex justify-between py-2.5 border-b border-border-light">
                <span className="text-text-sub">예상 견적</span>
                <span className="font-medium">
                  {formatManWon(booking.estimateMin)} ~{" "}
                  {formatManWon(booking.estimateMax)}원
                </span>
              </div>
            )}
            <div className={`flex justify-between items-center py-2.5 ${booking.finalPrice != null ? "border-b border-border-light" : ""}`}>
              <span className="text-text-sub">자동 산정</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatPrice(booking.totalPrice)}원</span>
                {isLocked ? (
                  <span className="text-sm text-text-muted">({booking.crewSize}명)</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-text-muted">(인력</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={crewSizeInput ?? booking.crewSize}
                      onChange={(e) => setCrewSizeInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-10 h-7 px-1 text-center text-sm rounded border border-border-light bg-bg-warm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
                    />
                    <span className="text-sm text-text-muted">명)</span>
                    {crewSizeInput !== booking.crewSize && (
                      <button
                        onClick={handleSaveCrewSize}
                        disabled={saving}
                        className="text-[11px] font-semibold text-primary border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/5 transition-colors disabled:opacity-50"
                      >
                        저장
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {booking.finalPrice != null && (
              <div className="flex justify-between py-2.5 text-primary font-bold">
                <span>최종 견적</span>
                <span>{formatPrice(booking.finalPrice)}원</span>
              </div>
            )}
          </div>

          {/* 최종 견적 입력 — 수거 시작 이후 잠금 */}
          {!isLocked && (
            <div className="mt-4 pt-3 border-t border-border-light">
              <TextField
                label="최종 견적 (원)"
                value={finalPriceInput}
                onChange={(e) =>
                  setFinalPriceInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder={
                  booking.estimateMin != null && booking.estimateMax != null
                    ? `${formatManWon(booking.estimateMin)} ~ ${formatManWon(booking.estimateMax)}원`
                    : "금액 입력"
                }
              />
              <div className="flex items-center gap-2 mt-1">
                {finalPriceInput && (
                  <p className="text-xs text-text-muted">
                    {formatPrice(Number(finalPriceInput))}원
                  </p>
                )}
                {!finalPriceInput && booking.estimateMin != null && booking.estimateMax != null && (
                  <button
                    type="button"
                    onClick={() =>
                      setFinalPriceInput(
                        String(Math.round((booking.estimateMin! + booking.estimateMax!) / 2))
                      )
                    }
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    예상 견적 적용
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 수거 시간 확정 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <h3 className="text-sm font-semibold text-text-sub mb-3">
            수거 시간 확정
          </h3>
          {booking.confirmedTime && (
            <p className="text-sm text-primary font-semibold mb-3">
              확정: {booking.confirmedTime}
            </p>
          )}
          {isLocked ? (
            <p className="text-xs text-text-muted">
              {booking.confirmedTime ? "수거 진행 중에는 시간을 변경할 수 없습니다" : "확정된 시간이 없습니다"}
            </p>
          ) : (
            <div className="grid grid-cols-4 max-sm:grid-cols-3 gap-2">
              {Array.from({ length: 19 }, (_, i) => {
                const hour = Math.floor(i / 2) + 9;
                const min = i % 2 === 0 ? "00" : "30";
                const slot = `${String(hour).padStart(2, "0")}:${min}`;
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
                      <span className="block text-[10px] text-semantic-red/70">예약됨</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 소요시간 선택 — 수거 시작 이후 잠금 */}
          {!isLocked && (
            <div className="mt-4 pt-3 border-t border-border-light">
              <p className="text-xs font-medium text-text-sub mb-2">예상 소요시간</p>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { label: "30분", value: 30 },
                  { label: "1시간", value: 60 },
                  { label: "1시간30분", value: 90 },
                  { label: "2시간", value: 120 },
                ] as const).map((opt) => (
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
            </div>
          )}
          {isLocked && booking.confirmedDuration != null && (
            <div className="mt-4 pt-3 border-t border-border-light">
              <p className="text-xs font-medium text-text-sub mb-1">예상 소요시간</p>
              <p className="text-sm font-medium">
                {booking.confirmedDuration >= 60
                  ? `${Math.floor(booking.confirmedDuration / 60)}시간${booking.confirmedDuration % 60 ? `${booking.confirmedDuration % 60}분` : ""}`
                  : `${booking.confirmedDuration}분`}
              </p>
            </div>
          )}
        </div>

        {/* 관리자 메모 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
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

        {/* 수거 완료 사진 — 수거 진행 중일 때 업로드, 완료 이후 읽기 전용 */}
        {booking.status === "in_progress" && (
          <div className="bg-bg rounded-lg p-5 border border-border-light">
            <h3 className="text-sm font-semibold text-text-sub mb-3">
              수거 완료 사진
            </h3>
            {completionPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {completionPhotos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square bg-bg-warm rounded-md overflow-hidden">
                    <img
                      src={url}
                      alt={`완료 사진 ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCompletionPhotos((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label
              className={`flex items-center justify-center gap-2 py-3 rounded-md border border-dashed border-border text-sm text-text-sub cursor-pointer hover:bg-bg-warm transition-colors duration-200 ${uploadingPhotos ? "opacity-50 pointer-events-none" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {uploadingPhotos ? "업로드 중..." : "사진 추가"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  setUploadingPhotos(true);
                  try {
                    const formData = new FormData();
                    for (let i = 0; i < files.length; i++) {
                      formData.append("photos", files[i]);
                    }
                    const res = await fetch("/api/upload", {
                      method: "POST",
                      body: formData,
                    });
                    const data = await res.json();
                    if (res.ok && data.urls) {
                      setCompletionPhotos((prev) => [...prev, ...data.urls]);
                    } else {
                      alert(data.error || "업로드 실패");
                    }
                  } catch {
                    alert("업로드 실패");
                  } finally {
                    setUploadingPhotos(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
        )}
        {["completed", "payment_requested", "payment_completed"].includes(booking.status) &&
          completionPhotos.length > 0 && (
          <div className="bg-bg rounded-lg p-5 border border-border-light">
            <h3 className="text-sm font-semibold text-text-sub mb-3">
              수거 완료 사진 ({completionPhotos.length}장)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {completionPhotos.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square bg-bg-warm rounded-md overflow-hidden"
                >
                  <img
                    src={url}
                    alt={`완료 사진 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

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

        {/* 변경 이력 */}
        <div className="bg-bg rounded-lg p-5 border border-border-light">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => {
              if (!auditOpen) loadAuditLogs();
              setAuditOpen(!auditOpen);
            }}
          >
            <h3 className="text-sm font-semibold text-text-sub">변경 이력</h3>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              className={`text-text-muted transition-transform duration-200 ${auditOpen ? "rotate-180" : ""}`}
            >
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {auditOpen && (
            <div className="mt-3 pt-3 border-t border-border-light space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-text-muted">변경 이력이 없습니다</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span className="text-text-muted">
                        {log.admin_email === "legacy" ? "비밀번호 로그인" : log.admin_email}
                      </span>
                    </div>
                    <div className="text-text-muted">
                      {typeof log.details?.previousStatus === "string" && typeof log.details?.newStatus === "string" && (
                        <span>
                          {STATUS_LABELS[log.details.previousStatus] || log.details.previousStatus}
                          {" → "}
                          {STATUS_LABELS[log.details.newStatus] || log.details.newStatus}
                        </span>
                      )}
                      {typeof log.details?.finalPrice === "number" && (
                        <span> | 견적: {formatPrice(log.details.finalPrice)}원</span>
                      )}
                      {typeof log.details?.confirmedTime === "string" && (
                        <span> | 시간: {log.details.confirmedTime}</span>
                      )}
                    </div>
                    <div className="text-text-muted/60">
                      {new Date(log.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
