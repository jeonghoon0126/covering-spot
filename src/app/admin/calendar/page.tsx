"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Booking } from "@/types/booking";
import { safeSessionGet, safeSessionSet, safeSessionRemove } from "@/lib/storage";

/* ── 상수 ── */

const STATUS_LABELS: Record<string, string> = {
  pending: "접수",
  quote_confirmed: "견적확정",
  user_confirmed: "견적확인완료",
  change_requested: "일정변경",
  in_progress: "진행중",
  completed: "수거완료",
  payment_requested: "정산요청",
  payment_completed: "정산완료",
  cancelled: "취소",
  rejected: "수거불가",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-semantic-orange-tint text-semantic-orange",
  quote_confirmed: "bg-primary-tint text-primary",
  user_confirmed: "bg-semantic-green-tint text-semantic-green",
  change_requested: "bg-semantic-orange-tint text-semantic-orange",
  in_progress: "bg-primary-tint text-primary-dark",
  completed: "bg-semantic-green-tint text-semantic-green",
  payment_requested: "bg-semantic-orange-tint text-semantic-orange",
  payment_completed: "bg-semantic-green-tint text-semantic-green",
  cancelled: "bg-semantic-red-tint text-semantic-red",
  rejected: "bg-fill-tint text-text-muted",
};

// 일간 타임라인: 10:00~17:00 (30분 단위, 15개)
const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const hour = Math.floor(i / 2) + 10;
  const min = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${min}`;
});

/* ── 유틸 ── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${weekdays[d.getDay()]})`;
}

function getToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = d.getDay(); // 0=일, 1=월, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 월요일로 이동
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getWeekDays(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/* ── 메인 페이지 ── */

export default function AdminCalendarPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [slotInfo, setSlotInfo] = useState<Record<string, { available: boolean; count: number }>>({});
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [weeklyBookings, setWeeklyBookings] = useState<Record<string, Booking[]>>({});
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  /* ── 인증 ── */

  useEffect(() => {
    const t = safeSessionGet("admin_token");
    if (!t) {
      safeSessionSet("admin_return_url", window.location.pathname);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  /* ── 캘린더 데이터 fetch ── */

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        safeSessionRemove("admin_token");
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

  // 슬롯 가용성 조회
  useEffect(() => {
    if (!selectedDate) return;
    fetch(`/api/slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, { available: boolean; count: number }> = {};
        for (const s of data.slots || []) {
          map[s.time] = { available: s.available, count: s.count };
        }
        setSlotInfo(map);
      })
      .catch(() => {});
  }, [selectedDate]);

  // 주간뷰: 7일치 예약 병렬 조회
  useEffect(() => {
    if (viewMode !== "weekly" || !token) return;
    setWeeklyLoading(true);
    Promise.all(
      weekDays.map((day) =>
        fetch(`/api/admin/bookings?date=${day}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((data) => ({ day, bookings: (data.bookings || []) as Booking[] }))
          .catch(() => ({ day, bookings: [] as Booking[] })),
      ),
    ).then((results) => {
      const map: Record<string, Booking[]> = {};
      for (const { day, bookings: dayB } of results) {
        map[day] = dayB
          .filter((b) => b.date === day && b.status !== "cancelled" && b.status !== "rejected")
          .sort((a, b) => {
            const ta = a.confirmedTime || a.timeSlot || "99:99";
            const tb = b.confirmedTime || b.timeSlot || "99:99";
            return ta.localeCompare(tb);
          });
      }
      setWeeklyBookings(map);
      setWeeklyLoading(false);
    });
  }, [viewMode, weekStart, token, weekDays]);

  /* ── 캘린더 계산 ── */

  // 선택한 날짜의 예약만 필터 + 취소/수거불가 제외
  const dayBookings = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          b.date === selectedDate &&
          b.status !== "cancelled" &&
          b.status !== "rejected",
      )
      .sort((a, b) => {
        const ta = a.confirmedTime || a.timeSlot || "99:99";
        const tb = b.confirmedTime || b.timeSlot || "99:99";
        return ta.localeCompare(tb);
      });
  }, [bookings, selectedDate]);

  // 시간대별 그룹핑
  const slotMap = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const slot of TIME_SLOTS) {
      map[slot] = [];
    }
    map["미정"] = [];

    for (const b of dayBookings) {
      const time = b.confirmedTime || b.timeSlot;
      if (time && map[time]) {
        map[time].push(b);
      } else if (time) {
        // 30분 단위가 아닌 경우 가장 가까운 슬롯에 배치
        const rounded =
          TIME_SLOTS.find((s) => s >= time) || TIME_SLOTS[TIME_SLOTS.length - 1];
        map[rounded].push(b);
      } else {
        map["미정"].push(b);
      }
    }
    return map;
  }, [dayBookings]);

  // 해당일 상태별 요약
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of dayBookings) {
      counts[b.status] = (counts[b.status] || 0) + 1;
    }
    return counts;
  }, [dayBookings]);

  const isToday = selectedDate === getToday();
  const headerTitle = viewMode === "daily" ? "일간 캘린더" : "주간 캘린더";

  return (
    <>
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">{headerTitle}</h1>
            <div className="flex rounded-md border border-border-light overflow-hidden">
              <button
                onClick={() => setViewMode("daily")}
                className={`text-xs px-3 py-1 font-medium transition-colors ${
                  viewMode === "daily"
                    ? "bg-primary text-white"
                    : "bg-bg text-text-sub hover:bg-bg-warm"
                }`}
              >
                일간
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`text-xs px-3 py-1 font-medium transition-colors ${
                  viewMode === "weekly"
                    ? "bg-primary text-white"
                    : "bg-bg text-text-sub hover:bg-bg-warm"
                }`}
              >
                주간
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="text-sm text-text-sub hover:text-text-primary transition-colors flex items-center gap-1 px-2 py-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              목록
            </button>
            <button
              onClick={() => router.push("/admin/driver")}
              className="text-sm text-text-sub hover:text-text-primary transition-colors flex items-center gap-1 px-2 py-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 12L6 4L10 9L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              기사님
            </button>
            <button
              onClick={() => router.push("/admin/dispatch")}
              className="text-sm text-primary hover:text-primary-dark transition-colors flex items-center gap-1 px-2 py-2 font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 8L8 14M14 8H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              배차
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[56rem] mx-auto px-4 py-4">
        {/* ── 일간/주간 뷰: 날짜 네비게이션 ── */}
        <>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() =>
                  setSelectedDate(addDays(selectedDate, viewMode === "daily" ? -1 : -7))
                }
                className="p-2 rounded-full hover:bg-bg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="text-center">
                {viewMode === "daily" ? (
                  <>
                    <p className="text-base font-bold">{formatDate(selectedDate)}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {dayBookings.length}건
                      {Object.entries(summary).map(([status, count]) => (
                        <span key={status} className="ml-1.5">
                          {STATUS_LABELS[status]} {count}
                        </span>
                      ))}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-bold">
                      {formatShortDate(weekDays[0])} ~ {formatShortDate(weekDays[6])}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      총 {Object.values(weeklyBookings).reduce((sum, arr) => sum + arr.length, 0)}건
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() =>
                  setSelectedDate(addDays(selectedDate, viewMode === "daily" ? 1 : 7))
                }
                className="p-2 rounded-full hover:bg-bg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* 오늘 버튼 */}
            {!isToday && (
              <div className="text-center mb-4">
                <button
                  onClick={() => setSelectedDate(getToday())}
                  className="text-xs text-primary font-medium px-3 py-1 rounded-full border border-primary/30 hover:bg-primary-bg transition-colors"
                >
                  오늘로 이동
                </button>
              </div>
            )}
        </>

        {/* ── 일간 타임라인 ── */}
        {viewMode === "daily" && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="space-y-0">
                {TIME_SLOTS.map((slot) => {
                  const items = slotMap[slot];
                  const info = slotInfo[slot];
                  const isFull = info && !info.available;
                  const count = info?.count || 0;

                  return (
                    <div
                      key={slot}
                      className={`flex border-b border-border-light/50 ${
                        isFull ? "bg-semantic-red-tint/30" : ""
                      }`}
                    >
                      {/* 시간 라벨 */}
                      <div className="w-16 max-sm:w-14 shrink-0 py-3 pr-2 text-right">
                        <span className={`text-xs font-medium ${
                          items.length > 0 ? "text-text-primary" : "text-text-muted"
                        }`}>
                          {slot}
                        </span>
                        {count > 0 && (
                          <span className={`block text-[10px] ${isFull ? "text-semantic-red" : "text-text-muted"}`}>
                            {count}/2
                          </span>
                        )}
                      </div>

                      {/* 예약 카드 영역 */}
                      <div className="flex-1 py-2 pl-3 border-l border-border-light min-h-[3rem] flex flex-wrap gap-2">
                        {items.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => router.push(`/admin/bookings/${b.id}`)}
                            className="flex items-center gap-2 bg-bg rounded-md px-3 py-2 border border-border-light hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 text-left max-w-full"
                          >
                            <span
                              className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}
                            >
                              {STATUS_LABELS[b.status]}
                            </span>
                            <span className="text-xs font-medium truncate">
                              {b.customerName}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0">
                              {b.area}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0">
                              {b.items.length}종
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* 시간 미정 */}
                {slotMap["미정"].length > 0 && (
                  <div className="flex border-b border-border-light/50 bg-semantic-orange-tint/20">
                    <div className="w-16 max-sm:w-14 shrink-0 py-3 pr-2 text-right">
                      <span className="text-xs font-medium text-semantic-orange">미정</span>
                    </div>
                    <div className="flex-1 py-2 pl-3 border-l border-border-light min-h-[3rem] flex flex-wrap gap-2">
                      {slotMap["미정"].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => router.push(`/admin/bookings/${b.id}`)}
                          className="flex items-center gap-2 bg-bg rounded-md px-3 py-2 border border-border-light hover:shadow-hover transition-all duration-200 text-left"
                        >
                          <span
                            className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}
                          >
                            {STATUS_LABELS[b.status]}
                          </span>
                          <span className="text-xs font-medium truncate">
                            {b.customerName}
                          </span>
                          <span className="text-[10px] text-text-muted shrink-0">
                            {b.area} | {b.items.length}종
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 빈 상태 */}
            {!loading && dayBookings.length === 0 && (
              <div className="text-center py-12 text-text-muted text-sm">
                이 날짜에 예약이 없습니다
              </div>
            )}

          </>
        )}

        {/* ── 주간 뷰 ── */}
        {viewMode === "weekly" && (
          <>
            {weeklyLoading ? (
              <div className="text-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                  {weekDays.map((day, i) => {
                    const dayB = weeklyBookings[day] || [];
                    const isCurrentDay = day === getToday();
                    return (
                      <div key={day} className="flex flex-col">
                        {/* 컬럼 헤더 */}
                        <div
                          className={`text-center py-2 rounded-t-[--radius-md] border border-border-light ${
                            isCurrentDay
                              ? "bg-primary text-white"
                              : "bg-bg"
                          }`}
                        >
                          <p className={`text-xs font-bold ${isCurrentDay ? "" : "text-text-primary"}`}>
                            {WEEKDAY_LABELS[i]}
                          </p>
                          <p className={`text-[10px] ${isCurrentDay ? "text-white/80" : "text-text-muted"}`}>
                            {formatShortDate(day)}
                          </p>
                        </div>

                        {/* 예약 카드 리스트 */}
                        <div className="flex-1 border border-t-0 border-border-light rounded-b-[--radius-md] bg-bg p-1.5 space-y-1.5 min-h-[120px]">
                          {dayB.length === 0 && (
                            <p className="text-[10px] text-text-muted text-center pt-4">없음</p>
                          )}
                          {dayB.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => router.push(`/admin/bookings/${b.id}`)}
                              className="w-full text-left bg-bg-warm rounded-md px-2 py-1.5 border border-border-light hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200"
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[10px] font-medium text-text-sub">
                                  {b.confirmedTime || b.timeSlot || "미정"}
                                </span>
                                <span
                                  className={`text-[9px] font-semibold px-1 py-px rounded-full ${STATUS_COLORS[b.status]}`}
                                >
                                  {STATUS_LABELS[b.status]}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium truncate">
                                {b.customerName}
                              </p>
                            </button>
                          ))}
                        </div>

                        {/* 건수 */}
                        <div className="text-center mt-1">
                          <span className="text-[10px] text-text-muted">{dayB.length}건</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
    </>
  );
}
