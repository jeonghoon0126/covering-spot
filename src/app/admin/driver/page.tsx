"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/* ── 타입 ── */

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
  vehicleType: string;
  vehicleCapacity: number;
  licensePlate: string | null;
  workDays: string;
  workSlots: string;
}

/* ── 상수 ── */

const VEHICLE_TYPES = ["1톤", "1.4톤", "2.5톤", "5톤"] as const;
const VEHICLE_CAPACITY: Record<string, number> = {
  "1톤": 4.8, "1.4톤": 6.5, "2.5톤": 10.5, "5톤": 20.0,
};
const ALL_WORK_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/* ── 근무요일 토글 컴포넌트 ── */

function WorkDayToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = new Set(value ? value.split(",") : []);
  function toggle(day: string) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(ALL_WORK_DAYS.filter((d) => next.has(d)).join(","));
  }
  return (
    <div className="flex gap-1">
      {ALL_WORK_DAYS.map((day) => {
        const active = selected.has(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`flex-1 h-8 text-xs font-semibold rounded-sm border transition-colors ${
              active
                ? "bg-primary text-white border-primary"
                : "bg-bg-warm text-text-muted border-border-light"
            } ${day === "토" || day === "일" ? (active ? "bg-primary/80" : "text-text-muted/60") : ""}`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

/* ── 가능 슬롯 토글 컴포넌트 ── */

const SLOT_ORDER = ["오전 (9시~12시)", "오후 (13시~17시)", "저녁 (18시~20시)"] as const;
const SLOT_LABELS: Record<string, string> = {
  "오전 (9시~12시)": "오전",
  "오후 (13시~17시)": "오후",
  "저녁 (18시~20시)": "저녁",
};

function WorkSlotToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // 빈 문자열 = 모든 슬롯 가능 (ALL)
  const selected = new Set(value ? value.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const isAll = selected.size === 0;

  function toggle(slot: string) {
    const next = new Set(selected);
    if (next.has(slot)) {
      next.delete(slot);
    } else {
      next.add(slot);
    }
    // 모두 선택되거나 모두 해제 → 빈 문자열(전체)로 정규화
    if (next.size === 0 || next.size === SLOT_ORDER.length) {
      onChange("");
    } else {
      onChange(SLOT_ORDER.filter((s) => next.has(s)).join(","));
    }
  }

  function setAll() {
    onChange("");
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={setAll}
        className={`px-2 h-8 text-xs font-semibold rounded-sm border transition-colors ${
          isAll
            ? "bg-primary text-white border-primary"
            : "bg-bg-warm text-text-muted border-border-light"
        }`}
      >
        전체
      </button>
      {SLOT_ORDER.map((slot) => {
        const active = !isAll && selected.has(slot);
        return (
          <button
            key={slot}
            type="button"
            onClick={() => toggle(slot)}
            className={`flex-1 h-8 text-xs font-semibold rounded-sm border transition-colors ${
              active
                ? "bg-primary text-white border-primary"
                : "bg-bg-warm text-text-muted border-border-light"
            }`}
          >
            {SLOT_LABELS[slot]}
          </button>
        );
      })}
    </div>
  );
}

/* ── 가능 슬롯 읽기 전용 칩 ── */

function WorkSlotChips({ value }: { value: string }) {
  if (!value) {
    return (
      <div className="flex gap-1 mt-1">
        <span className="text-[11px] px-2 py-0.5 rounded-sm border bg-primary/10 text-primary border-primary/30 font-medium">
          전체 슬롯
        </span>
      </div>
    );
  }
  const selected = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
  return (
    <div className="flex gap-1 mt-1">
      {SLOT_ORDER.filter((s) => selected.has(s)).map((slot) => (
        <span
          key={slot}
          className="text-[11px] px-2 py-0.5 rounded-sm border bg-primary/10 text-primary border-primary/30 font-medium"
        >
          {SLOT_LABELS[slot]}
        </span>
      ))}
    </div>
  );
}

/* ── 근무요일 읽기 전용 칩 ── */

function WorkDayChips({ value }: { value: string }) {
  const selected = new Set(value ? value.split(",") : []);
  return (
    <div className="flex gap-1 mt-2">
      {ALL_WORK_DAYS.map((day) => {
        const active = selected.has(day);
        return (
          <span
            key={day}
            className={`flex-1 h-7 flex items-center justify-center text-[11px] font-semibold rounded-sm border ${
              active
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-bg-warm text-text-muted/50 border-border-light/50"
            }`}
          >
            {day}
          </span>
        );
      })}
    </div>
  );
}

/* ── 탭 타입 ── */

type FilterTab = "all" | "active" | "inactive";

/* ── 메인 ── */

export default function AdminDriverManagePage() {
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

  // 기사 수정 폼 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("1톤");
  const [editLicensePlate, setEditLicensePlate] = useState("");
  const [editWorkDays, setEditWorkDays] = useState("월,화,수,목,금,토");
  const [editWorkSlots, setEditWorkSlots] = useState("");

  const [saving, setSaving] = useState(false);

  // 토스트
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  /* ── 인증 ── */

  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) {
      sessionStorage.setItem("admin_return_url", window.location.pathname);
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
        sessionStorage.removeItem("admin_token");
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
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewPhone("");
        setNewVehicleType("1톤");
        setNewLicensePlate("");
        setNewWorkDays("월,화,수,목,금,토");
        setNewWorkSlots("");
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

  /* ── 필터 ── */

  const activeCount = allDrivers.filter((d) => d.active).length;
  const inactiveCount = allDrivers.filter((d) => !d.active).length;

  const filteredDrivers =
    filterTab === "active"
      ? allDrivers.filter((d) => d.active)
      : filterTab === "inactive"
      ? allDrivers.filter((d) => !d.active)
      : allDrivers;

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "전체", count: allDrivers.length },
    { key: "active", label: "활성", count: activeCount },
    { key: "inactive", label: "비활성", count: inactiveCount },
  ];

  /* ── 렌더 ── */

  return (
    <>
      <div className="min-h-screen bg-bg-warm">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
          <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold">기사 관리</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => router.push("/admin/calendar")}
                className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
              >
                캘린더
              </button>
              <button
                onClick={() => router.push("/admin/dispatch")}
                className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
              >
                배차
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[42rem] mx-auto px-4 py-4">
          {/* 탭 필터 + 추가 버튼 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1.5">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    filterTab === tab.key
                      ? "bg-primary text-white shadow-[0_2px_8px_rgba(26,163,255,0.3)]"
                      : "bg-bg text-text-sub border border-border-light"
                  }`}
                >
                  {tab.label}{" "}
                  <span className={filterTab === tab.key ? "text-white/70" : "text-text-muted"}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (!showAddForm) {
                  // 폼을 열 때 이전 입력값 초기화
                  setNewName("");
                  setNewPhone("");
                  setNewVehicleType("1톤");
                  setNewLicensePlate("");
                  setNewWorkDays("월,화,수,목,금,토");
                  setNewWorkSlots("");
                }
                setShowAddForm(!showAddForm);
                setEditingId(null);
              }}
              className="text-xs font-semibold text-white bg-primary rounded-md px-3 py-1.5 hover:bg-primary-dark active:scale-[0.97] transition-all"
            >
              {showAddForm ? "취소" : "+ 기사 추가"}
            </button>
          </div>

          {/* 기사 추가 인라인 폼 */}
          {showAddForm && (
            <div className="bg-bg rounded-lg border border-primary/30 p-4 mb-4 space-y-3">
              <p className="text-xs font-bold text-text-primary">새 기사 추가</p>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">이름 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="기사님 이름"
                  className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">연락처</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-text-muted font-medium mb-1">차량종류</label>
                  <select
                    value={newVehicleType}
                    onChange={(e) => setNewVehicleType(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  >
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v} value={v}>{v} ({VEHICLE_CAPACITY[v]}m³)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-text-muted font-medium mb-1">차량번호</label>
                  <input
                    type="text"
                    value={newLicensePlate}
                    onChange={(e) => setNewLicensePlate(e.target.value)}
                    placeholder="서울12가3456"
                    className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">근무요일</label>
                <WorkDayToggle value={newWorkDays} onChange={setNewWorkDays} />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted font-medium mb-1">가능 슬롯 <span className="text-text-muted/60 font-normal">(전체 = 제한 없음)</span></label>
                <WorkSlotToggle value={newWorkSlots} onChange={setNewWorkSlots} />
              </div>
              <button
                onClick={handleCreateDriver}
                disabled={saving || !newName.trim()}
                className="w-full h-10 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? "추가 중..." : "추가"}
              </button>
            </div>
          )}

          {/* 기사 목록 */}
          {loading ? (
            <div className="text-center py-12 text-text-muted text-sm">불러오는 중...</div>
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">
              {filterTab === "active" ? "활성 기사가 없습니다" : filterTab === "inactive" ? "비활성 기사가 없습니다" : "등록된 기사가 없습니다"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDrivers.map((driver) => {
                const isEditing = editingId === driver.id;

                return (
                  <div
                    key={driver.id}
                    className={`bg-bg rounded-lg border p-4 transition-all ${
                      driver.active ? "border-border-light" : "border-border-light/50 opacity-60"
                    }`}
                  >
                    {isEditing ? (
                      /* 인라인 수정 모드 */
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-text-muted mb-2">수정 중</p>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="이름"
                          className="w-full h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                        />
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="연락처"
                          className="w-full h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editVehicleType}
                            onChange={(e) => setEditVehicleType(e.target.value)}
                            className="h-9 px-2 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                          >
                            {VEHICLE_TYPES.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editLicensePlate}
                            onChange={(e) => setEditLicensePlate(e.target.value)}
                            placeholder="차량번호"
                            className="h-9 px-2 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-text-muted font-medium mb-1">근무요일</label>
                          <WorkDayToggle value={editWorkDays} onChange={setEditWorkDays} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-text-muted font-medium mb-1">가능 슬롯 <span className="text-text-muted/60 font-normal">(전체 = 제한 없음)</span></label>
                          <WorkSlotToggle value={editWorkSlots} onChange={setEditWorkSlots} />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleUpdateDriver(driver.id)}
                            disabled={saving}
                            className="flex-1 h-9 rounded-sm bg-primary text-white text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            {saving ? "..." : "저장"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 h-9 rounded-sm bg-bg-warm text-text-sub text-xs font-medium border border-border-light active:scale-[0.98] transition-all"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 보기 모드 */
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                driver.active ? "bg-semantic-green" : "bg-text-muted"
                              }`} />
                              <span className="text-sm font-semibold text-text-primary">
                                {driver.name}
                              </span>
                              <span className="text-xs text-primary font-medium">
                                {driver.vehicleType || "1톤"}
                              </span>
                              {driver.licensePlate && (
                                <span className="text-xs text-text-muted">
                                  {driver.licensePlate}
                                </span>
                              )}
                              {!driver.active && (
                                <span className="text-[10px] font-medium text-text-muted bg-fill-tint px-1.5 py-0.5 rounded">
                                  비활성
                                </span>
                              )}
                            </div>
                            {driver.phone && (
                              <p className="text-xs text-text-muted mt-1 ml-4">{driver.phone}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingId(driver.id);
                                setEditName(driver.name);
                                setEditPhone(driver.phone || "");
                                setEditVehicleType(driver.vehicleType || "1톤");
                                setEditLicensePlate(driver.licensePlate || "");
                                setEditWorkDays(driver.workDays || "월,화,수,목,금,토");
                                setEditWorkSlots(driver.workSlots || "");
                                setShowAddForm(false);
                              }}
                              className="text-[11px] font-medium text-text-sub hover:text-text-primary px-2 py-1.5 rounded-sm hover:bg-bg-warm transition-colors"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleToggleActive(driver)}
                              className={`text-[11px] font-medium px-2 py-1.5 rounded-sm transition-colors ${
                                driver.active
                                  ? "text-semantic-red hover:bg-red-50"
                                  : "text-semantic-green hover:bg-green-50"
                              }`}
                            >
                              {driver.active ? "비활성화" : "활성화"}
                            </button>
                          </div>
                        </div>
                        {/* 근무요일 칩 */}
                        <WorkDayChips value={driver.workDays || ""} />
                        {/* 가능 슬롯 칩 */}
                        <WorkSlotChips value={driver.workSlots || ""} />
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
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-text-primary text-bg text-sm font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </>
  );
}
