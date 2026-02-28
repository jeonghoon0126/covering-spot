"use client";

import { VEHICLE_TYPES } from "@/lib/constants";
import type { Driver } from "./types";
import { WorkDayToggle, WorkSlotToggle, WorkDayChips, WorkSlotChips } from "./WorkDayToggle";

export interface DriverCardProps {
  driver: Driver;
  isEditing: boolean;
  // Edit state
  editName: string;
  setEditName: (v: string) => void;
  editPhone: string;
  setEditPhone: (v: string) => void;
  editVehicleType: string;
  setEditVehicleType: (v: string) => void;
  editLicensePlate: string;
  setEditLicensePlate: (v: string) => void;
  editWorkDays: string;
  setEditWorkDays: (v: string) => void;
  editWorkSlots: string;
  setEditWorkSlots: (v: string) => void;
  editInitialLoadCube: number;
  setEditInitialLoadCube: (v: number) => void;
  editStartAddress: string;
  setEditStartAddress: (v: string) => void;
  editEndAddress: string;
  setEditEndAddress: (v: string) => void;
  onShowEditStartPostcode: () => void;
  onShowEditEndPostcode: () => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onToggleActive: () => void;
}

export default function DriverCard({
  driver,
  isEditing,
  editName,
  setEditName,
  editPhone,
  setEditPhone,
  editVehicleType,
  setEditVehicleType,
  editLicensePlate,
  setEditLicensePlate,
  editWorkDays,
  setEditWorkDays,
  editWorkSlots,
  setEditWorkSlots,
  editInitialLoadCube,
  setEditInitialLoadCube,
  editStartAddress,
  setEditStartAddress,
  editEndAddress,
  setEditEndAddress,
  onShowEditStartPostcode,
  onShowEditEndPostcode,
  saving,
  onSave,
  onCancel,
  onStartEdit,
  onToggleActive,
}: DriverCardProps) {
  return (
    <div
      className={`bg-bg rounded-lg border p-4 transition-all shadow-sm ${
        driver.active ? "border-border-light" : "border-border-light/40 opacity-55"
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
          <div>
            <label className="block text-[11px] text-text-muted font-medium mb-1">
              초기 적재량 <span className="text-text-muted/60 font-normal">(m³)</span>
            </label>
            <input
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={editInitialLoadCube}
              onChange={(e) => setEditInitialLoadCube(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] text-text-muted font-medium mb-1">출발지 주소</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onShowEditStartPostcode}
                className="flex-1 h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
              >
                {editStartAddress ? (
                  <span className="text-text-primary">{editStartAddress}</span>
                ) : (
                  <span className="text-text-muted">주소 검색</span>
                )}
              </button>
              {editStartAddress && (
                <button
                  type="button"
                  onClick={() => setEditStartAddress("")}
                  className="shrink-0 h-9 w-9 flex items-center justify-center rounded-sm border border-border-light bg-bg-warm text-text-muted hover:text-text-primary transition-colors text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-text-muted font-medium mb-1">퇴근지 주소</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onShowEditEndPostcode}
                className="flex-1 h-9 px-3 rounded-sm border border-border-light bg-bg-warm text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
              >
                {editEndAddress ? (
                  <span className="text-text-primary">{editEndAddress}</span>
                ) : (
                  <span className="text-text-muted">주소 검색</span>
                )}
              </button>
              {editEndAddress && (
                <button
                  type="button"
                  onClick={() => setEditEndAddress("")}
                  className="shrink-0 h-9 w-9 flex items-center justify-center rounded-sm border border-border-light bg-bg-warm text-text-muted hover:text-text-primary transition-colors text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 h-9 rounded-sm bg-primary text-white text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? "..." : "저장"}
            </button>
            <button
              onClick={onCancel}
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
                onClick={onStartEdit}
                className="text-[11px] font-medium text-text-sub hover:text-text-primary px-2 py-1.5 rounded-sm hover:bg-bg-warm transition-colors"
              >
                수정
              </button>
              <button
                onClick={onToggleActive}
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
          {/* 초기 적재량 / 출발지 / 퇴근지 */}
          {(driver.initialLoadCube > 0 || driver.startAddress || driver.endAddress) && (
            <div className="mt-2 space-y-0.5">
              {driver.initialLoadCube > 0 && (
                <p className="text-[11px] text-text-muted">
                  초기 적재: <span className="text-text-primary font-medium">{driver.initialLoadCube}m³</span>
                </p>
              )}
              {driver.startAddress && (
                <p className="text-[11px] text-text-muted truncate">
                  출발: <span className="text-text-sub">{driver.startAddress}</span>
                </p>
              )}
              {driver.endAddress && (
                <p className="text-[11px] text-text-muted truncate">
                  퇴근: <span className="text-text-sub">{driver.endAddress}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
