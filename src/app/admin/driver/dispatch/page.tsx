"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { safeSessionSet, safeLocalGet, safeLocalRemove } from "@/lib/storage";
import type { Booking } from "@/types/booking";

import type { Driver, Vehicle, Assignment, BlockedSlot } from "../types";
import { getToday, nextHour } from "../constants";

import { DriverHeader } from "../DriverHeader";
import DispatchTab from "../DispatchTab";

/* ── 배차 현황 페이지 ── */

export default function AdminDispatchPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);

  // 기사-차량 배정 상태
  const [assignDate, setAssignDate] = useState(getToday());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [assignError, setAssignError] = useState("");

  // 슬롯 차단 관리 상태
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("all");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotActionLoading, setSlotActionLoading] = useState<string | null>(null);
  const [slotBookings, setSlotBookings] = useState<{ id: string; confirmedTime: string | null; timeSlot: string }[]>([]);

  // 기사별 배차 Gantt 상태
  const [ganttBookings, setGanttBookings] = useState<Booking[]>([]);
  const [ganttLoading, setGanttLoading] = useState(false);

  // 토스트
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  /* ── 인증 ── */

  useEffect(() => {
    const t = safeLocalGet("admin_token");
    if (!t) {
      safeSessionSet("admin_return_url", window.location.pathname);
      router.push("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  /* ── 기사 fetch ── */

  const fetchDrivers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/drivers?active=false", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        safeLocalRemove("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setAllDrivers(data.drivers || []);
    } catch {
      // ignore
    }
  }, [token, router]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  /* ── 기사-차량 배정 ── */

  const fetchAssignmentsAndVehicles = useCallback(async () => {
    if (!token) return;
    setAssignLoading(true);
    try {
      const [aRes, vRes] = await Promise.all([
        fetch(`/api/admin/assignments?date=${assignDate}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/vehicles", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [aData, vData] = await Promise.all([aRes.json(), vRes.json()]);
      setAssignments(aData.assignments || []);
      setVehicles(vData.vehicles || []);
    } catch {
      // ignore
    } finally {
      setAssignLoading(false);
    }
  }, [token, assignDate]);

  useEffect(() => {
    fetchAssignmentsAndVehicles();
  }, [fetchAssignmentsAndVehicles]);

  async function handleCreateAssignment(driverId: string, vehicleId: string) {
    if (!token || !vehicleId) return;
    setAssignError("");
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driverId, vehicleId, date: assignDate }),
      });
      const data = await res.json();
      if (!res.ok) { setAssignError(data.error || "배정 실패"); return; }
      setAssignments((prev) => [...prev, data.assignment]);
      setAssigningDriverId(null);
      setSelectedVehicleId("");
    } catch {
      setAssignError("네트워크 오류");
    }
  }

  async function handleDeleteAssignment(id: string) {
    if (!token) return;
    const res = await fetch(`/api/admin/assignments?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    }
  }

  /* ── 슬롯 차단 관리 ── */

  const fetchBlockedSlots = useCallback(async () => {
    if (!token) return;
    setSlotsLoading(true);
    try {
      const driverParam = selectedDriverId !== "all" ? `&driverId=${selectedDriverId}` : "";
      const res = await fetch(`/api/admin/blocked-slots?date=${assignDate}${driverParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        safeLocalRemove("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setBlockedSlots(data.slots || []);
    } catch {
      // ignore
    } finally {
      setSlotsLoading(false);
    }
  }, [token, assignDate, selectedDriverId, router]);

  const fetchSlotBookings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/bookings?dateFrom=${assignDate}&dateTo=${assignDate}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSlotBookings(
          (data.bookings || []).filter(
            (b: { date: string; status: string }) =>
              b.date === assignDate &&
              b.status !== "cancelled" &&
              b.status !== "rejected",
          ),
        );
      }
    } catch {
      // ignore
    }
  }, [token, assignDate]);

  useEffect(() => {
    fetchBlockedSlots();
    fetchSlotBookings();
  }, [fetchBlockedSlots, fetchSlotBookings]);

  /* ── Gantt 배차 현황 fetch ── */

  const fetchGanttBookings = useCallback(async () => {
    if (!token) return;
    setGanttLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings?dateFrom=${assignDate}&dateTo=${assignDate}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGanttBookings(
          (data.bookings || []).filter(
            (b: { date: string; status: string }) =>
              b.date === assignDate &&
              b.status !== "cancelled" &&
              b.status !== "rejected",
          ),
        );
      }
    } catch {
      // ignore
    } finally {
      setGanttLoading(false);
    }
  }, [token, assignDate]);

  useEffect(() => {
    fetchGanttBookings();
  }, [fetchGanttBookings]);

  async function handleBlockSlot(timeStart: string) {
    const timeEnd = nextHour(timeStart);
    const driverId = selectedDriverId !== "all" ? selectedDriverId : undefined;
    setSlotActionLoading(timeStart);
    try {
      const res = await fetch("/api/admin/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: assignDate, timeStart, timeEnd, reason: "관리자 수동 차단", driverId: driverId || null }),
      });
      if (res.ok) {
        fetchBlockedSlots();
      } else {
        const data = await res.json();
        showToast(data.error || "차단 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setSlotActionLoading(null);
    }
  }

  async function handleUnblockSlot(slotId: string, timeStart: string) {
    setSlotActionLoading(timeStart);
    try {
      const res = await fetch(`/api/admin/blocked-slots?id=${slotId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchBlockedSlots();
      } else {
        const data = await res.json();
        showToast(data.error || "해제 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setSlotActionLoading(null);
    }
  }

  // Gantt용 기사 목록: assignments의 실제 배정 차량을 드라이버 프로필에 merge
  const ganttDrivers = useMemo(() => {
    return allDrivers.filter((d) => d.active).map((d) => {
      const assignment = assignments.find((a) => a.driverId === d.id);
      if (!assignment?.vehicle) return d;
      return {
        ...d,
        vehicleType: assignment.vehicle.type,
        vehicleCapacity: assignment.vehicle.capacity,
        licensePlate: assignment.vehicle.licensePlate ?? d.licensePlate,
      };
    });
  }, [allDrivers, assignments]);

  /* ── 렌더 ── */

  return (
    <>
      <div className="min-h-screen bg-bg-warm">
        <DriverHeader />

        <DispatchTab
          assignDate={assignDate}
          setAssignDate={setAssignDate}
          allDrivers={allDrivers}
          assignments={assignments}
          vehicles={vehicles}
          assignLoading={assignLoading}
          assigningDriverId={assigningDriverId}
          setAssigningDriverId={setAssigningDriverId}
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
          assignError={assignError}
          setAssignError={setAssignError}
          onCreateAssignment={handleCreateAssignment}
          onDeleteAssignment={handleDeleteAssignment}
          ganttDrivers={ganttDrivers}
          ganttBookings={ganttBookings}
          ganttLoading={ganttLoading}
          token={token}
          onGanttRefresh={fetchGanttBookings}
          blockedSlots={blockedSlots}
          selectedDriverId={selectedDriverId}
          setSelectedDriverId={setSelectedDriverId}
          slotsLoading={slotsLoading}
          slotActionLoading={slotActionLoading}
          slotBookings={slotBookings}
          onBlockSlot={handleBlockSlot}
          onUnblockSlot={handleUnblockSlot}
        />
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-text-primary text-bg text-sm font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </>
  );
}
