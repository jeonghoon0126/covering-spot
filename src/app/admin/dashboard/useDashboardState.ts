"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { safeSessionGet, safeSessionSet, safeLocalGet, safeLocalRemove } from "@/lib/storage";
import type { Booking } from "@/types/booking";
import { PAGE_SIZE, type SheetImportRow } from "./dashboard-constants";

export function useDashboardState() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  // 검색 + 필터
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // 퀵 액션 로딩 상태
  const [quickLoading, setQuickLoading] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState<{ bookingId: string; newStatus: string; label: string } | null>(null);

  // 벌크 선택
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirmPending, setBulkConfirmPending] = useState(false);

  // 토스트 메시지
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 경쟁 조건 방지: 탭 전환 시 이전 요청 취소
  const abortRef = useRef<AbortController | null>(null);
  // 클라이언트 캐시: 동일 파라미터 요청 5초 이내 재사용
  type CacheEntry = { bookings: Booking[]; counts: Record<string, number>; total: number; ts: number };
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const CACHE_TTL = 5_000;

  // 알림 배지
  const [unreadCount, setUnreadCount] = useState(0);

  // 자동 새로고침 (30초 간격) — sessionStorage로 페이지 이동 후에도 유지
  const [autoRefresh, setAutoRefresh] = useState(() =>
    safeSessionGet("admin_auto_refresh") === "1"
  );

  // 시트 임포트 모달
  const [showSheetImport, setShowSheetImport] = useState(false);
  const [sheetURL, setSheetURL] = useState("");
  const [sheetStep, setSheetStep] = useState<"input" | "preview" | "done">("input");
  const [sheetRows, setSheetRows] = useState<SheetImportRow[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetResult, setSheetResult] = useState<{ succeeded: number; failed: number; skipped: number } | null>(null);

  const showToast = useCallback((msg: string, isError = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, isError });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const t = safeLocalGet("admin_token");
    if (!t) {
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  // 알림 배지 카운트 — SSE 실시간 스트리밍 (30초 폴링 대체)
  useEffect(() => {
    if (!token) return;
    let es: EventSource;
    function connect() {
      es = new EventSource(`/api/admin/notifications/stream?token=${encodeURIComponent(token)}`);
      es.onmessage = (e) => {
        try { setUnreadCount(JSON.parse(e.data).unreadCount ?? 0); } catch { /* ignore */ }
      };
      // 서버가 55초 후 연결 종료 → 브라우저가 자동 재연결
      es.onerror = () => es.close();
    }
    connect();
    return () => es?.close();
  }, [token]);

  // 검색어 디바운스 (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(currentPage));
      params.set("limit", String(PAGE_SIZE));

      const cacheKey = params.toString();
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setBookings(cached.bookings);
        setCounts(cached.counts);
        setTotal(cached.total);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });

      if (signal.aborted) return;

      if (res.status === 401) {
        safeLocalRemove("admin_token");
        router.push("/admin");
        return;
      }

      if (!res.ok) {
        setBookings([]);
        setTotal(0);
        return;
      }

      const data = await res.json();
      if (signal.aborted) return;

      const newBookings = data.bookings || [];
      const newCounts = data.counts || {};
      const newTotal = data.total ?? 0;
      setBookings(newBookings);
      if (data.counts) setCounts(newCounts);
      setTotal(newTotal);
      const now = Date.now();
      cacheRef.current.forEach((v, k) => { if (now - v.ts >= CACHE_TTL) cacheRef.current.delete(k); });
      cacheRef.current.set(cacheKey, { bookings: newBookings, counts: newCounts, total: newTotal, ts: now });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setBookings([]);
      setTotal(0);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token, activeTab, currentPage, debouncedSearch, dateFrom, dateTo, router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // 예약 목록 자동 새로고침 (30초 간격, 토글 시 활성)
  useEffect(() => {
    if (!autoRefresh || !token) return;
    const interval = setInterval(fetchBookings, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, token, fetchBookings]);

  // 탭 변경 -> 첫 페이지로 + 선택 초기화
  function handleTabChange(tabKey: string) {
    setActiveTab(tabKey);
    setCurrentPage(1);
    setSelectedBookings(new Set());
  }

  // 날짜 필터 변경 -> 첫 페이지로
  function handleDateChange(field: "from" | "to", val: string) {
    if (field === "from") setDateFrom(val);
    else setDateTo(val);
    setCurrentPage(1);
  }

  function requestQuickAction(booking: Booking, newStatus: string, label: string) {
    setConfirmPending({ bookingId: booking.id, newStatus, label });
  }

  async function executeQuickAction(booking: Booking) {
    if (!confirmPending) return;
    const { newStatus } = confirmPending;
    setConfirmPending(null);
    setQuickLoading(booking.id);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus, expectedUpdatedAt: booking.updatedAt }),
      });
      if (res.ok) {
        fetchBookings();
      } else {
        const data = await res.json();
        showToast(data.error || "변경 실패", true);
      }
    } catch {
      showToast("네트워크 오류", true);
    } finally {
      setQuickLoading(null);
    }
  }

  function toggleBooking(id: string) {
    setSelectedBookings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedBookings.size === bookings.length && bookings.length > 0) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(bookings.map((b) => b.id)));
    }
  }

  async function executeBulkStatusChange() {
    if (!bulkStatus || selectedBookings.size === 0) return;
    setBulkConfirmPending(false);
    setBulkLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const bookingId of selectedBookings) {
      try {
        const bk = bookings.find((b) => b.id === bookingId);
        const res = await fetch(`/api/admin/bookings/${bookingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: bulkStatus, expectedUpdatedAt: bk?.updatedAt }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setBulkLoading(false);
    setSelectedBookings(new Set());
    setBulkStatus("");
    fetchBookings();

    if (failCount > 0) {
      showToast(`${successCount}건 성공, ${failCount}건 실패`, true);
    }
  }

  async function handleSheetPreview() {
    if (!sheetURL.trim()) return;
    setSheetLoading(true);
    try {
      const res = await fetch("/api/admin/bookings/sheet-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: sheetURL, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "미리보기 실패", true); return; }
      setSheetRows(data.rows);
      setSheetStep("preview");
    } catch {
      showToast("네트워크 오류", true);
    } finally {
      setSheetLoading(false);
    }
  }

  async function handleSheetImport() {
    setSheetLoading(true);
    try {
      const res = await fetch("/api/admin/bookings/sheet-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: sheetURL, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "임포트 실패", true); return; }
      setSheetResult({ succeeded: data.succeeded, failed: data.failed, skipped: data.skipped });
      setSheetStep("done");
      fetchBookings();
    } catch {
      showToast("네트워크 오류", true);
    } finally {
      setSheetLoading(false);
    }
  }

  function closeSheetImport() {
    setShowSheetImport(false);
    setSheetURL("");
    setSheetStep("input");
    setSheetRows([]);
    setSheetResult(null);
  }

  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentTabTotal = activeTab === "all" ? totalCount : (counts[activeTab] || 0);

  return {
    router,
    // 데이터
    bookings,
    counts,
    total,
    totalCount,
    totalPages,
    currentTabTotal,
    // 탭 & 페이지
    activeTab,
    currentPage,
    setCurrentPage,
    handleTabChange,
    // 로딩
    loading,
    token,
    // 검색 & 필터
    search,
    setSearch,
    debouncedSearch,
    dateFrom,
    dateTo,
    showFilters,
    setShowFilters,
    handleDateChange,
    // 퀵 액션
    quickLoading,
    confirmPending,
    setConfirmPending,
    requestQuickAction,
    executeQuickAction,
    // 벌크
    selectedBookings,
    setSelectedBookings,
    bulkStatus,
    setBulkStatus,
    bulkLoading,
    bulkConfirmPending,
    setBulkConfirmPending,
    executeBulkStatusChange,
    toggleBooking,
    toggleAll,
    // 토스트
    toast,
    showToast,
    // 알림
    unreadCount,
    // 자동 새로고침
    autoRefresh,
    setAutoRefresh,
    // fetch
    fetchBookings,
    // 시트 임포트
    showSheetImport,
    setShowSheetImport,
    sheetURL,
    setSheetURL,
    sheetStep,
    setSheetStep,
    sheetRows,
    sheetLoading,
    sheetResult,
    handleSheetPreview,
    handleSheetImport,
    closeSheetImport,
  };
}

export type DashboardState = ReturnType<typeof useDashboardState>;
