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
      setShowAddForm(false);
      setNewName(""); setNewType("1톤"); setNewCapacity(4.8); setNewLicensePlate("");
      fetchAll(token);
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
      // 필터 상태에 따라 목록이 바뀌어야 하므로 서버에서 다시 조회
      fetchAll(token);
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

  const today = getToday();

  return (
    <>
      <div className="min-h-screen bg-bg-warm">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-[20px] border-b border-border-light">
          <div className="max-w-[42rem] mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/admin/driver")}
                className="text-xs font-medium text-text-sub bg-bg border border-border-light rounded-md px-3 py-1.5 hover:bg-bg-warm transition-colors"
              >
                ← 기사 관리
              </button>
              <h1 className="text-lg font-bold">차량 관리</h1>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-text-sub cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-primary"
                />
                비활성 포함
              </label>
              <button
                onClick={() => { setShowAddForm((prev) => !prev); setAddError(""); }}
                className="text-xs font-semibold text-white bg-primary rounded-md px-3 py-1.5 hover:bg-primary-dark active:scale-[0.97] transition-all"
              >
                {showAddForm ? "취소" : "+ 차량 추가"}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[42rem] mx-auto px-4 py-4">
          {/* 차량 추가 인라인 폼 */}
          {showAddForm && (
            <div className="bg-bg rounded-lg border border-primary/30 p-4 mb-4 space-y-3">
              <p className="text-xs font-bold text-text-primary">새 차량 등록</p>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-text-muted font-medium mb-1">차량 이름 *</label>
                    <input
                      className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      placeholder="예: 1톤 A"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted font-medium mb-1">차량 종류 *</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
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
                    <label className="block text-[11px] text-text-muted font-medium mb-1">적재량 (m³) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(parseFloat(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted font-medium mb-1">차량번호</label>
                    <input
                      className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      placeholder="예: 서울12가3456"
                      value={newLicensePlate}
                      onChange={(e) => setNewLicensePlate(e.target.value)}
                    />
                  </div>
                </div>
                {addError && <p className="text-xs text-semantic-red">{addError}</p>}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs text-text-sub border border-border-light rounded-md hover:bg-bg-warm transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-3 py-1.5 text-xs bg-primary text-white rounded-md font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    {addLoading ? "추가 중..." : "추가"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 로딩 */}
          {loading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {/* 차량 목록 */}
          {!loading && (
            <div className="space-y-2">
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
                    className={`bg-bg rounded-lg border border-border-light p-3 ${!v.active ? "opacity-50" : ""}`}
                  >
                    {editingId === v.id ? (
                      /* 수정 폼 */
                      <form onSubmit={handleEdit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-text-muted font-medium mb-1">차량 이름</label>
                            <input
                              className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-text-muted font-medium mb-1">차량 종류</label>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
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
                            <label className="block text-[11px] text-text-muted font-medium mb-1">적재량 (m³)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="50"
                              className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                              value={editCapacity}
                              onChange={(e) => setEditCapacity(parseFloat(e.target.value))}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-text-muted font-medium mb-1">차량번호</label>
                            <input
                              className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                              value={editLicensePlate}
                              onChange={(e) => setEditLicensePlate(e.target.value)}
                            />
                          </div>
                        </div>
                        {editError && <p className="text-xs text-semantic-red">{editError}</p>}
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-text-sub border border-border-light rounded-md hover:bg-bg-warm transition-colors">취소</button>
                          <button type="submit" disabled={editLoading} className="px-3 py-1.5 text-xs bg-primary text-white rounded-md font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors">{editLoading ? "저장 중..." : "저장"}</button>
                        </div>
                      </form>
                    ) : (
                      /* 차량 카드 */
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-text-primary">{v.name}</span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-bg-warm2 text-text-sub">{v.type}</span>
                              {isUnavailableNow && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-semantic-red-tint text-semantic-red border border-semantic-red/20">이용불가</span>
                              )}
                              {!v.active && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-fill-tint text-text-muted">비활성</span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-text-sub flex items-center gap-3">
                              <span>적재량 <strong className="text-text-primary">{v.capacity}m³</strong></span>
                              {v.licensePlate && <span>{v.licensePlate}</span>}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1">
                            <button
                              onClick={() => setUnavailableVehicleId(unavailableVehicleId === v.id ? null : v.id)}
                              className="text-[11px] font-medium text-text-sub px-2 py-1 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
                            >
                              이용불가
                            </button>
                            <button
                              onClick={() => startEdit(v)}
                              className="text-[11px] font-medium text-text-sub px-2 py-1 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleToggleActive(v)}
                              className={`text-[11px] font-medium px-2 py-1 rounded-sm transition-colors ${v.active ? "text-semantic-red hover:bg-red-50" : "text-primary hover:bg-primary/5"}`}
                            >
                              {v.active ? "비활성화" : "활성화"}
                            </button>
                          </div>
                        </div>

                        {/* 이용불가 기간 목록 */}
                        {vPeriods.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {vPeriods.map((p) => {
                              const isCurrent = p.startDate <= today && today <= p.endDate;
                              const isPast = p.endDate < today;
                              return (
                                <div
                                  key={p.id}
                                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md ${isCurrent ? "bg-semantic-red-tint text-semantic-red" : isPast ? "bg-bg-warm text-text-muted" : "bg-semantic-orange-tint text-semantic-orange"}`}
                                >
                                  <span>
                                    {p.startDate === p.endDate ? p.startDate : `${p.startDate} ~ ${p.endDate}`}
                                    {p.reason && ` · ${p.reason}`}
                                  </span>
                                  <button onClick={() => handleDeleteUnavailable(p.id)} className="ml-2 hover:opacity-60 transition-opacity text-[11px]">✕</button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 이용불가 추가 폼 (인라인) */}
                        {unavailableVehicleId === v.id && (
                          <form onSubmit={handleAddUnavailable} className="mt-2 p-3 border border-semantic-orange/30 rounded-md bg-semantic-orange-tint space-y-2">
                            <p className="text-[11px] font-semibold text-semantic-orange">이용불가 기간 설정</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] text-semantic-orange/80 font-medium mb-0.5">시작일</label>
                                <input
                                  type="date"
                                  className="w-full border border-semantic-orange/30 rounded-md px-2 py-1.5 text-xs bg-bg focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  value={unavailableStart}
                                  onChange={(e) => setUnavailableStart(e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-semantic-orange/80 font-medium mb-0.5">종료일</label>
                                <input
                                  type="date"
                                  className="w-full border border-semantic-orange/30 rounded-md px-2 py-1.5 text-xs bg-bg focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  value={unavailableEnd}
                                  min={unavailableStart}
                                  onChange={(e) => setUnavailableEnd(e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-semantic-orange/80 font-medium mb-0.5">사유</label>
                                <input
                                  className="w-full border border-semantic-orange/30 rounded-md px-2 py-1.5 text-xs bg-bg focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  placeholder="예: 정기점검"
                                  value={unavailableReason}
                                  onChange={(e) => setUnavailableReason(e.target.value)}
                                />
                              </div>
                            </div>
                            {unavailableError && <p className="text-xs text-semantic-red">{unavailableError}</p>}
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => setUnavailableVehicleId(null)} className="text-xs px-3 py-1 text-text-sub hover:opacity-70 transition-opacity">취소</button>
                              <button type="submit" disabled={unavailableLoading} className="text-xs px-3 py-1 bg-semantic-orange text-white rounded-md font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
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
          )}
        </div>
      </div>
    </>
  );
}
