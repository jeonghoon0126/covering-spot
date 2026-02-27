import { supabase } from "@/lib/supabase";

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
  vehicleType: string;         // '1톤', '1.4톤', '2.5톤', '5톤'
  vehicleCapacity: number;     // 적재 용량 (m³)
  licensePlate: string | null; // 차량번호
  workDays: string;            // 근무요일 (예: '월,화,수,목,금,토') — 기본값: 월~토
  workSlots: string;           // 가능 슬롯 (예: "10:00,12:00") — 빈 문자열 = 모든 슬롯
  initialLoadCube: number;     // 배차 시작 시 초기 적재량 (m³) — 전날 미하차 분
  startAddress: string | null; // 출발지 주소
  startLatitude: number | null;
  startLongitude: number | null;
  endAddress: string | null;   // 퇴근지 주소
  endLatitude: number | null;
  endLongitude: number | null;
}

export function rowToDriver(row: Record<string, unknown>): Driver {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) || null,
    active: row.active as boolean,
    createdAt: row.created_at as string,
    vehicleType: (row.vehicle_type as string) || "1톤",
    vehicleCapacity: (row.vehicle_capacity as number) || 4.8,
    licensePlate: (row.license_plate as string) || null,
    workDays: (row.work_days as string) || "월,화,수,목,금,토",
    workSlots: (row.work_slots as string) || "",
    initialLoadCube: (row.initial_load_cube as number) ?? 0,
    startAddress: (row.start_address as string) || null,
    startLatitude: row.start_latitude != null ? (row.start_latitude as number) : null,
    startLongitude: row.start_longitude != null ? (row.start_longitude as number) : null,
    endAddress: (row.end_address as string) || null,
    endLatitude: row.end_latitude != null ? (row.end_latitude as number) : null,
    endLongitude: row.end_longitude != null ? (row.end_longitude as number) : null,
  };
}

export async function getDrivers(activeOnly = true): Promise<Driver[]> {
  let query = supabase
    .from("drivers")
    .select("*")
    .order("name", { ascending: true });

  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToDriver);
}

/**
 * 특정 날짜에 근무하는 기사 목록 반환 (active=true + workDays에 해당 요일 포함)
 * workDays 예: "월,화,수,목,금,토"
 */
export async function getDriversForDate(date: string): Promise<Driver[]> {
  const dayIndex = new Date(date).getDay(); // 0=일,1=월,...,6=토
  const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
  const dayKo = DAY_KO[dayIndex];

  const drivers = await getDrivers(true);
  return drivers.filter((d) => {
    if (!d.workDays) return false;
    const days = d.workDays.split(",").map((s) => s.trim());
    return days.includes(dayKo);
  });
}

export async function createDriver(
  name: string,
  phone?: string,
  vehicleType?: string,
  vehicleCapacity?: number,
  licensePlate?: string,
  workDays?: string,
  workSlots?: string,
  initialLoadCube?: number,
  startAddress?: string,
  startLatitude?: number,
  startLongitude?: number,
  endAddress?: string,
  endLatitude?: number,
  endLongitude?: number,
): Promise<Driver> {
  const { data, error } = await supabase
    .from("drivers")
    .insert({
      name,
      phone: phone || null,
      vehicle_type: vehicleType || "1톤",
      vehicle_capacity: vehicleCapacity ?? 4.8,
      license_plate: licensePlate || null,
      work_days: workDays || "월,화,수,목,금,토",
      work_slots: workSlots || "",
      initial_load_cube: initialLoadCube ?? 0,
      start_address: startAddress || null,
      start_latitude: startLatitude ?? null,
      start_longitude: startLongitude ?? null,
      end_address: endAddress || null,
      end_latitude: endLatitude ?? null,
      end_longitude: endLongitude ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToDriver(data);
}

export async function updateDriver(
  id: string,
  updates: {
    name?: string; phone?: string; active?: boolean; vehicleType?: string; vehicleCapacity?: number;
    licensePlate?: string; workDays?: string; workSlots?: string;
    initialLoadCube?: number;
    startAddress?: string | null; startLatitude?: number | null; startLongitude?: number | null;
    endAddress?: string | null; endLatitude?: number | null; endLongitude?: number | null;
  },
): Promise<Driver | null> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.phone !== undefined) row.phone = updates.phone;
  if (updates.active !== undefined) row.active = updates.active;
  if (updates.vehicleType !== undefined) row.vehicle_type = updates.vehicleType;
  if (updates.vehicleCapacity !== undefined) row.vehicle_capacity = updates.vehicleCapacity;
  if (updates.licensePlate !== undefined) row.license_plate = updates.licensePlate;
  if (updates.workDays !== undefined) row.work_days = updates.workDays;
  if (updates.workSlots !== undefined) row.work_slots = updates.workSlots;
  if (updates.initialLoadCube !== undefined) row.initial_load_cube = updates.initialLoadCube;
  if (updates.startAddress !== undefined) row.start_address = updates.startAddress;
  if (updates.startLatitude !== undefined) row.start_latitude = updates.startLatitude;
  if (updates.startLongitude !== undefined) row.start_longitude = updates.startLongitude;
  if (updates.endAddress !== undefined) row.end_address = updates.endAddress;
  if (updates.endLatitude !== undefined) row.end_latitude = updates.endLatitude;
  if (updates.endLongitude !== undefined) row.end_longitude = updates.endLongitude;

  const { data, error } = await supabase
    .from("drivers")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? rowToDriver(data) : null;
}

export async function deleteDriver(id: string): Promise<boolean> {
  // soft-delete: active = false
  const result = await updateDriver(id, { active: false });
  return result !== null;
}
