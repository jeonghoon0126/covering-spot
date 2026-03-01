"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Booking } from "@/types/booking";
import { safeSessionGet, safeSessionSet, safeSessionRemove } from "@/lib/storage";
import { STATUS_LABELS_SHORT as STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { AdminLogo } from "@/components/ui/AdminLogo";

// 일간 타임라인: 10:00~17:00 (30분 단위, 15개)
const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const hour = Math.floor(i / 2) + 10;
  const min = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${min}`;
});

// 섹션 구분: 오전/오후/저녁
const SECTION_BREAKS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  "10:00": { label: "오전", bg: "bg-primary-tint", text: "text-primary", border: "border-l-2 border-primary" },
  "13:00": { label: "오후", bg: "bg-semantic-orange-tint", text: "text-semantic-orange", border: "border-l-2 border-semantic-orange" },
  "17:00": { label: "저녁", bg: "bg-bg-warm2", text: "text-text-sub", border: "border-l-2 border-border-strong" },
};

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

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function buildMonthDays(dateStr: string): (string | null)[] {
  const d = new Date(dateStr + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const days: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= lastDate; day++) {
    days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  while (days.length < 42) days.push(null);
  return days;
}

/* ── 메인 페이지 ── */

export default function AdminCalendarPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [slotInfo, setSlotInfo] = useState<Record<string, { available: boolean; count: number }>>({});
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("daily");
  const [weeklyBookings, setWeeklyBookings] = useState<Record<string, Booking[]>>({});
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [monthlyBookings, setMonthlyBookings] = useState<Record<string, Booking[]>>({});
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const monthDays = useMemo(() => buildMonthDays(selectedDate), [selectedDate]);

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

  // 월간뷰: 해당 월 예약 일괄 조회
  useEffect(() => {
    if (viewMode !== "monthly" || !token) return;
    const d = new Date(selectedDate + "T00:00:00");
    const year = d.getFullYear();
    const month = d.getMonth();
    const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
    setMonthlyLoading(true);
    fetch(`/api/admin/bookings?dateFrom=${dateFrom}&dateTo=${dateTo}&status=all&limit=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, Booking[]> = {};
        for (const b of (data.bookings || []) as Booking[]) {
          if (b.status === "cancelled" || b.status === "rejected") continue;
          if (!map[b.date]) map[b.date] = [];
          map[b.date].push(b);
        }
        setMonthlyBookings(map);
      })
      .catch(() => {})
      .finally(() => setMonthlyLoading(false));
  }, [viewMode, selectedDate, token]);

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
  const headerTitle = viewMode === "daily" ? "일간 캘린더" : viewMode === "weekly" ? "주간 캘린더" : "월간 캘린더";

  return (
    <>
    <div className="min-h-screen bg-bg-warm">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
        <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AdminLogo />
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
              <button
                onClick={() => setViewMode("monthly")}
                className={`text-xs px-3 py-1 font-medium transition-colors ${
                  viewMode === "monthly"
                    ? "bg-primary text-white"
                    : "bg-bg text-text-sub hover:bg-bg-warm"
                }`}
              >
                월간
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
                  setSelectedDate(viewMode === "monthly" ? addMonths(selectedDate, -1) : addDays(selectedDate, viewMode === "daily" ? -1 : -7))
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
                ) : viewMode === "weekly" ? (
                  <>
                    <p className="text-base font-bold">
                      {formatShortDate(weekDays[0])} ~ {formatShortDate(weekDays[6])}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      총 {Object.values(weeklyBookings).reduce((sum, arr) => sum + arr.length, 0)}건
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-bold">
                      {new Date(selectedDate + "T00:00:00").getFullYear()}년{" "}
                      {new Date(selectedDate + "T00:00:00").getMonth() + 1}월
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      총 {Object.values(monthlyBookings).reduce((sum, arr) => sum + arr.length, 0)}건
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() =>
                  setSelectedDate(viewMode === "monthly" ? addMonths(selectedDate, 1) : addDays(selectedDate, viewMode === "daily" ? 1 : 7))
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
              /* 스켈레톤 로딩 */
              <div className="space-y-0 animate-pulse">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex border-b border-border-light/50">
                    <div className="w-16 shrink-0 bg-bg-warm py-3 pr-2">
                      <div className="h-3 bg-bg-warm3 rounded ml-2" />
                    </div>
                    <div className="flex-1 py-2 pl-3 border-l border-border-light min-h-[2rem]">
                      {i % 3 === 0 && <div className="h-7 bg-bg-warm3 rounded-md w-36" />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[--radius-md] border border-border-light overflow-hidden">
                {TIME_SLOTS.map((slot) => {
                  const items = slotMap[slot];
                  const info = slotInfo[slot];
                  const isFull = info && !info.available;
                  const count = info?.count || 0;
                  const section = SECTION_BREAKS[slot];

                  return (
                    <>
                      {/* 섹션 헤더 (오전/오후/저녁) */}
                      {section && (
                        <div key={`section-${slot}`} className={`flex items-center px-3 py-1.5 ${section.bg} border-b border-border-light/50`}>
                          <span className={`text-[11px] font-bold ${section.text}`}>{section.label}</span>
                        </div>
                      )}
                      <div
                        key={slot}
                        className={`flex border-b border-border-light/30 ${
                          isFull ? "bg-semantic-red-tint/20" : ""
                        }`}
                      >
                        {/* 시간 라벨 */}
                        <div className={`w-16 max-sm:w-14 shrink-0 py-2.5 pr-2 text-right bg-bg-warm ${section ? section.border : ""}`}>
                          <span className={`text-xs font-medium ${
                            items.length > 0 ? "text-text-primary" : "text-text-muted"
                          }`}>
                            {slot}
                          </span>
                          {count > 0 && (
                            isFull ? (
                              <span className="block text-[9px] font-bold mt-0.5 px-1 rounded bg-semantic-red text-white">마감</span>
                            ) : (
                              <span className="block text-[10px] text-text-muted">{count}/2</span>
                            )
                          )}
                        </div>

                        {/* 예약 카드 영역 */}
                        <div className="flex-1 py-2 pl-3 border-l border-border-light min-h-[2rem] flex flex-col gap-1">
                          {items.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => router.push(`/admin/bookings/${b.id}`)}
                              className="flex items-center gap-2 bg-bg rounded-md px-3 py-1.5 border border-border-light hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 text-left w-fit max-w-full"
                            >
                              <span
                                className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}
                              >
                                {STATUS_LABELS[b.status]}
                              </span>
                              <span className="text-xs font-medium truncate max-w-[120px]">
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
                    </>
                  );
                })}

                {/* 시간 미정 */}
                {slotMap["미정"].length > 0 && (
                  <div className="flex border-b border-border-light/50 bg-semantic-orange-tint/20">
                    <div className="w-16 max-sm:w-14 shrink-0 py-2.5 pr-2 text-right bg-bg-warm border-l-2 border-semantic-orange">
                      <span className="text-xs font-medium text-semantic-orange">미정</span>
                    </div>
                    <div className="flex-1 py-2 pl-3 border-l border-border-light min-h-[2rem] flex flex-col gap-1">
                      {slotMap["미정"].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => router.push(`/admin/bookings/${b.id}`)}
                          className="flex items-center gap-2 bg-bg rounded-md px-3 py-1.5 border border-border-light hover:shadow-hover transition-all duration-200 text-left w-fit"
                        >
                          <span
                            className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}
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

        {/* ── 월간 뷰 ── */}
        {viewMode === "monthly" && (
          <>
            {monthlyLoading ? (
              <div className="animate-pulse">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAY_LABELS.map((d) => (
                    <div key={d} className="h-5 bg-bg-warm3 rounded" />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <div key={i} className="h-16 bg-bg-warm3 rounded-md" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAY_LABELS.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-text-muted py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} />;
                    const dayB = monthlyBookings[day] || [];
                    const amCount = dayB.filter((b) => b.timeSlot?.includes("오전")).length;
                    const pmCount = dayB.filter((b) => b.timeSlot?.includes("오후")).length;
                    const eveCount = dayB.filter((b) => b.timeSlot?.includes("저녁")).length;
                    const unscheduled = dayB.length - amCount - pmCount - eveCount;
                    const isCurrentMonth = day.startsWith(selectedDate.slice(0, 7));
                    const isTodayCell = day === getToday();
                    return (
                      <button
                        key={day}
                        onClick={() => { setSelectedDate(day); setViewMode("daily"); }}
                        className={`rounded-md p-1.5 text-left transition-colors min-h-[64px] flex flex-col ${
                          isTodayCell ? "ring-2 ring-primary bg-primary-tint/20" : `border border-border-light/50 ${isCurrentMonth ? "bg-bg hover:bg-bg-warm" : "bg-bg-warm hover:bg-bg-warm2"}`
                        }`}
                      >
                        <p className={`text-xs font-semibold mb-0.5 ${
                          isTodayCell ? "text-primary" : isCurrentMonth ? "text-text-primary" : "text-text-muted"
                        }`}>
                          {parseInt(day.slice(8), 10)}
                        </p>
                        {amCount > 0 && (
                          <span className="text-[9px] font-medium text-primary bg-primary-tint px-1 py-0.5 rounded block leading-tight mb-0.5">
                            오전 {amCount}
                          </span>
                        )}
                        {pmCount > 0 && (
                          <span className="text-[9px] font-medium text-semantic-orange bg-semantic-orange-tint px-1 py-0.5 rounded block leading-tight mb-0.5">
                            오후 {pmCount}
                          </span>
                        )}
                        {eveCount > 0 && (
                          <span className="text-[9px] font-medium text-text-sub bg-bg-warm3 px-1 py-0.5 rounded block leading-tight mb-0.5">
                            저녁 {eveCount}
                          </span>
                        )}
                        {unscheduled > 0 && (
                          <span className="text-[9px] text-text-muted px-1 py-0.5 block leading-tight">
                            미정 {unscheduled}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── 주간 뷰 ── */}
        {viewMode === "weekly" && (
          <>
            {weeklyLoading ? (
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="grid grid-cols-7 gap-2 min-w-[840px] animate-pulse">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex flex-col">
                      <div className="h-10 bg-bg-warm3 rounded-t-[--radius-md]" />
                      <div className="flex-1 border border-t-0 border-border-light rounded-b-[--radius-md] p-1.5 space-y-1.5 min-h-[120px]">
                        {Array.from({ length: i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0 }).map((_, j) => (
                          <div key={j} className="h-9 bg-bg-warm3 rounded-md" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="grid grid-cols-7 gap-2 min-w-[840px]">
                  {weekDays.map((day, i) => {
                    const dayB = weeklyBookings[day] || [];
                    const isCurrentDay = day === getToday();
                    return (
                      <div key={day} className="flex flex-col">
                        {/* 컬럼 헤더 */}
                        <div
                          className={`text-center py-2.5 rounded-t-[--radius-md] border border-border-light ${
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
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span
                                  className={`text-[9px] font-semibold px-1 py-px rounded-full shrink-0 ${STATUS_COLORS[b.status]}`}
                                >
                                  {STATUS_LABELS[b.status]}
                                </span>
                                <span className="text-[9px] text-text-muted shrink-0">
                                  {b.confirmedTime || b.timeSlot || "미정"}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium truncate leading-tight">
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
