"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  pending: "bg-orange-100 text-orange-600",
  quote_confirmed: "bg-blue-100 text-blue-600",
  in_progress: "bg-purple-100 text-purple-600",
  completed: "bg-green-100 text-green-600",
  payment_requested: "bg-yellow-100 text-yellow-700",
  payment_completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
  rejected: "bg-gray-100 text-gray-600",
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
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">커버링 스팟 관리</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchBookings}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              새로고침
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem("admin_token");
                router.push("/admin");
              }}
              className="text-sm text-red-500"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
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
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#2563EB] text-white"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {tab.label}{" "}
                <span className={isActive ? "text-white/70" : "text-gray-400"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
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
                className="w-full bg-white rounded-xl p-4 text-left hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}
                    >
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      #{b.id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(b.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {b.customerName} | {b.area}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.date} {b.timeSlot} | 품목 {b.items.length}종
                      {b.photos && b.photos.length > 0 &&
                        ` | 사진 ${b.photos.length}장`}
                    </p>
                  </div>
                  <div className="text-right">
                    {b.finalPrice != null ? (
                      <p className="text-sm font-bold text-[#2563EB]">
                        {formatPrice(b.finalPrice)}원
                      </p>
                    ) : b.estimateMin && b.estimateMax ? (
                      <p className="text-sm font-medium text-gray-700">
                        {formatPrice(b.estimateMin)}~
                        {formatPrice(b.estimateMax)}원
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-gray-700">
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
