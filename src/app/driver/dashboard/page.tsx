"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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

const SLOT_LABELS: Record<string, string> = {
  "10:00": "10~12시",
  "12:00": "12~14시",
  "14:00": "14~16시",
  "15:00": "15~17시",
};
const SLOT_ORDER = ["10:00", "12:00", "14:00", "15:00"];

// 드라이버가 직접 변경 가능한 퀵 액션
const QUICK_ACTIONS: Record<string, { status: string; label: string }> = {
  quote_confirmed: { status: "in_progress", label: "수거 시작" },
  in_progress: { status: "completed", label: "수거 완료" },
};

const DRIVER_TABS = [
  { key: "all", label: "전체" },
  { key: "quote_confirmed", label: "예정" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "완료" },
];

function getKSTDate(offset = 0): string {
  // setHours 방식은 날짜 경계에서 부정확 → epoch ms 기준으로 정확하게 계산
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstMs = Date.now() + KST_OFFSET_MS + offset * 24 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
}

function openMap(address: string) {
  const encoded = encodeURIComponent(address);
  const naverUrl = `nmap://search?query=${encoded}&appname=com.covering.spot`;
  const kakaoFallback = `https://map.kakao.com/?q=${encoded}`;

  const timeout = setTimeout(() => {
    window.location.href = kakaoFallback;
  }, 1500);

  window.location.href = naverUrl;
  window.addEventListener("blur", () => clearTimeout(timeout), { once: true });
}

export default function DriverDashboard() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Partial<Booking>[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null); // null = 아직 확인 전, "" = 없음
  const [driverName, setDriverName] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showDate, setShowDate] = useState<"today" | "tomorrow">("today");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // 퀵액션 인라인 확인 대기 bookingId (window.confirm 대체)
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // 인라인 에러 토스트 (alert() 대신)
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3000);
  }

  // 토스트 타이머 cleanup
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const t = sessionStorage.getItem("driver_token");
    const name = sessionStorage.getItem("driver_name");
    if (!t) {
      router.replace("/driver");
      return;
    }
    setToken(t);
    setDriverName(name || "");
  }, [router]);

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/driver/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem("driver_token");
        sessionStorage.removeItem("driver_name");
        router.replace("/driver");
        return;
      }
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      showToast("데이터를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  function handleLogout() {
    sessionStorage.removeItem("driver_token");
    sessionStorage.removeItem("driver_name");
    router.replace("/driver");
  }

  const targetDate =
    showDate === "today" ? getKSTDate(0) : getKSTDate(1);

  const filtered = useMemo(() => {
    let result = bookings.filter((b) => b.date === targetDate);
    if (activeTab !== "all") {
      result = result.filter((b) => b.status === activeTab);
    }
    // routeOrder 우선, 없으면 confirmedTime / timeSlot 순
    return result.sort((a, b) => {
      const ra = a.routeOrder ?? 9999;
      const rb = b.routeOrder ?? 9999;
      if (ra !== rb) return ra - rb;
      const ta = a.confirmedTime || a.timeSlot || "99:99";
      const tb = b.confirmedTime || b.timeSlot || "99:99";
      return ta.localeCompare(tb);
    });
  }, [bookings, targetDate, activeTab]);

  const statusCounts = useMemo(() => {
    const dayBookings = bookings.filter((b) => b.date === targetDate);
    const counts: Record<string, number> = { all: dayBookings.length };
    for (const b of dayBookings) {
      if (b.status) counts[b.status] = (counts[b.status] || 0) + 1;
    }
    return counts;
  }, [bookings, targetDate]);

  async function handleQuickAction(
    booking: Partial<Booking>,
    newStatus: string,
  ) {
    if (!booking.id) return; // non-null 방어

    setPendingAction(null);

    // 낙관적 업데이트: API 호출 전 로컬 상태 먼저 변경 → 즉각 피드백
    const prevStatus = booking.status;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? { ...b, status: newStatus as Booking["status"] }
          : b,
      ),
    );

    setActionLoading(booking.id);
    try {
      const res = await fetch(`/api/driver/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchBookings(); // 서버 응답으로 최종 동기화 (await로 완료 후 loading 해제)
      } else {
        const data = await res.json();
        // 롤백
        setBookings((prev) =>
          prev.map((b) =>
            b.id === booking.id ? { ...b, status: prevStatus } : b,
          ),
        );
        showToast(data.error || "변경 실패");
      }
    } catch {
      // 롤백
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id ? { ...b, status: prevStatus } : b,
        ),
      );
      showToast("네트워크 오류");
    } finally {
      setActionLoading(null);
    }
  }

  // 시간대별 그룹핑 (routeOrder 정렬은 유지)
  const groupedBySlot = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const b of filtered) {
      const slot = b.timeSlot || "시간 미정";
      if (!groups.has(slot)) groups.set(slot, []);
      groups.get(slot)!.push(b);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const ia = SLOT_ORDER.indexOf(a);
      const ib = SLOT_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const pendingCount = statusCounts["quote_confirmed"] || 0;
  const inProgressCount = statusCounts["in_progress"] || 0;

  // 토큰 확인 전(null) → 아무것도 렌더하지 않음 (플리커 방지)
  if (token === null) return null;

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* 토스트 */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-text text-bg-warm text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">
              {driverName ? `${driverName}님 수거` : "오늘의 수거"}
            </h1>
            <p className="text-xs text-text-muted">
              {formatDateShort(targetDate)} · 예정 {pendingCount} · 진행{" "}
              {inProgressCount}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {/* 새로고침 */}
            <button
              onClick={fetchBookings}
              className="p-2 rounded-full hover:bg-bg-warm transition-colors"
              aria-label="새로고침"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                className="text-text-sub"
              >
                <path
                  d="M15 9A6 6 0 113 9a6 6 0 0112 0z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M15 3v3.5h-3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/* 로그아웃 */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-bg-warm transition-colors"
              aria-label="로그아웃"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                className="text-text-sub"
              >
                <path
                  d="M7 3H3a1 1 0 00-1 1v10a1 1 0 001 1h4M12 13l4-4-4-4M16 9H7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
            오늘 ({formatDateShort(getKSTDate(0))})
          </button>
          <button
            onClick={() => setShowDate("tomorrow")}
            className={`flex-1 py-3 rounded-md text-sm font-medium transition-all ${
              showDate === "tomorrow"
                ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                : "bg-bg text-text-sub border border-border-light"
            }`}
          >
            내일 ({formatDateShort(getKSTDate(1))})
          </button>
        </div>

        {/* 상태 탭 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {DRIVER_TABS.map((tab) => {
            const count = statusCounts[tab.key] || 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
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
          <div className="flex items-center justify-center py-16">
            <svg
              className="animate-spin w-6 h-6 text-primary"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-text-muted text-sm">
            {showDate === "today" ? "오늘" : "내일"} 배차된 수거가 없습니다
          </div>
        ) : (
          <div className="space-y-5">
            {groupedBySlot.map(([slot, slotBookings]) => (
              <div key={slot}>
                <div className="text-xs font-semibold text-text-muted mb-2.5 px-1">
                  {SLOT_LABELS[slot] || slot} · {slotBookings.length}건
                </div>
                <div className="space-y-3">
                {slotBookings.map((b) => {
              const quickAction = QUICK_ACTIONS[b.status!];
              const isLoading = actionLoading === b.id;
              const time = b.confirmedTime || b.timeSlot;
              const itemSummary =
                !b.items || b.items.length === 0
                  ? "품목 없음"
                  : b.items.length === 1
                    ? b.items[0].displayName || b.items[0].name
                    : `${b.items[0].displayName || b.items[0].name} 외 ${b.items.length - 1}종`;

              return (
                <div
                  key={b.id}
                  className="bg-bg rounded-xl border border-border-light overflow-hidden"
                >
                  {/* 카드 상단: 순서 번호 + 시간 + 상태 */}
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* 루트 순서 배지 */}
                      {b.routeOrder != null && (
                        <span className="w-6 h-6 rounded-full bg-text text-bg-warm text-[11px] font-bold flex items-center justify-center shrink-0">
                          {b.routeOrder}
                        </span>
                      )}
                      <span className="text-xl font-bold tabular-nums">
                        {time || "시간 미정"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status!] || ""}`}
                      >
                        {STATUS_LABELS[b.status!] || b.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">
                      #{b.id?.slice(0, 6)}
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
                          <path
                            d="M5.5 2.5L4 1H2C1.5 1 1 1.5 1 2C1 8 6 13 12 13C12.5 13 13 12.5 13 12V10L11.5 8.5L10 9.5C9 10 7 9 5.5 7.5C4 6 3 4 3.5 3L5.5 2.5Z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {b.phone}
                      </a>
                    </div>

                    {/* 주소 */}
                    <button
                      onClick={() =>
                        openMap(
                          b.address! + (b.addressDetail ? " " + b.addressDetail : ""),
                        )
                      }
                      className="text-xs text-text-sub text-left flex items-start gap-1.5 hover:text-primary transition-colors"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="mt-0.5 shrink-0"
                      >
                        <path
                          d="M6 1C4 1 2.5 2.5 2.5 4.5C2.5 7.5 6 11 6 11C6 11 9.5 7.5 9.5 4.5C9.5 2.5 8 1 6 1Z"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <circle
                          cx="6"
                          cy="4.5"
                          r="1.5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                      </svg>
                      <span>
                        {b.address}
                        {b.addressDetail && (
                          <span className="text-text-muted"> {b.addressDetail}</span>
                        )}
                      </span>
                    </button>

                    {/* 품목 + 인원 */}
                    <p className="text-xs text-text-sub">
                      {itemSummary} · {b.crewSize}명
                    </p>

                    {/* 작업 환경 태그 */}
                    <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
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

                  {/* 퀵 액션 버튼 — 1차 클릭 시 인라인 확인 UI 표시 (window.confirm 대체) */}
                  {quickAction && (
                    pendingAction === b.id ? (
                      <div className="px-4 pb-4 flex gap-2">
                        <button
                          onClick={() => handleQuickAction(b, quickAction.status)}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                            quickAction.status === "in_progress"
                              ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.25)]"
                              : "bg-semantic-green text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
                          }`}
                        >
                          {quickAction.label} 확인
                        </button>
                        <button
                          onClick={() => setPendingAction(null)}
                          className="px-4 py-2.5 rounded-lg text-sm font-medium border border-border-light text-text-sub hover:bg-bg-warm transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => { if (b.id) setPendingAction(b.id); }}
                          disabled={isLoading || actionLoading !== null}
                          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-[0.98]
                            ${quickAction.status === "in_progress"
                              ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.25)]"
                              : "bg-semantic-green text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
                            }
                            ${isLoading ? "opacity-50" : ""}
                          `}
                        >
                          {isLoading ? "처리 중..." : quickAction.label}
                        </button>
                      </div>
                    )
                  )}
                </div>
              );
                })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
