"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/* ── 타입 ── */

interface Vehicle {
  id: string;
  name: string;
  type: string;
  capacity: number;
  licensePlate: string | null;
  active: boolean;
  createdAt: string;
}

interface UnavailablePeriod {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: string;
}

/* ── 상수 ── */

const VEHICLE_TYPES = ["1톤", "1.4톤", "2.5톤", "5톤"] as const;
const VEHICLE_CAPACITY: Record<string, number> = {
  "1톤": 4.8, "1.4톤": 6.5, "2.5톤": 10.5, "5톤": 20.0,
};

function getToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/* ── 메인 페이지 ── */

export default function VehiclesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [periods, setPeriods] = useState<UnavailablePeriod[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  // 차량 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("1톤");
  const [newCapacity, setNewCapacity] = useState<number>(4.8);
  const [newLicensePlate, setNewLicensePlate] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // 수정 폼
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editCapacity, setEditCapacity] = useState(0);
  const [editLicensePlate, setEditLicensePlate] = useState("");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // 이용불가 기간 추가
  const [unavailableVehicleId, setUnavailableVehicleId] = useState<string | null>(null);
  const [unavailableStart, setUnavailableStart] = useState(getToday());
  const [unavailableEnd, setUnavailableEnd] = useState(getToday());
  const [unavailableReason, setUnavailableReason] = useState("");
  const [unavailableError, setUnavailableError] = useState("");
  const [unavailableLoading, setUnavailableLoading] = useState(false);

  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    if (!t) { router.replace("/admin"); return; }
    setToken(t);
  }, [router]);

  const fetchAll = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const [vRes, pRes] = await Promise.all([
        fetch(`/api/admin/vehicles${showInactive ? "" : "?active=true"}`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
        fetch("/api/admin/vehicles/unavailable", {
          headers: { Authorization: `Bearer ${t}` },
        }),
      ]);
      if (!vRes.ok) { router.replace("/admin"); return; }
      const [vData, pData] = await Promise.all([vRes.json(), pRes.json()]);
      setVehicles(vData.vehicles || []);
      setPeriods(pData.periods || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router, showInactive]);

  useEffect(() => {
    if (token) fetchAll(token);
  }, [token, fetchAll]);

  function startEdit(v: Vehicle) {
    setEditingId(v.id);
    setEditName(v.name);
    setEditType(v.type);
    setEditCapacity(v.capacity);
    setEditLicensePlate(v.licensePlate || "");
    setEditError("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAddLoading(true); setAddError("");
    try {
      const res = await fetch("/api/admin/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), type: newType, capacity: newCapacity, licensePlate: newLicensePlate.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || "생성 실패"); return; }
      setVehicles((prev) => [...prev, data.vehicle]);
      setShowAddForm(false);
      setNewName(""); setNewType("1톤"); setNewCapacity(4.8); setNewLicensePlate("");
    } catch {
      setAddError("네트워크 오류");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editingId) return;
    setEditLoading(true); setEditError("");
    try {
      const res = await fetch("/api/admin/vehicles", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editingId, name: editName.trim(), type: editType, capacity: editCapacity, licensePlate: editLicensePlate.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || "수정 실패"); return; }
      setVehicles((prev) => prev.map((v) => v.id === editingId ? data.vehicle : v));
      setEditingId(null);
    } catch {
      setEditError("네트워크 오류");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleToggleActive(v: Vehicle) {
    if (!token) return;
    const res = await fetch("/api/admin/vehicles", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: v.id, active: !v.active }),
    });
    if (res.ok) {
      const data = await res.json();
      setVehicles((prev) => prev.map((x) => x.id === v.id ? data.vehicle : x));
    }
  }

  async function handleAddUnavailable(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !unavailableVehicleId) return;
    setUnavailableLoading(true); setUnavailableError("");
    try {
      const res = await fetch("/api/admin/vehicles/unavailable", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleId: unavailableVehicleId, startDate: unavailableStart, endDate: unavailableEnd, reason: unavailableReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setUnavailableError(data.error || "추가 실패"); return; }
      setPeriods((prev) => [...prev, data.period]);
      setUnavailableVehicleId(null);
      setUnavailableReason("");
    } catch {
      setUnavailableError("네트워크 오류");
    } finally {
      setUnavailableLoading(false);
    }
  }

  async function handleDeleteUnavailable(id: string) {
    if (!token) return;
    const res = await fetch(`/api/admin/vehicles/unavailable?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setPeriods((prev) => prev.filter((p) => p.id !== id));
    }
  }

  if (!token || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const today = getToday();

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/driver")}
              className="text-text-sub hover:text-text-primary transition-colors text-sm"
            >
              ← 기사 관리
            </button>
            <h1 className="text-xl font-bold text-text-primary">차량 관리</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-text-sub cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="accent-brand-400"
              />
              비활성 포함
            </label>
            <button
              onClick={() => { setShowAddForm(true); setAddError(""); }}
              className="px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              + 차량 추가
            </button>
          </div>
        </div>

        {/* 차량 추가 폼 */}
        {showAddForm && (
          <div className="border border-border-light rounded-xl p-5 bg-bg-warm space-y-4">
            <h2 className="font-semibold text-text-primary">새 차량 등록</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-sub mb-1">차량 이름 *</label>
                  <input
                    className="w-full border border-border-light rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-brand-400"
                    placeholder="예: 1톤 A"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-sub mb-1">차량 종류 *</label>
                  <select
                    className="w-full border border-border-light rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-brand-400"
                    value={newType}
                    onChange={(e) => {
                      setNewType(e.target.value);
                      setNewCapacity(VEHICLE_CAPACITY[e.target.value] ?? 4.8);
                    }}
                  >
                    {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-sub mb-1">적재량 (m³) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    className="w-full border border-border-light rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-brand-400"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(parseFloat(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-sub mb-1">차량번호</label>
                  <input
                    className="w-full border border-border-light rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-brand-400"
                    placeholder="예: 12가 3456"
                    value={newLicensePlate}
                    onChange={(e) => setNewLicensePlate(e.target.value)}
                  />
                </div>
              </div>
              {addError && <p className="text-red-500 text-xs">{addError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm text-text-sub border border-border-light rounded-lg hover:bg-bg-warm2 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 text-sm bg-brand-400 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {addLoading ? "추가 중..." : "추가"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 차량 목록 */}
        <div className="space-y-3">
          {vehicles.length === 0 && (
            <div className="text-center py-16 text-text-muted text-sm">
              등록된 차량이 없습니다
            </div>
          )}
          {vehicles.map((v) => {
            const vPeriods = periods.filter((p) => p.vehicleId === v.id);
            const isUnavailableNow = vPeriods.some((p) => p.startDate <= today && today <= p.endDate);

            return (
              <div
                key={v.id}
                className={`border rounded-xl p-4 ${v.active ? "border-border-light bg-bg" : "border-border-light bg-bg-warm opacity-60"}`}
              >
                {editingId === v.id ? (
                  /* 수정 폼 */
                  <form onSubmit={handleEdit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-sub mb-1">차량 이름</label>
                        <input
                          className="w-full border border-border-light rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-brand-400"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-sub mb-1">차량 종류</label>
                        <select
                          className="w-full border border-border-light rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-brand-400"
                          value={editType}
                          onChange={(e) => {
                            setEditType(e.target.value);
                            setEditCapacity(VEHICLE_CAPACITY[e.target.value] ?? editCapacity);
                          }}
                        >
                          {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-sub mb-1">적재량 (m³)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="50"
                          className="w-full border border-border-light rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-brand-400"
                          value={editCapacity}
                          onChange={(e) => setEditCapacity(parseFloat(e.target.value))}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-sub mb-1">차량번호</label>
                        <input
                          className="w-full border border-border-light rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-brand-400"
                          value={editLicensePlate}
                          onChange={(e) => setEditLicensePlate(e.target.value)}
                        />
                      </div>
                    </div>
                    {editError && <p className="text-red-500 text-xs">{editError}</p>}
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-text-sub border border-border-light rounded-lg hover:bg-bg-warm2">취소</button>
                      <button type="submit" disabled={editLoading} className="px-3 py-1.5 text-xs bg-brand-400 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50">{editLoading ? "저장 중..." : "저장"}</button>
                    </div>
                  </form>
                ) : (
                  /* 차량 카드 */
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary">{v.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-bg-warm2 text-text-sub">{v.type}</span>
                          {isUnavailableNow && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">이용불가</span>
                          )}
                          {!v.active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-bg-warm2 text-text-muted">비활성</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-text-sub flex items-center gap-3">
                          <span>적재량: <strong className="text-text-primary">{v.capacity}m³</strong></span>
                          {v.licensePlate && <span>차량번호: {v.licensePlate}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setUnavailableVehicleId(v.id)}
                          className="text-xs px-2.5 py-1 border border-border-light rounded-lg text-text-sub hover:bg-bg-warm2 transition-colors"
                        >
                          이용불가 설정
                        </button>
                        <button
                          onClick={() => startEdit(v)}
                          className="text-xs px-2.5 py-1 border border-border-light rounded-lg text-text-sub hover:bg-bg-warm2 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleToggleActive(v)}
                          className="text-xs px-2.5 py-1 border border-border-light rounded-lg text-text-sub hover:bg-bg-warm2 transition-colors"
                        >
                          {v.active ? "비활성화" : "활성화"}
                        </button>
                      </div>
                    </div>

                    {/* 이용불가 기간 목록 */}
                    {vPeriods.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {vPeriods.map((p) => {
                          const isCurrent = p.startDate <= today && today <= p.endDate;
                          const isPast = p.endDate < today;
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg ${isCurrent ? "bg-red-50 text-red-600" : isPast ? "bg-bg-warm text-text-muted" : "bg-amber-50 text-amber-700"}`}
                            >
                              <span>
                                {p.startDate === p.endDate ? p.startDate : `${p.startDate} ~ ${p.endDate}`}
                                {p.reason && ` · ${p.reason}`}
                              </span>
                              <button
                                onClick={() => handleDeleteUnavailable(p.id)}
                                className="ml-3 hover:opacity-70 transition-opacity"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 이용불가 추가 폼 (인라인) */}
                    {unavailableVehicleId === v.id && (
                      <form onSubmit={handleAddUnavailable} className="mt-3 p-3 border border-amber-200 rounded-lg bg-amber-50 space-y-2">
                        <p className="text-xs font-semibold text-amber-800">이용불가 기간 설정</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-amber-700 mb-0.5">시작일</label>
                            <input
                              type="date"
                              className="w-full border border-amber-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                              value={unavailableStart}
                              onChange={(e) => setUnavailableStart(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-amber-700 mb-0.5">종료일</label>
                            <input
                              type="date"
                              className="w-full border border-amber-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                              value={unavailableEnd}
                              min={unavailableStart}
                              onChange={(e) => setUnavailableEnd(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-amber-700 mb-0.5">사유</label>
                            <input
                              className="w-full border border-amber-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                              placeholder="예: 정기점검"
                              value={unavailableReason}
                              onChange={(e) => setUnavailableReason(e.target.value)}
                            />
                          </div>
                        </div>
                        {unavailableError && <p className="text-red-500 text-xs">{unavailableError}</p>}
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={() => setUnavailableVehicleId(null)} className="text-xs px-3 py-1 text-amber-700 hover:opacity-70">취소</button>
                          <button type="submit" disabled={unavailableLoading} className="text-xs px-3 py-1 bg-amber-500 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50">
                            {unavailableLoading ? "추가 중..." : "설정"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
