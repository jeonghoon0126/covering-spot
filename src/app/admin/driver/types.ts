/* ── 기사 관리 페이지 공유 타입 ── */

export interface BlockedSlot {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  reason?: string;
  driverId?: string | null;
}

export interface Driver {
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
  initialLoadCube: number;
  startAddress: string | null;
  endAddress: string | null;
}

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  capacity: number;
  licensePlate: string | null;
  active: boolean;
}

export interface Assignment {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;
  driverName?: string;
  vehicle?: Vehicle;
}

export type FilterTab = "all" | "active" | "inactive";
