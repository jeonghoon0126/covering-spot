import { supabase } from "@/lib/supabase";
import type { UnloadingPoint } from "@/types/booking";
import type { Driver } from "./db-drivers";
import { getDrivers } from "./db-drivers";
import { getDriverVehicleAssignments, getVehicleUnavailablePeriods } from "./db-vehicles";

/* ── 하차지 (Unloading Points) ── */

function rowToUnloadingPoint(row: Record<string, unknown>): UnloadingPoint {
  return {
    id: row.id as string,
    name: row.name as string,
    address: row.address as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    active: (row.active as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getUnloadingPoints(activeOnly = true): Promise<UnloadingPoint[]> {
  let query = supabase.from("unloading_points").select("*").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToUnloadingPoint);
}

export async function createUnloadingPoint(
  name: string,
  address: string,
  latitude: number,
  longitude: number,
): Promise<UnloadingPoint> {
  const { data, error } = await supabase
    .from("unloading_points")
    .insert({ name, address, latitude, longitude })
    .select()
    .single();
  if (error) throw error;
  return rowToUnloadingPoint(data);
}

export async function updateUnloadingPoint(
  id: string,
  updates: { name?: string; address?: string; latitude?: number; longitude?: number; active?: boolean },
): Promise<UnloadingPoint | null> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.address !== undefined) row.address = updates.address;
  if (updates.latitude !== undefined) row.latitude = updates.latitude;
  if (updates.longitude !== undefined) row.longitude = updates.longitude;
  if (updates.active !== undefined) row.active = updates.active;

  const { data, error } = await supabase
    .from("unloading_points")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? rowToUnloadingPoint(data) : null;
}

export async function deleteUnloadingPoint(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("unloading_points")
    .delete()
    .eq("id", id)
    .select("id"); // 실제 삭제된 행 반환 → 없는 ID는 빈 배열
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * 특정 날짜에 근무하는 기사 + 배정 차량 용량 조회
 * - driver_vehicle_assignments가 있으면 해당 vehicle.capacity 사용
 * - 배정 없으면 driver.vehicleCapacity 폴백 (하위호환)
 * - 차량이 vehicle_unavailable_periods에 해당하면 제외
 */
export async function getDriversWithVehicleForDate(date: string): Promise<Array<Driver & { resolvedCapacity: number; vehicleId?: string }>> {
  const dayIndex = new Date(date).getDay();
  const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
  const dayKo = DAY_KO[dayIndex];

  const [drivers, assignments, unavailablePeriods] = await Promise.all([
    getDrivers(true),
    getDriverVehicleAssignments(date),
    getVehicleUnavailablePeriods(),
  ]);

  // 해당 날짜에 이용불가인 차량 ID 셋
  const unavailableVehicleIds = new Set(
    unavailablePeriods
      .filter((p) => p.startDate <= date && date <= p.endDate)
      .map((p) => p.vehicleId),
  );

  const assignmentByDriverId = new Map(assignments.map((a) => [a.driverId, a]));

  return drivers
    .filter((d) => {
      if (!d.workDays) return false;
      return d.workDays.split(",").map((s) => s.trim()).includes(dayKo);
    })
    .map((d) => {
      const assignment = assignmentByDriverId.get(d.id);
      // 배정 차량이 이용불가면 → 그 기사는 차량 없음 (capacity=0으로 제외 처리)
      if (assignment && unavailableVehicleIds.has(assignment.vehicleId)) {
        return { ...d, resolvedCapacity: 0, vehicleId: assignment.vehicleId };
      }
      const resolvedCapacity = assignment?.vehicle?.capacity ?? d.vehicleCapacity;
      return { ...d, resolvedCapacity, vehicleId: assignment?.vehicleId };
    });
}
