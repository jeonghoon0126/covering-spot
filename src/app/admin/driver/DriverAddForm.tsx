"use client";

import { VEHICLE_TYPES, VEHICLE_CAPACITY } from "@/lib/constants";
import { WorkDayToggle, WorkSlotToggle } from "./WorkDayToggle";

export interface DriverAddFormProps {
  newName: string;
  setNewName: (v: string) => void;
  newPhone: string;
  setNewPhone: (v: string) => void;
  newVehicleType: string;
  setNewVehicleType: (v: string) => void;
  newLicensePlate: string;
  setNewLicensePlate: (v: string) => void;
  newWorkDays: string;
  setNewWorkDays: (v: string) => void;
  newWorkSlots: string;
  setNewWorkSlots: (v: string) => void;
  newInitialLoadCube: number;
  setNewInitialLoadCube: (v: number) => void;
  newStartAddress: string;
  setNewStartAddress: (v: string) => void;
  newEndAddress: string;
  setNewEndAddress: (v: string) => void;
  onShowStartPostcode: () => void;
  onShowEndPostcode: () => void;
  saving: boolean;
  onSubmit: () => void;
}

export default function DriverAddForm({
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
  onShowStartPostcode,
  onShowEndPostcode,
  saving,
  onSubmit,
}: DriverAddFormProps) {
  return (
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
      <div>
        <label className="block text-[11px] text-text-muted font-medium mb-1">
          초기 적재량 <span className="text-text-muted/60 font-normal">(m³, 전날 미하차 분)</span>
        </label>
        <input
          type="number"
          min={0}
          max={30}
          step={0.1}
          value={newInitialLoadCube}
          onChange={(e) => setNewInitialLoadCube(parseFloat(e.target.value) || 0)}
          className="w-full h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </div>
      <div>
        <label className="block text-[11px] text-text-muted font-medium mb-1">
          출발지 주소 <span className="text-text-muted/60 font-normal">(가장 가까운 수거지 우선 배정)</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onShowStartPostcode}
            className="flex-1 h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          >
            {newStartAddress ? (
              <span className="text-text-primary">{newStartAddress}</span>
            ) : (
              <span className="text-text-muted">주소 검색</span>
            )}
          </button>
          {newStartAddress && (
            <button
              type="button"
              onClick={() => setNewStartAddress("")}
              className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md border border-border-light bg-bg-warm text-text-muted hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-text-muted font-medium mb-1">
          퇴근지 주소 <span className="text-text-muted/60 font-normal">(귀가 동선 참고용)</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onShowEndPostcode}
            className="flex-1 h-10 px-3 rounded-md border border-border-light bg-bg-warm text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          >
            {newEndAddress ? (
              <span className="text-text-primary">{newEndAddress}</span>
            ) : (
              <span className="text-text-muted">주소 검색</span>
            )}
          </button>
          {newEndAddress && (
            <button
              type="button"
              onClick={() => setNewEndAddress("")}
              className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md border border-border-light bg-bg-warm text-text-muted hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <button
        onClick={onSubmit}
        disabled={saving || !newName.trim()}
        className="w-full h-10 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {saving ? "추가 중..." : "추가"}
      </button>
    </div>
  );
}
