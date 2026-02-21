"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Booking } from "@/types/booking";

const STATUS_LABELS: Record<string, string> = {
  quote_confirmed: "수거 예정",
  in_progress: "진행중",
  completed: "완료",
};

const STATUS_COLORS: Record<string, string> = {
  quote_confirmed: "bg-primary-tint text-primary",
  in_progress: "bg-semantic-orange-tint text-semantic-orange",
  completed: "bg-semantic-green-tint text-semantic-green",
};

const DRIVER_TABS = [
  { key: "all", label: "전체" },
  { key: "quote_confirmed", label: "예정" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "완료" },
];

const QUICK_ACTIONS: Record<string, { status: string; label: string; color: string }> = {
  quote_confirmed: { status: "in_progress", label: "수거 시작", color: "bg-primary text-white" },
  in_progress: { status: "completed", label: "수거 완료", color: "bg-semantic-green text-white" },
};

function getKstDateStr(offsetDays = 0): string {
  // UTC+9 기준 날짜 계산 (epoch ms 방식 — setHours(+9)는 부정확)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return kst.toISOString().slice(0, 10);
}

function getToday(): string {
  return getKstDateStr(0);
}

function getTomorrow(): string {
  return getKstDateStr(1);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
}

function openMap(address: string) {
  const encoded = encodeURIComponent(address);
  // 카카오맵 앱 딥링크 → fallback: 카카오맵 웹
  const kakaoApp = `kakaomap://search?q=${encoded}`;
  const kakaoWeb = `https://map.kakao.com/?q=${encoded}`;

  const timeout = setTimeout(() => {
    window.location.href = kakaoWeb;
  }, 1500);

  window.location.href = kakaoApp;

  window.addEventListener(
    "blur",
    () => clearTimeout(timeout),
    { once: true },
  );
}

export default function AdminDriverPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDate, setShowDate] = useState<"today" | "tomorrow">("today");
  const [pendingAction, setPendingAction] = useState<{ bookingId: string; newStatus: string; label: string } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showError(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setErrorToast(msg);
    toastTimer.current = setTimeout(() => setErrorToast(null), 3000);
  }

  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) {
      sessionStorage.setItem("admin_return_url", window.location.pathname);
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
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const targetDate = showDate === "today" ? getToday() : getTomorrow();

  // 오늘/내일 + 수거 관련 상태만 필터
  const filtered = useMemo(() => {
    const validStatuses = ["quote_confirmed", "in_progress", "completed"];
    let result = bookings.filter(
      (b) => b.date === targetDate && validStatuses.includes(b.status),
    );

    if (activeTab !== "all") {
      result = result.filter((b) => b.status === activeTab);
    }

    // confirmedTime 오름차순 정렬 ("99:99" = 시간 미지정 항목을 맨 뒤로)
    return result.sort((a, b) => {
      const ta = a.confirmedTime || a.timeSlot || "99:99";
      const tb = b.confirmedTime || b.timeSlot || "99:99";
      return ta.localeCompare(tb);
    });
  }, [bookings, targetDate, activeTab]);

  const statusCounts = useMemo(() => {
    const validStatuses = ["quote_confirmed", "in_progress", "completed"];
    const dayBookings = bookings.filter(
      (b) => b.date === targetDate && validStatuses.includes(b.status),
    );
    const counts: Record<string, number> = { all: dayBookings.length };
    for (const b of dayBookings) {
      counts[b.status] = (counts[b.status] || 0) + 1;
    }
    return counts;
  }, [bookings, targetDate]);

  async function confirmQuickAction() {
    if (!pendingAction) return;
    const { bookingId, newStatus } = pendingAction;
    setPendingAction(null);
    setActionLoading(bookingId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
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
        const data = await res.json().catch(() => ({}));
        showError(data.error || "변경 실패");
      }
    } catch {
      showError("네트워크 오류");
    } finally {
      setActionLoading(null);
    }
  }

  const pendingCount = statusCounts["quote_confirmed"] || 0;
  const inProgressCount = statusCounts["in_progress"] || 0;

  return (
    <>
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">
              {showDate === "today" ? "오늘의 수거" : "내일 수거"}
            </h1>
            <p className="text-xs text-text-muted">
              {formatDateShort(targetDate)} · 예정 {pendingCount} · 진행 {inProgressCount}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchBookings}
              className="p-2 rounded-full hover:bg-bg-warm transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-text-sub">
                <path d="M15 9A6 6 0 113 9a6 6 0 0112 0z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M15 3v3.5h-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="p-2 rounded-full hover:bg-bg-warm transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-text-sub">
                <path d="M2 4H16M2 9H16M2 14H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[42rem] mx-auto px-4 py-4">
        {/* 오늘/내일 토글 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowDate("today")}
            className={`flex-1 py-3 rounded-md text-sm font-medium transition-all ${
              showDate === "today"
                ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                : "bg-bg text-text-sub border border-border-light"
            }`}
          >
            오늘 ({formatDateShort(getToday())})
          </button>
          <button
            onClick={() => setShowDate("tomorrow")}
            className={`flex-1 py-3 rounded-md text-sm font-medium transition-all ${
              showDate === "tomorrow"
                ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                : "bg-bg text-text-sub border border-border-light"
            }`}
          >
            내일 ({formatDateShort(getTomorrow())})
          </button>
        </div>

        {/* 상태 탭 */}
        <div className="flex gap-2 mb-4">
          {DRIVER_TABS.map((tab) => {
            const count = statusCounts[tab.key] || 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                    : "bg-bg text-text-sub border border-border-light"
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

        {/* 수거 목록 */}
        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">
            {showDate === "today" ? "오늘" : "내일"} 수거 건이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => {
              const quickAction = QUICK_ACTIONS[b.status];
              const isLoading = actionLoading === b.id;
              const time = b.confirmedTime || b.timeSlot;
              const itemSummary =
                b.items.length === 1
                  ? b.items[0].name
                  : `${b.items[0].name} 외 ${b.items.length - 1}종`;

              return (
                <div
                  key={b.id}
                  className="bg-bg rounded-lg border border-border-light overflow-hidden"
                >
                  {/* 카드 상단: 시간 + 상태 */}
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold tabular-nums">
                        {time || "미정"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}
                      >
                        {STATUS_LABELS[b.status]}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">
                      #{b.id.slice(0, 6)}
                    </span>
                  </div>

                  {/* 고객 정보 */}
                  <div className="px-4 pb-3 space-y-2">
                    {/* 이름 + 전화 */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{b.customerName}</span>
                      <a
                        href={`tel:${b.phone}`}
                        className="text-sm text-primary font-medium flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M5.5 2.5L4 1H2C1.5 1 1 1.5 1 2C1 8 6 13 12 13C12.5 13 13 12.5 13 12V10L11.5 8.5L10 9.5C9 10 7 9 5.5 7.5C4 6 3 4 3.5 3L5.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                        </svg>
                        {b.phone}
                      </a>
                    </div>

                    {/* 주소 */}
                    <button
                      onClick={() => openMap(b.address + (b.addressDetail ? " " + b.addressDetail : ""))}
                      className="text-xs text-text-sub text-left flex items-start gap-1.5 hover:text-primary transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-0.5 shrink-0">
                        <path d="M6 1C4 1 2.5 2.5 2.5 4.5C2.5 7.5 6 11 6 11C6 11 9.5 7.5 9.5 4.5C9.5 2.5 8 1 6 1Z" stroke="currentColor" strokeWidth="1.2"/>
                        <circle cx="6" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                      <span>
                        {b.address}
                        {b.addressDetail && <span className="text-text-muted"> {b.addressDetail}</span>}
                      </span>
                    </button>

                    {/* 품목 */}
                    <p className="text-xs text-text-sub">
                      {itemSummary} · {b.crewSize}명
                    </p>

                    {/* 작업환경 아이콘 */}
                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                      {b.hasElevator === true && (
                        <span className="px-1.5 py-0.5 rounded bg-semantic-green-tint text-semantic-green">
                          엘리베이터
                        </span>
                      )}
                      {b.hasElevator === false && (
                        <span className="px-1.5 py-0.5 rounded bg-semantic-red-tint text-semantic-red">
                          계단
                        </span>
                      )}
                      {b.hasParking === true && (
                        <span className="px-1.5 py-0.5 rounded bg-semantic-green-tint text-semantic-green">
                          주차가능
                        </span>
                      )}
                      {b.hasParking === false && (
                        <span className="px-1.5 py-0.5 rounded bg-semantic-orange-tint text-semantic-orange">
                          주차불가
                        </span>
                      )}
                      {b.needLadder && (
                        <span className="px-1.5 py-0.5 rounded bg-primary-tint text-primary">
                          사다리차
                        </span>
                      )}
                    </div>

                    {/* 요청사항 */}
                    {b.memo && (
                      <p className="text-[10px] text-semantic-orange bg-semantic-orange-tint/50 px-2 py-1 rounded">
                        {b.memo}
                      </p>
                    )}
                  </div>

                  {/* 퀵 액션 */}
                  {quickAction && (
                    <div className="px-4 pb-3">
                      {pendingAction?.bookingId === b.id ? (
                        /* 인라인 확인 UI */
                        <div className="flex gap-2">
                          <button
                            onClick={confirmQuickAction}
                            className="flex-1 py-2 rounded-md bg-semantic-green text-white text-sm font-semibold active:scale-[0.98] transition-all"
                          >
                            확인
                          </button>
                          <button
                            onClick={() => setPendingAction(null)}
                            className="flex-1 py-2 rounded-md bg-bg-warm text-text-sub text-sm font-medium border border-border-light active:scale-[0.98] transition-all"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingAction({ bookingId: b.id, newStatus: quickAction.status, label: quickAction.label })}
                          disabled={isLoading}
                          className={`w-full py-2.5 rounded-md text-sm font-semibold transition-all duration-200 ${quickAction.color} ${
                            isLoading ? "opacity-50" : "active:scale-[0.98]"
                          }`}
                        >
                          {isLoading ? "..." : quickAction.label}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* 에러 토스트 */}
    {errorToast && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-semantic-red text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
        {errorToast}
      </div>
    )}
    </>
  );
}
