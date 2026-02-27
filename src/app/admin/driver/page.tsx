"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { safeSessionGet, safeSessionSet, safeSessionRemove } from "@/lib/storage";
import { VEHICLE_CAPACITY } from "@/lib/constants";
import type { Booking } from "@/types/booking";

import type { Driver, Vehicle, Assignment, BlockedSlot, FilterTab } from "./types";
import { getToday, nextHour } from "./constants";

import { AdminLogo } from "@/components/ui/AdminLogo";
import DriverListTab from "./DriverListTab";
import DispatchTab from "./DispatchTab";
import AddressPostcodeModal from "./AddressPostcodeModal";

/* ── 메인 ── */

export default function AdminDriverManagePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [activeTab, setActiveTab] = useState<"drivers" | "dispatch">("drivers");

  // 기사 추가 폼 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newVehicleType, setNewVehicleType] = useState("1톤");
  const [newLicensePlate, setNewLicensePlate] = useState("");
  const [newWorkDays, setNewWorkDays] = useState("월,화,수,목,금,토");
  const [newWorkSlots, setNewWorkSlots] = useState("");
  const [newInitialLoadCube, setNewInitialLoadCube] = useState(0);
  const [newStartAddress, setNewStartAddress] = useState("");
  const [newEndAddress, setNewEndAddress] = useState("");
  const [showNewStartPostcode, setShowNewStartPostcode] = useState(false);
  const [showNewEndPostcode, setShowNewEndPostcode] = useState(false);

  // 기사 수정 폼 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("1톤");
  const [editLicensePlate, setEditLicensePlate] = useState("");
  const [editWorkDays, setEditWorkDays] = useState("월,화,수,목,금,토");
  const [editWorkSlots, setEditWorkSlots] = useState("");
  const [editInitialLoadCube, setEditInitialLoadCube] = useState(0);
  const [editStartAddress, setEditStartAddress] = useState("");
  const [editEndAddress, setEditEndAddress] = useState("");
  const [showEditStartPostcode, setShowEditStartPostcode] = useState(false);
  const [showEditEndPostcode, setShowEditEndPostcode] = useState(false);

  const [saving, setSaving] = useState(false);

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

  /* ── toast timer cleanup ── */
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

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

  /* ── 기사 fetch ── */

  const fetchDrivers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/drivers?active=false", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        safeSessionRemove("admin_token");
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setAllDrivers(data.drivers || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  /* ── 기사 추가 ── */

  async function handleCreateDriver() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.replace(/-/g, "").trim() || undefined,
          vehicleType: newVehicleType,
          vehicleCapacity: VEHICLE_CAPACITY[newVehicleType] || 4.8,
          licensePlate: newLicensePlate.trim() || undefined,
          workDays: newWorkDays,
          workSlots: newWorkSlots,
          initialLoadCube: newInitialLoadCube || undefined,
          startAddress: newStartAddress.trim() || undefined,
          endAddress: newEndAddress.trim() || undefined,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewPhone("");
        setNewVehicleType("1톤");
        setNewLicensePlate("");
        setNewWorkDays("월,화,수,목,금,토");
        setNewWorkSlots("");
        setNewInitialLoadCube(0);
        setNewStartAddress("");
        setNewEndAddress("");
        setShowAddForm(false);
        fetchDrivers();
      } else {
        const data = await res.json();
        showToast(data.error || "추가 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  /* ── 기사 수정 ── */

  async function handleUpdateDriver(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id,
          name: editName.trim() || undefined,
          phone: editPhone.replace(/-/g, "").trim() || undefined,
          vehicleType: editVehicleType,
          vehicleCapacity: VEHICLE_CAPACITY[editVehicleType] || 4.8,
          licensePlate: editLicensePlate.trim() || undefined,
          workDays: editWorkDays,
          workSlots: editWorkSlots,
          initialLoadCube: editInitialLoadCube,
          startAddress: editStartAddress.trim() || null,
          endAddress: editEndAddress.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchDrivers();
      } else {
        const data = await res.json();
        showToast(data.error || "수정 실패");
      }
    } catch {
      showToast("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

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
        safeSessionRemove("admin_token");
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
    if (activeTab === "dispatch") fetchGanttBookings();
  }, [activeTab, fetchGanttBookings]);

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

  /* ── 활성화 토글 ── */

  async function handleToggleActive(driver: Driver) {
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: driver.id, active: !driver.active }),
      });
      if (res.ok) {
        fetchDrivers();
      } else {
        const data = await res.json();
        showToast(data.error || "변경 실패");
      }
    } catch {
      showToast("네트워크 오류");
    }
  }

  /* ── 수정 시작 핸들러 ── */

  function handleStartEdit(driver: Driver) {
    setEditingId(driver.id);
    setEditName(driver.name);
    setEditPhone(driver.phone || "");
    setEditVehicleType(driver.vehicleType || "1톤");
    setEditLicensePlate(driver.licensePlate || "");
    setEditWorkDays(driver.workDays || "월,화,수,목,금,토");
    setEditWorkSlots(driver.workSlots || "");
    setEditInitialLoadCube(driver.initialLoadCube || 0);
    setEditStartAddress(driver.startAddress || "");
    setEditEndAddress(driver.endAddress || "");
    setShowAddForm(false);
  }

  /* ── 추가 폼 토글 핸들러 ── */

  function handleToggleAddForm() {
    if (!showAddForm) {
      setNewName("");
      setNewPhone("");
      setNewVehicleType("1톤");
      setNewLicensePlate("");
      setNewWorkDays("월,화,수,목,금,토");
      setNewWorkSlots("");
      setNewInitialLoadCube(0);
      setNewStartAddress("");
      setNewEndAddress("");
    }
    setShowAddForm(!showAddForm);
    setEditingId(null);
  }

  /* ── 필터 ── */

  const activeCount = allDrivers.filter((d) => d.active).length;
  const inactiveCount = allDrivers.filter((d) => !d.active).length;

  const filteredDrivers =
    filterTab === "active"
      ? allDrivers.filter((d) => d.active)
      : filterTab === "inactive"
      ? allDrivers.filter((d) => !d.active)
      : allDrivers;

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
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
          <div className="max-w-[56rem] mx-auto px-4 py-3 flex items-center justify-between">
            <AdminLogo />
            <h1 className="text-lg font-bold">기사 관리</h1>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-border-light overflow-hidden">
                <button
                  onClick={() => setActiveTab("drivers")}
                  className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "drivers" ? "bg-primary text-white" : "bg-bg text-text-sub hover:bg-bg-warm"
                  }`}
                >
                  기사 목록
                </button>
                <button
                  onClick={() => setActiveTab("dispatch")}
                  className={`px-4 py-1.5 text-xs font-semibold transition-colors border-l border-border-light ${
                    activeTab === "dispatch" ? "bg-primary text-white" : "bg-bg text-text-sub hover:bg-bg-warm"
                  }`}
                >
                  배차 현황
                </button>
              </div>
              <button
                onClick={() => router.push("/admin/vehicles")}
                className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
              >
                차량
              </button>
              <button
                onClick={() => router.push("/admin/calendar")}
                className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
              >
                캘린더
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab 1: 기사 목록 ── */}
        {activeTab === "drivers" && (
          <DriverListTab
            filterTab={filterTab}
            setFilterTab={setFilterTab}
            allDrivers={allDrivers}
            filteredDrivers={filteredDrivers}
            activeCount={activeCount}
            inactiveCount={inactiveCount}
            loading={loading}
            showAddForm={showAddForm}
            onToggleAddForm={handleToggleAddForm}
            addFormProps={{
              newName,
              setNewName,
              newPhone,
              setNewPhone,
              newVehicleType,
              setNewVehicleType,
              newLicensePlate,
              setNewLicensePlate,
              newWorkDays,
              setNewWorkDays,
              newWorkSlots,
              setNewWorkSlots,
              newInitialLoadCube,
              setNewInitialLoadCube,
              newStartAddress,
              setNewStartAddress,
              newEndAddress,
              setNewEndAddress,
              onShowStartPostcode: () => setShowNewStartPostcode(true),
              onShowEndPostcode: () => setShowNewEndPostcode(true),
              saving,
              onSubmit: handleCreateDriver,
            }}
            editingId={editingId}
            editName={editName}
            setEditName={setEditName}
            editPhone={editPhone}
            setEditPhone={setEditPhone}
            editVehicleType={editVehicleType}
            setEditVehicleType={setEditVehicleType}
            editLicensePlate={editLicensePlate}
            setEditLicensePlate={setEditLicensePlate}
            editWorkDays={editWorkDays}
            setEditWorkDays={setEditWorkDays}
            editWorkSlots={editWorkSlots}
            setEditWorkSlots={setEditWorkSlots}
            editInitialLoadCube={editInitialLoadCube}
            setEditInitialLoadCube={setEditInitialLoadCube}
            editStartAddress={editStartAddress}
            setEditStartAddress={setEditStartAddress}
            editEndAddress={editEndAddress}
            setEditEndAddress={setEditEndAddress}
            onShowEditStartPostcode={() => setShowEditStartPostcode(true)}
            onShowEditEndPostcode={() => setShowEditEndPostcode(true)}
            saving={saving}
            onSaveEdit={handleUpdateDriver}
            onCancelEdit={() => setEditingId(null)}
            onStartEdit={handleStartEdit}
            onToggleActive={handleToggleActive}
          />
        )}

        {/* ── Tab 2: 배차 현황 ── */}
        {activeTab === "dispatch" && (
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
        )}
      </div>

      {/* 주소 검색 팝업 - 추가 폼 출발지 */}
      <AddressPostcodeModal
        show={showNewStartPostcode}
        onClose={() => setShowNewStartPostcode(false)}
        onComplete={(addr) => {
          setNewStartAddress(addr);
          setShowNewStartPostcode(false);
        }}
      />

      {/* 주소 검색 팝업 - 추가 폼 퇴근지 */}
      <AddressPostcodeModal
        show={showNewEndPostcode}
        onClose={() => setShowNewEndPostcode(false)}
        onComplete={(addr) => {
          setNewEndAddress(addr);
          setShowNewEndPostcode(false);
        }}
      />

      {/* 주소 검색 팝업 - 수정 폼 출발지 */}
      <AddressPostcodeModal
        show={showEditStartPostcode}
        onClose={() => setShowEditStartPostcode(false)}
        onComplete={(addr) => {
          setEditStartAddress(addr);
          setShowEditStartPostcode(false);
        }}
      />

      {/* 주소 검색 팝업 - 수정 폼 퇴근지 */}
      <AddressPostcodeModal
        show={showEditEndPostcode}
        onClose={() => setShowEditEndPostcode(false)}
        onComplete={(addr) => {
          setEditEndAddress(addr);
          setShowEditEndPostcode(false);
        }}
      />

      {/* 에러 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-text-primary text-bg text-sm font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </>
  );
}
