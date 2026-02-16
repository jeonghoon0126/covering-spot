"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

// 대시보드에서 바로 실행 가능한 다음 상태 (추가 입력 불필요한 것만)
const QUICK_ACTIONS: Record<string, { status: string; label: string; color: string }> = {
  quote_confirmed: { status: "in_progress", label: "수거 시작", color: "bg-primary text-white" },
  in_progress: { status: "completed", label: "수거 완료", color: "bg-semantic-green text-white" },
  completed: { status: "payment_requested", label: "정산 요청", color: "bg-semantic-orange text-white" },
  payment_requested: { status: "payment_completed", label: "정산 완료", color: "bg-semantic-green text-white" },
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

  // 검색 + 필터
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // 퀵 액션 로딩 상태
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

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
      const res = await fetch("/api/admin/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
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
  }, [token, router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // 클라이언트 사이드 필터링
  const filtered = useMemo(() => {
    let result = bookings;

    // 상태 탭 필터
    if (activeTab !== "all") {
      result = result.filter((b) => b.status === activeTab);
    }

    // 검색 (주문번호, 이름, 전화번호, 주소)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.phone.replace(/-/g, "").includes(q.replace(/-/g, "")) ||
          b.address.toLowerCase().includes(q) ||
          (b.addressDetail && b.addressDetail.toLowerCase().includes(q)),
      );
    }

    // 기간 필터 (수거일 기준)
    if (dateFrom) {
      result = result.filter((b) => b.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((b) => b.date <= dateTo);
    }

    return result;
  }, [bookings, activeTab, search, dateFrom, dateTo]);

  async function handleQuickAction(booking: Booking, newStatus: string, label: string) {
    if (!confirm(`"${booking.customerName}" 건을 "${label}"(으)로 변경할까요?`)) return;

    setQuickLoading(booking.id);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || "변경 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setQuickLoading(null);
    }
  }

  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">커버링 스팟 관리</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/calendar")}
              className="text-sm text-text-sub hover:text-text-primary transition-colors duration-200 flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M1 5.5H13M4 1V3.5M10 1V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              캘린더
            </button>
            <button
              onClick={() => router.push("/admin/driver")}
              className="text-sm text-text-sub hover:text-text-primary transition-colors duration-200 flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2 13C2 10.2 4.2 8 7 8C9.8 8 12 10.2 12 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              기사님
            </button>
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
        {/* 검색 + 필터 */}
        <div className="space-y-3 mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg
                width="16" height="16" viewBox="0 0 16 16" fill="none"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              >
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 전화번호, 주소, 주문번호 검색"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-[--radius-md] border border-border-light bg-bg focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 px-3 py-2.5 rounded-[--radius-md] border text-sm transition-colors ${
                showFilters || dateFrom || dateTo
                  ? "border-primary bg-primary-bg text-primary"
                  : "border-border-light bg-bg text-text-sub"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
                <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* 기간 필터 */}
          {showFilters && (
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs text-text-sub shrink-0">수거일</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 min-w-[120px] px-2.5 py-2 text-sm rounded-[--radius-md] border border-border-light bg-bg focus:outline-none focus:border-primary/50"
              />
              <span className="text-text-muted text-xs">~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 min-w-[120px] px-2.5 py-2 text-sm rounded-[--radius-md] border border-border-light bg-bg focus:outline-none focus:border-primary/50"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="shrink-0 text-xs text-semantic-red"
                >
                  초기화
                </button>
              )}
            </div>
          )}
        </div>

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

        {/* 결과 수 */}
        {(search || dateFrom || dateTo) && !loading && (
          <p className="text-xs text-text-muted mb-3">
            검색 결과 {filtered.length}건
          </p>
        )}

        {/* 목록 */}
        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">
            {search || dateFrom || dateTo
              ? "검색 결과가 없습니다"
              : "해당 상태의 신청이 없습니다"}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => {
              const quickAction = QUICK_ACTIONS[b.status];
              const isQuickLoading = quickLoading === b.id;

              return (
                <div
                  key={b.id}
                  className="bg-bg rounded-[--radius-lg] border border-border-light hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200"
                >
                  {/* 메인 영역 (클릭 → 상세) */}
                  <button
                    onClick={() => router.push(`/admin/bookings/${b.id}`)}
                    className="w-full p-4 max-sm:p-3.5 text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}
                        >
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                        <span className="text-xs text-text-muted font-mono">
                          #{b.id.slice(0, 8)}
                        </span>
                      </div>
                      <span className="text-xs text-text-muted shrink-0 ml-2">
                        {new Date(b.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {b.customerName} | {b.phone}
                        </p>
                        <p className="text-xs text-text-sub mt-0.5 truncate">
                          {b.date} {b.timeSlot} | {b.area} | 품목 {b.items.length}종
                        </p>
                      </div>
                      <div className="text-right shrink-0">
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

                  {/* 퀵 액션 바 */}
                  {quickAction && (
                    <div className="px-4 max-sm:px-3.5 pb-3 max-sm:pb-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAction(b, quickAction.status, quickAction.label);
                        }}
                        disabled={isQuickLoading}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${quickAction.color} ${
                          isQuickLoading ? "opacity-50" : "hover:opacity-90"
                        }`}
                      >
                        {isQuickLoading ? "..." : quickAction.label}
                      </button>
                    </div>
                  )}
                  {/* pending은 상세에서 견적 확정해야 하므로 안내 */}
                  {b.status === "pending" && (
                    <div className="px-4 max-sm:px-3.5 pb-3 max-sm:pb-2.5">
                      <button
                        onClick={() => router.push(`/admin/bookings/${b.id}`)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-semantic-orange-tint text-semantic-orange transition-all duration-200 hover:opacity-90"
                      >
                        견적 확정하기 →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
