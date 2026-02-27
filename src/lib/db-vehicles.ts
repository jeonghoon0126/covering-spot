import { supabase } from "@/lib/supabase";

export interface Vehicle {
  id: string;
  name: string;                  // 식별용 이름 (예: "1톤 A")
  type: string;                  // '1톤' | '1.4톤' | '2.5톤' | '5톤'
  capacity: number;              // 적재량 (m³)
  licensePlate: string | null;   // 차량번호
  active: boolean;
  createdAt: string;
}

export interface VehicleUnavailablePeriod {
  id: string;
  vehicleId: string;
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD (inclusive)
  reason: string;
  createdAt: string;
}

export interface DriverVehicleAssignment {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;                  // YYYY-MM-DD
  createdAt: string;
  vehicle?: Vehicle;             // JOIN 결과 (선택적)
  driverName?: string;           // JOIN 결과 (선택적)
}

export function rowToVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id: row.id as string,
    name: row.name as string,
    type: (row.type as string) || "1톤",
    capacity: (row.capacity as number) ?? 4.8,
    licensePlate: (row.license_plate as string) || null,
    active: (row.active as boolean) ?? true,
    createdAt: row.created_at as string,
  };
}

export async function getVehicles(activeOnly = true): Promise<Vehicle[]> {
  let query = supabase.from("vehicles").select("*").order("name", { ascending: true });
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToVehicle);
}

export async function createVehicle(
  name: string,
  type: string,
  capacity: number,
  licensePlate?: string,
): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({ name, type, capacity, license_plate: licensePlate || null })
    .select()
    .single();
  if (error) throw error;
  return rowToVehicle(data);
}

export async function updateVehicle(
  id: string,
  updates: { name?: string; type?: string; capacity?: number; licensePlate?: string | null; active?: boolean },
): Promise<Vehicle | null> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.capacity !== undefined) row.capacity = updates.capacity;
  if (updates.licensePlate !== undefined) row.license_plate = updates.licensePlate;
  if (updates.active !== undefined) row.active = updates.active;

  const { data, error } = await supabase
    .from("vehicles")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? rowToVehicle(data) : null;
}

export async function deleteVehicle(id: string): Promise<boolean> {
  // soft-delete: active = false
  const result = await updateVehicle(id, { active: false });
  return result !== null;
}

/* ── 차량 이용불가 기간 (VehicleUnavailablePeriods) ── */

function rowToVehicleUnavailablePeriod(row: Record<string, unknown>): VehicleUnavailablePeriod {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    reason: (row.reason as string) || "",
    createdAt: row.created_at as string,
  };
}

export async function getVehicleUnavailablePeriods(vehicleId?: string): Promise<VehicleUnavailablePeriod[]> {
  let query = supabase
    .from("vehicle_unavailable_periods")
    .select("*")
    .order("start_date", { ascending: true });
  if (vehicleId) query = query.eq("vehicle_id", vehicleId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToVehicleUnavailablePeriod);
}

export async function createVehicleUnavailablePeriod(
  vehicleId: string,
  startDate: string,
  endDate: string,
  reason: string,
): Promise<VehicleUnavailablePeriod> {
  const { data, error } = await supabase
    .from("vehicle_unavailable_periods")
    .insert({ vehicle_id: vehicleId, start_date: startDate, end_date: endDate, reason })
    .select()
    .single();
  if (error) throw error;
  return rowToVehicleUnavailablePeriod(data);
}

export async function deleteVehicleUnavailablePeriod(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("vehicle_unavailable_periods")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/* ── 기사-차량 일별 배정 (DriverVehicleAssignments) ── */

function rowToAssignment(row: Record<string, unknown>, vehicleRow?: Record<string, unknown>): DriverVehicleAssignment {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    vehicleId: row.vehicle_id as string,
    date: row.date as string,
    createdAt: row.created_at as string,
    vehicle: vehicleRow ? rowToVehicle(vehicleRow) : undefined,
    driverName: (row.driver_name as string) || undefined,
  };
}

/** 특정 날짜의 배정 목록 (vehicle + driver 이름 포함) */
export async function getDriverVehicleAssignments(date?: string, driverId?: string): Promise<DriverVehicleAssignment[]> {
  let query = supabase
    .from("driver_vehicle_assignments")
    .select("*, vehicles(*), drivers(name)")
    .order("date", { ascending: true });
  if (date) query = query.eq("date", date);
  if (driverId) query = query.eq("driver_id", driverId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => {
    const vehicleData = (row as Record<string, unknown>).vehicles as Record<string, unknown> | null;
    const driverData = (row as Record<string, unknown>).drivers as Record<string, unknown> | null;
    const base = rowToAssignment(row as Record<string, unknown>, vehicleData || undefined);
    if (driverData) base.driverName = driverData.name as string;
    return base;
  });
}

export async function createDriverVehicleAssignment(
  driverId: string,
  vehicleId: string,
  date: string,
): Promise<DriverVehicleAssignment> {
  const { data, error } = await supabase
    .from("driver_vehicle_assignments")
    .insert({ driver_id: driverId, vehicle_id: vehicleId, date })
    .select("*, vehicles(*), drivers(name)")
    .single();
  if (error) throw error;
  const vehicleData = (data as Record<string, unknown>).vehicles as Record<string, unknown> | null;
  const driverData = (data as Record<string, unknown>).drivers as Record<string, unknown> | null;
  const result = rowToAssignment(data as Record<string, unknown>, vehicleData || undefined);
  if (driverData) result.driverName = driverData.name as string;
  return result;
}

export async function deleteDriverVehicleAssignment(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("driver_vehicle_assignments")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
