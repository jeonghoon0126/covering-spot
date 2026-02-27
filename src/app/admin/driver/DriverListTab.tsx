"use client";

import type { Driver, FilterTab } from "./types";
import DriverAddForm from "./DriverAddForm";
import type { DriverAddFormProps } from "./DriverAddForm";
import DriverCard from "./DriverCard";

export interface DriverListTabProps {
  // Filter state
  filterTab: FilterTab;
  setFilterTab: (v: FilterTab) => void;
  allDrivers: Driver[];
  filteredDrivers: Driver[];
  activeCount: number;
  inactiveCount: number;
  loading: boolean;

  // Add form toggle
  showAddForm: boolean;
  onToggleAddForm: () => void;

  // Add form props (passed through)
  addFormProps: DriverAddFormProps;

  // Edit state
  editingId: string | null;
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
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onStartEdit: (driver: Driver) => void;
  onToggleActive: (driver: Driver) => void;
}

export default function DriverListTab({
  filterTab,
  setFilterTab,
  allDrivers,
  filteredDrivers,
  activeCount,
  inactiveCount,
  loading,
  showAddForm,
  onToggleAddForm,
  addFormProps,
  editingId,
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
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onToggleActive,
}: DriverListTabProps) {
  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "전체", count: allDrivers.length },
    { key: "active", label: "활성", count: activeCount },
    { key: "inactive", label: "비활성", count: inactiveCount },
  ];

  return (
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
          onClick={onToggleAddForm}
          className="text-xs font-semibold text-white bg-primary rounded-md px-3 py-1.5 hover:bg-primary-dark active:scale-[0.97] transition-all"
        >
          {showAddForm ? "취소" : "+ 기사 추가"}
        </button>
      </div>

      {/* 기사 추가 인라인 폼 */}
      {showAddForm && <DriverAddForm {...addFormProps} />}

      {/* 기사 목록 */}
      {loading ? (
        <div className="text-center py-12 text-text-muted text-sm">불러오는 중...</div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">
          {filterTab === "active" ? "활성 기사가 없습니다" : filterTab === "inactive" ? "비활성 기사가 없습니다" : "등록된 기사가 없습니다"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDrivers.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              isEditing={editingId === driver.id}
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
              onShowEditStartPostcode={onShowEditStartPostcode}
              onShowEditEndPostcode={onShowEditEndPostcode}
              saving={saving}
              onSave={() => onSaveEdit(driver.id)}
              onCancel={onCancelEdit}
              onStartEdit={() => onStartEdit(driver)}
              onToggleActive={() => onToggleActive(driver)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
