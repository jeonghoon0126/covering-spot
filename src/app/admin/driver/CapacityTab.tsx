"use client";

import { useState, useEffect, useCallback } from "react";

interface CapacityDriver {
  driverId: string;
  driverName: string;
  vehicleName: string | null;
  vehicleType: string;
  effectiveCapacity: number;
  isAssignedVehicle: boolean;
  initialLoadCube: number;
  usedCube: number;
  remainingCube: number;
  bookingCount: number;
}

interface CapacitySlot {
  time: string;
  label: string;
  blocked: boolean;
  crewCount: number;
  totalCapacity: number;
  totalUsed: number;
  totalRemaining: number;
  drivers: CapacityDriver[];
}

interface CapacityTabProps {
  token: string;
}

function statusBadge(remaining: number, total: number) {
  if (total === 0) return <span className="text-xs text-text-muted">-</span>;
  if (remaining <= 0) return <span className="text-xs font-medium text-error bg-error/10 px-2 py-0.5 rounded-full">마감</span>;
  if (remaining / total <= 0.5) return <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">주의</span>;
  return <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">여유</span>;
}

export default function CapacityTab({ token }: CapacityTabProps) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<CapacitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

  const fetchCapacity = useCallback(async () => {
    if (!token || !date) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/capacity?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => { fetchCapacity(); }, [fetchCapacity]);

  return (
    <div className="space-y-4">
      {/* 날짜 선택 */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-text-sub font-medium whitespace-nowrap">날짜 선택</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-border-light rounded-md px-2 py-1 bg-bg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={fetchCapacity}
          className="text-xs font-medium text-primary border border-primary rounded-md px-3 py-1.5 hover:bg-primary/5 transition-all"
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-muted text-sm">불러오는 중...</div>
      ) : slots.length === 0 ? (
        <div className="text-center py-8 text-text-muted text-sm">데이터가 없습니다</div>
      ) : (
        <div className="rounded-[--radius-md] border border-border-light overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-warm border-b border-border-light">
                <th className="text-left px-3 py-2.5 text-text-sub font-semibold">슬롯</th>
                <th className="text-center px-3 py-2.5 text-text-sub font-semibold">기사수</th>
                <th className="text-center px-3 py-2.5 text-text-sub font-semibold">총 용량</th>
                <th className="text-center px-3 py-2.5 text-text-sub font-semibold">사용</th>
                <th className="text-center px-3 py-2.5 text-text-sub font-semibold">잔여</th>
                <th className="text-center px-3 py-2.5 text-text-sub font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <>
                  <tr
                    key={slot.time}
                    className={`border-b border-border-light/50 cursor-pointer transition-colors ${
                      slot.blocked ? "bg-fill-tint/50 text-text-muted" : "hover:bg-bg-warm/50"
                    } ${expandedSlot === slot.time ? "bg-bg-warm/30" : ""}`}
                    onClick={() => setExpandedSlot(expandedSlot === slot.time ? null : slot.time)}
                  >
                    <td className="px-3 py-2.5 font-medium">
                      {slot.label}
                      {slot.blocked && (
                        <span className="ml-2 text-[10px] text-text-muted bg-fill-tint px-1.5 py-0.5 rounded">차단</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">{slot.crewCount}명</td>
                    <td className="px-3 py-2.5 text-center">{slot.totalCapacity.toFixed(1)}m³</td>
                    <td className="px-3 py-2.5 text-center">{slot.totalUsed.toFixed(1)}m³</td>
                    <td className={`px-3 py-2.5 text-center font-medium ${slot.totalRemaining <= 0 ? "text-error" : slot.totalRemaining / (slot.totalCapacity || 1) <= 0.5 ? "text-warning" : "text-success"}`}>
                      {slot.totalRemaining.toFixed(1)}m³
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {slot.blocked ? (
                        <span className="text-xs text-text-muted">차단됨</span>
                      ) : (
                        statusBadge(slot.totalRemaining, slot.totalCapacity)
                      )}
                    </td>
                  </tr>
                  {expandedSlot === slot.time && slot.drivers.length > 0 && (
                    <tr key={`${slot.time}-detail`} className="border-b border-border-light/50 bg-bg-warm/20">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="space-y-1.5">
                          {slot.drivers.map((d) => (
                            <div key={d.driverId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-sub">
                              <span className="font-semibold text-text-primary">{d.driverName}</span>
                              <span className="text-text-muted">
                                {d.vehicleName ?? d.vehicleType}
                                {d.isAssignedVehicle && (
                                  <span className="ml-1 text-[10px] text-primary bg-primary/10 px-1 py-0.5 rounded">배정차량</span>
                                )}
                              </span>
                              <span>용량 {d.effectiveCapacity.toFixed(1)}m³</span>
                              <span>사용 {d.usedCube.toFixed(1)}m³</span>
                              <span className={d.remainingCube < 0 ? "text-error font-semibold" : ""}>
                                잔여 {d.remainingCube.toFixed(1)}m³
                                {d.remainingCube < 0 && " ⚠️초과"}
                              </span>
                              <span>예약 {d.bookingCount}건</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
