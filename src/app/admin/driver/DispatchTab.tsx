"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Booking } from "@/types/booking";
import type { Driver, Vehicle, Assignment, BlockedSlot } from "./types";
import { addDays, getToday, formatDate, SLOT_MGMT_HOURS } from "./constants";
import GanttView, { GANTT_BLOCK_BG, GANTT_BLOCK_BORDER, GANTT_STATUS_LABELS } from "./GanttView";

export interface DispatchTabProps {
  // Date
  assignDate: string;
  setAssignDate: (v: string) => void;

  // Vehicle assignment
  allDrivers: Driver[];
  assignments: Assignment[];
  vehicles: Vehicle[];
  assignLoading: boolean;
  assigningDriverId: string | null;
  setAssigningDriverId: (v: string | null) => void;
  selectedVehicleId: string;
  setSelectedVehicleId: (v: string) => void;
  assignError: string;
  setAssignError: (v: string) => void;
  onCreateAssignment: (driverId: string, vehicleId: string) => void;
  onDeleteAssignment: (id: string) => void;

  // Gantt
  ganttDrivers: Driver[];
  ganttBookings: Booking[];
  ganttLoading: boolean;
  token: string;
  onGanttRefresh: () => void;

  // Slot blocking
  blockedSlots: BlockedSlot[];
  selectedDriverId: string;
  setSelectedDriverId: (v: string) => void;
  slotsLoading: boolean;
  slotActionLoading: string | null;
  slotBookings: { id: string; confirmedTime: string | null; timeSlot: string }[];
  onBlockSlot: (timeStart: string) => void;
  onUnblockSlot: (slotId: string, timeStart: string) => void;
}

export default function DispatchTab({
  assignDate,
  setAssignDate,
  allDrivers,
  assignments,
  vehicles,
  assignLoading,
  assigningDriverId,
  setAssigningDriverId,
  selectedVehicleId,
  setSelectedVehicleId,
  assignError,
  setAssignError,
  onCreateAssignment,
  onDeleteAssignment,
  ganttDrivers,
  ganttBookings,
  ganttLoading,
  token,
  onGanttRefresh,
  blockedSlots,
  selectedDriverId,
  setSelectedDriverId,
  slotsLoading,
  slotActionLoading,
  slotBookings,
  onBlockSlot,
  onUnblockSlot,
}: DispatchTabProps) {
  const router = useRouter();
  const isAssignToday = assignDate === getToday();

  const slotBookingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of slotBookings) {
      const time = b.confirmedTime || b.timeSlot;
      if (!time) continue;
      const hour = time.split(":")[0];
      const key = `${hour}:00`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [slotBookings]);

  const blockedSlotMap = useMemo(() => {
    const map: Record<string, BlockedSlot> = {};
    for (const slot of blockedSlots) {
      map[slot.timeStart] = slot;
    }
    return map;
  }, [blockedSlots]);

  return (
    <div className="max-w-[56rem] mx-auto px-4 py-4 pb-8">
      {/* 날짜 선택 (단일) */}
      <div className="flex items-center gap-2 mb-6 max-w-[42rem]">
        <button
          onClick={() => setAssignDate(addDays(assignDate, -1))}
          className="shrink-0 p-2 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <input
          type="date"
          value={assignDate}
          onChange={(e) => setAssignDate(e.target.value)}
          className="flex-1 h-10 px-3 rounded-md border border-border-light bg-bg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
        <button
          onClick={() => setAssignDate(addDays(assignDate, 1))}
          className="shrink-0 p-2 rounded-sm hover:bg-bg-warm transition-colors border border-border-light"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {!isAssignToday && (
          <button
            onClick={() => setAssignDate(getToday())}
            className="text-xs text-primary font-medium hover:underline px-2"
          >
            오늘로
          </button>
        )}
      </div>

      {/* ── 기사-차량 배정 ── */}
      <div className="max-w-[42rem]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary mb-1">기사-차량 배정</h2>
            <p className="text-[11px] text-text-muted">특정일에 기사와 차량을 매칭합니다</p>
          </div>
          <button
            onClick={() => router.push("/admin/vehicles")}
            className="text-xs text-primary font-medium hover:underline"
          >
            차량 관리 →
          </button>
        </div>

        {vehicles.length === 0 && (
          <div className="text-center py-6 text-text-muted text-xs border border-dashed border-border-light rounded-lg">
            차량이 없습니다.{" "}
            <button onClick={() => router.push("/admin/vehicles")} className="text-primary font-medium hover:underline">
              차량 먼저 등록하세요 →
            </button>
          </div>
        )}

        {assignError && (
          <p className="text-xs text-red-500 mb-2">{assignError}</p>
        )}

        {assignLoading ? (
          <div className="text-center py-6 text-text-muted text-xs">불러오는 중...</div>
        ) : (
          <div className="space-y-2">
            {allDrivers.filter((d) => d.active).map((driver) => {
              const assignment = assignments.find((a) => a.driverId === driver.id);
              const isAssigning = assigningDriverId === driver.id;

              return (
                <div key={driver.id} className="bg-bg rounded-lg border border-border-light p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-text-primary">{driver.name}</span>
                      {assignment ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-semantic-green shrink-0" />
                          <span className="text-xs text-text-sub">
                            {assignment.vehicle?.name} ({assignment.vehicle?.type} · {assignment.vehicle?.capacity}m³)
                          </span>
                          {assignment.vehicle?.licensePlate && (
                            <span className="text-xs text-text-muted">{assignment.vehicle.licensePlate}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-text-muted shrink-0" />
                          <span className="text-xs text-text-muted">차량 미배정</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {assignment ? (
                        <button
                          onClick={() => onDeleteAssignment(assignment.id)}
                          className="text-[11px] font-medium text-semantic-red px-2 py-1 rounded-sm hover:bg-red-50 transition-colors"
                        >
                          해제
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setAssigningDriverId(isAssigning ? null : driver.id);
                            setSelectedVehicleId("");
                            setAssignError("");
                          }}
                          className="text-[11px] font-medium text-primary px-2 py-1 rounded-sm hover:bg-primary/5 transition-colors"
                        >
                          {isAssigning ? "취소" : "배정"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 차량 선택 드롭다운 (배정 모드) */}
                  {isAssigning && !assignment && (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="flex-1 h-9 px-2 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                      >
                        <option value="">차량 선택</option>
                        {vehicles
                          .filter((v) => !assignments.find((a) => a.vehicleId === v.id))
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.type} · {v.capacity}m³{v.licensePlate ? ` · ${v.licensePlate}` : ""})
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => onCreateAssignment(driver.id, selectedVehicleId)}
                        disabled={!selectedVehicleId}
                        className="shrink-0 h-9 px-4 bg-primary text-white text-xs font-semibold rounded-sm hover:bg-primary-dark disabled:opacity-40 transition-colors"
                      >
                        확인
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 기사별 배차 현황 (Gantt) - 항상 보임 ── */}
      <div className="mt-8">
        <div className="mb-4 border-t border-border-light pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-primary mb-1">기사별 배차 현황</h2>
              <p className="text-[11px] text-text-muted">시간 블록을 드래그해 기사·시간을 변경할 수 있습니다</p>
            </div>
            <button
              onClick={onGanttRefresh}
              className="text-xs px-3 py-1.5 rounded-md border border-border-light text-text-sub hover:bg-bg transition-colors font-medium"
            >
              새로고침
            </button>
          </div>
        </div>

        <div className="overflow-x-auto" style={{ minWidth: 0 }}>
          {ganttLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
              <span className="ml-2 text-sm text-text-muted">불러오는 중...</span>
            </div>
          ) : ganttDrivers.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">등록된 기사가 없습니다</div>
          ) : (
            <div style={{ minWidth: "700px" }}>
              {/* 범례 */}
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                {(["pending", "quote_confirmed", "user_confirmed", "in_progress", "completed"] as const).map((s) => (
                  <div key={s} className="flex items-center gap-1">
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "2px",
                        backgroundColor: GANTT_BLOCK_BG[s],
                        borderLeft: `3px solid ${GANTT_BLOCK_BORDER[s]}`,
                      }}
                    />
                    <span className="text-[10px] text-text-muted">{GANTT_STATUS_LABELS[s]}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "#ECEFF1", borderLeft: "3px solid #90A4AE" }} />
                  <span className="text-[10px] text-text-muted">하차지</span>
                </div>
                <span className="text-[10px] text-text-muted ml-auto">드래그로 기사/시간 변경 가능</span>
              </div>

              <GanttView
                drivers={ganttDrivers}
                bookings={ganttBookings}
                token={token}
                onBookingUpdated={onGanttRefresh}
                onBookingClick={(id) => router.push(`/admin/bookings/${id}`)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 슬롯 차단 관리 ── */}
      <div className="max-w-[42rem] mt-8">
        <div className="mb-4 border-t border-border-light pt-6">
          <h2 className="text-sm font-bold text-text-primary mb-1">슬롯 차단 관리</h2>
          <p className="text-[11px] text-text-muted">특정 날짜/시간에 신규 예약을 차단합니다</p>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] text-text-muted font-medium mb-1">기사 선택</label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border-light bg-bg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          >
            <option value="all">전체</option>
            {allDrivers.filter((d) => d.active).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.phone ? ` (${d.phone})` : ""}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-text-muted text-center mb-3">
          {formatDate(assignDate)} ·{" "}
          {blockedSlots.length > 0 ? `차단 ${blockedSlots.length}개` : "차단 없음"} ·{" "}
          예약 {slotBookings.length}건
        </p>

        {slotsLoading ? (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="bg-bg rounded-lg border border-border-light overflow-hidden">
            {SLOT_MGMT_HOURS.map((time) => {
              const blocked = blockedSlotMap[time];
              const bookingCount = slotBookingCounts[time] || 0;
              const isActionLoading = slotActionLoading === time;
              return (
                <div
                  key={time}
                  className={`flex items-stretch border-b border-border-light/50 last:border-0 transition-colors ${blocked ? "bg-red-50" : ""}`}
                >
                  <div className="w-16 shrink-0 py-3 pr-2 text-right flex flex-col justify-center">
                    <span className={`text-xs font-medium ${blocked ? "text-semantic-red" : bookingCount > 0 ? "text-text-primary" : "text-text-muted"}`}>
                      {time}
                    </span>
                  </div>
                  <div className="flex-1 border-l border-border-light min-h-[3rem] flex items-center px-3 gap-3">
                    {bookingCount > 0 && (
                      <span className="text-[11px] font-medium text-text-sub bg-bg-warm px-2 py-1 rounded-sm">
                        예약 {bookingCount}건
                      </span>
                    )}
                    {blocked ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-semantic-red shrink-0" />
                          <span className="text-xs font-medium text-semantic-red">차단됨</span>
                        </span>
                        {blocked.reason && (
                          <span className="text-[11px] text-text-muted truncate">{blocked.reason}</span>
                        )}
                        <button
                          onClick={() => onUnblockSlot(blocked.id!, time)}
                          disabled={isActionLoading}
                          className="ml-auto shrink-0 text-[11px] font-medium text-semantic-red bg-white border border-red-200 rounded-sm px-3 py-1.5 hover:bg-red-50 active:scale-[0.97] transition-all disabled:opacity-50"
                        >
                          {isActionLoading ? "..." : "해제"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-semantic-green shrink-0" />
                          <span className="text-xs text-text-muted">가능</span>
                        </span>
                        <button
                          onClick={() => onBlockSlot(time)}
                          disabled={isActionLoading}
                          className="ml-auto shrink-0 text-[11px] font-medium text-text-sub bg-bg border border-border-light rounded-sm px-3 py-1.5 hover:bg-bg-warm active:scale-[0.97] transition-all disabled:opacity-50"
                        >
                          {isActionLoading ? "..." : "차단"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
