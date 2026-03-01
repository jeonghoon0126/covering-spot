"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { safeSessionGet, safeSessionSet, safeSessionRemove } from "@/lib/storage";
import type { Booking, UnloadingPoint } from "@/types/booking";
import {
  type Driver,
  type DriverStats,
  getDriverColor,
  getToday,
} from "./dispatch-utils";

/* ── API 데이터 페칭 전용 훅 ── */

export interface UseDispatchDataReturn {
  token: string;
  loading: boolean;
  fetchError: boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  drivers: Driver[];
  driverStats: DriverStats[];
  setDriverStats: React.Dispatch<React.SetStateAction<DriverStats[]>>;
  driverColorMap: Map<string, string>;
  unloadingPoints: UnloadingPoint[];
  setUnloadingPoints: React.Dispatch<React.SetStateAction<UnloadingPoint[]>>;
  fetchData: (opts?: { silent?: boolean }) => Promise<void>;
  fetchUnloadingPoints: () => Promise<void>;
}

interface UseDispatchDataOptions {
  /** non-silent fetchData 완료 시 호출 — 선택 상태 초기화용 */
  onNonSilentReset?: () => void;
}

export function useDispatchData(options?: UseDispatchDataOptions): UseDispatchDataReturn {
  const { onNonSilentReset } = options ?? {};
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  // 콜백 ref: fetchData deps에 함수 참조를 포함시키지 않아 무한 루프 방지
  const onNonSilentResetRef = useRef(onNonSilentReset);
  onNonSilentResetRef.current = onNonSilentReset;

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedDate, setSelectedDateRaw] = useState<string>(
    () => safeSessionGet("dispatch_last_date") || getToday()
  );
  const setSelectedDate = useCallback((date: string) => {
    safeSessionSet("dispatch_last_date", date);
    setSelectedDateRaw(date);
  }, []);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverStats, setDriverStats] = useState<DriverStats[]>([]);
  const [unloadingPoints, setUnloadingPoints] = useState<UnloadingPoint[]>([]);

  // 기사별 색상 매핑
  const driverColorMap = useMemo(() => {
    const map = new Map<string, string>();
    drivers.forEach((d, idx) => {
      map.set(d.id, getDriverColor(idx));
    });
    return map;
  }, [drivers]);

  // 인증
  useEffect(() => {
    const t = safeSessionGet("admin_token");
    if (!t) {
      safeSessionSet("admin_return_url", window.location.pathname);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  // 데이터 로드 (AbortController로 race condition 방어)
  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    const silent = opts?.silent ?? false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) {
      setLoading(true);
      setFetchError(false);
    }
    try {
      const res = await fetch(`/api/admin/dispatch?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.status === 401) {
        safeSessionRemove("admin_token");
        router.push("/admin");
        return;
      }
      if (!res.ok) {
        if (!silent) setFetchError(true);
        return;
      }
      const data = await res.json();
      if (controller.signal.aborted) return;
      setBookings(data.bookings || []);
      setDrivers(data.drivers || []);
      setDriverStats(data.driverStats || []);
      if (!silent) {
        onNonSilentResetRef.current?.();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError" && !silent) {
        setFetchError(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, selectedDate, router]);

  // 초기 로드 + 날짜 변경 시 재로드
  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // 하차지 조회
  const fetchUnloadingPoints = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/unloading-points", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnloadingPoints(data.points || []);
      } else {
        console.warn("[unloading-points] 조회 실패:", res.status);
      }
    } catch (e) {
      console.warn("[unloading-points] 네트워크 오류:", e);
    }
  }, [token]);

  // 하차지 초기 로드
  useEffect(() => {
    fetchUnloadingPoints();
  }, [fetchUnloadingPoints]);

  return {
    token,
    loading,
    fetchError,
    selectedDate,
    setSelectedDate,
    bookings,
    setBookings,
    drivers,
    driverStats,
    setDriverStats,
    driverColorMap,
    unloadingPoints,
    setUnloadingPoints,
    fetchData,
    fetchUnloadingPoints,
  };
}
