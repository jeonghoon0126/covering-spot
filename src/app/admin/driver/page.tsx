"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { safeSessionGet, safeSessionSet, safeSessionRemove } from "@/lib/storage";
import { VEHICLE_CAPACITY } from "@/lib/constants";

import type { Driver, FilterTab } from "./types";

import { DriverHeader } from "./DriverHeader";
import DriverListTab from "./DriverListTab";
import AddressPostcodeModal from "./AddressPostcodeModal";

/* ── 기사 목록 페이지 ── */

export default function AdminDriverListPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

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

  // 월간 통계
  const [statsData, setStatsData] = useState<{ driverId: string; driverName: string; vehicleType: string; active: boolean; bookingCount: number; totalLoadingCube: number; avgLoadingCube: number }[]>([]);
  const [statsMonth, setStatsMonth] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 7));
  const [statsLoading, setStatsLoading] = useState(false);

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

  // 월간 통계: filterTab === "stats"이고 token 있을 때만 fetch
  useEffect(() => {
    if (filterTab !== "stats" || !token || !statsMonth) return;
    setStatsLoading(true);
    fetch(`/api/admin/drivers/stats?month=${statsMonth}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setStatsData(data.stats || []))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [filterTab, token, statsMonth]);

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

  /* ── 렌더 ── */

  return (
    <>
      <div className="min-h-screen bg-bg-warm">
        <DriverHeader />

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
          statsData={statsData}
          statsMonth={statsMonth}
          setStatsMonth={setStatsMonth}
          statsLoading={statsLoading}
        />
      </div>

      <AddressPostcodeModal
        show={showNewStartPostcode}
        onClose={() => setShowNewStartPostcode(false)}
        onComplete={(addr) => { setNewStartAddress(addr); setShowNewStartPostcode(false); }}
      />
      <AddressPostcodeModal
        show={showNewEndPostcode}
        onClose={() => setShowNewEndPostcode(false)}
        onComplete={(addr) => { setNewEndAddress(addr); setShowNewEndPostcode(false); }}
      />
      <AddressPostcodeModal
        show={showEditStartPostcode}
        onClose={() => setShowEditStartPostcode(false)}
        onComplete={(addr) => { setEditStartAddress(addr); setShowEditStartPostcode(false); }}
      />
      <AddressPostcodeModal
        show={showEditEndPostcode}
        onClose={() => setShowEditEndPostcode(false)}
        onComplete={(addr) => { setEditEndAddress(addr); setShowEditEndPostcode(false); }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-text-primary text-bg text-sm font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </>
  );
}
