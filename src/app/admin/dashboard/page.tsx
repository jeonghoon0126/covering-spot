"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Booking } from "@/types/booking";

const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "접수" },
  { key: "quote_confirmed", label: "견적확정" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "수거완료" },
  { key: "payment_requested", label: "정산요청" },
  { key: "payment_completed", label: "정산완료" },
  { key: "cancelled", label: "취소" },
];

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

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) {
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const statusParam = activeTab === "all" ? "" : `&status=${activeTab}`;
      const res = await fetch(
        `/api/admin/bookings?token=${token}${statusParam}`,
      );
      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setBookings(data.bookings || []);
      setCounts(data.counts || {});
    } catch {
      // 에러 무시
    } finally {
      setLoading(false);
    }
  }, [token, activeTab, router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">커버링 스팟 관리</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchBookings}
              className="text-sm text-text-sub hover:text-text-primary transition-colors duration-200"
            >
              새로고침
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem("admin_token");
                router.push("/admin");
              }}
              className="text-sm text-semantic-red"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[56rem] mx-auto px-4 py-4">
        {/* 상태 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.key === "all" ? totalCount : counts[tab.key] || 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                    : "bg-bg text-text-sub border border-border-light hover:border-primary/30"
                }`}
              >
                {tab.label}{" "}
                <span className={isActive ? "text-white/70" : "text-text-muted"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">
            해당 상태의 신청이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <button
                key={b.id}
                onClick={() =>
                  router.push(`/admin/bookings/${b.id}?token=${token}`)
                }
                className="w-full bg-bg rounded-2xl p-5 text-left border border-border-light hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}
                    >
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                    <span className="text-xs text-text-muted font-mono">
                      #{b.id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(b.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {b.customerName} | {b.area}
                    </p>
                    <p className="text-xs text-text-sub mt-0.5">
                      {b.date} {b.timeSlot} | 품목 {b.items.length}종
                      {b.photos && b.photos.length > 0 &&
                        ` | 사진 ${b.photos.length}장`}
                    </p>
                  </div>
                  <div className="text-right">
                    {b.finalPrice != null ? (
                      <p className="text-sm font-bold text-primary">
                        {formatPrice(b.finalPrice)}원
                      </p>
                    ) : b.estimateMin && b.estimateMax ? (
                      <p className="text-sm font-medium text-text-neutral">
                        {formatPrice(b.estimateMin)}~
                        {formatPrice(b.estimateMax)}원
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-text-neutral">
                        {formatPrice(b.totalPrice)}원
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
