import { supabase } from "@/lib/supabase";
import type { Booking, UnloadingPoint } from "@/types/booking";

export interface BlockedSlot {
  id?: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  reason?: string;
  createdBy?: string;
  createdAt?: string;
  driverId?: string | null;
}

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

/* ── camelCase ↔ snake_case 매핑 ── */

const FIELD_MAP: Record<string, string> = {
  date: "date",
  timeSlot: "time_slot",
  area: "area",
  items: "items",
  totalPrice: "total_price",
  crewSize: "crew_size",
  needLadder: "need_ladder",
  ladderType: "ladder_type",
  ladderHours: "ladder_hours",
  ladderPrice: "ladder_price",
  customerName: "customer_name",
  phone: "phone",
  address: "address",
  addressDetail: "address_detail",
  memo: "memo",
  status: "status",
  hasElevator: "has_elevator",
  hasParking: "has_parking",
  hasGroundAccess: "has_ground_access",
  estimateMin: "estimate_min",
  estimateMax: "estimate_max",
  finalPrice: "final_price",
  photos: "photos",
  adminMemo: "admin_memo",
  confirmedTime: "confirmed_time",
  confirmedDuration: "confirmed_duration",
  completionPhotos: "completion_photos",
  slackThreadTs: "slack_thread_ts",
  driverId: "driver_id",
  driverName: "driver_name",
  source: "source",
  totalLoadingCube: "total_loading_cube",
  latitude: "latitude",
  longitude: "longitude",
  routeOrder: "route_order",
  unloadingStopAfter: "unloading_stop_after",
  agreedToTerms: "agreed_to_terms",
  agreedToPrivacy: "agreed_to_privacy",
  agreedToMarketing: "agreed_to_marketing",
  agreedToNightNotification: "agreed_to_night_notification",
};

function rowToBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    date: row.date as string,
    timeSlot: row.time_slot as string,
    area: row.area as string,
    items: (row.items as Booking["items"]) || [],
    totalPrice: (row.total_price as number) || 0,
    crewSize: (row.crew_size as number) || 1,
    needLadder: (row.need_ladder as boolean) || false,
    ladderType: (row.ladder_type as string) || undefined,
    ladderHours:
      row.ladder_hours != null ? (row.ladder_hours as number) : undefined,
    ladderPrice: (row.ladder_price as number) || 0,
    customerName: row.customer_name as string,
    phone: row.phone as string,
    address: row.address as string,
    addressDetail: (row.address_detail as string) || "",
    memo: (row.memo as string) || "",
    status: (row.status as Booking["status"]) || "pending",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    hasElevator: (row.has_elevator as boolean) || false,
    hasParking: (row.has_parking as boolean) || false,
    hasGroundAccess: (row.has_ground_access as boolean) || false,
    estimateMin: (row.estimate_min as number) || 0,
    estimateMax: (row.estimate_max as number) || 0,
    finalPrice:
      row.final_price != null ? (row.final_price as number) : null,
    photos: (row.photos as string[]) || [],
    adminMemo: (row.admin_memo as string) || "",
    confirmedTime: (row.confirmed_time as string) || null,
    confirmedDuration: row.confirmed_duration != null ? (row.confirmed_duration as number) : null,
    completionPhotos: (row.completion_photos as string[]) || [],
    slackThreadTs: (row.slack_thread_ts as string) || null,
    driverId: (row.driver_id as string) || null,
    driverName: (row.driver_name as string) || null,
    source: (row.source as string) || null,
    totalLoadingCube: (row.total_loading_cube as number) || 0,
    latitude: row.latitude != null ? (row.latitude as number) : null,
    longitude: row.longitude != null ? (row.longitude as number) : null,
    routeOrder: row.route_order != null ? (row.route_order as number) : null,
    unloadingStopAfter: (row.unloading_stop_after as string) || null,
    agreedToTerms: (row.agreed_to_terms as boolean) || false,
    agreedToPrivacy: (row.agreed_to_privacy as boolean) || false,
    agreedToMarketing: (row.agreed_to_marketing as boolean) || false,
    agreedToNightNotification: (row.agreed_to_night_notification as boolean) || false,
  };
}

function bookingToRow(b: Booking) {
  return {
    id: b.id,
    date: b.date,
    time_slot: b.timeSlot,
    area: b.area,
    items: b.items,
    total_price: b.totalPrice,
    crew_size: b.crewSize,
    need_ladder: b.needLadder,
    ladder_type: b.ladderType || null,
    ladder_hours: b.ladderHours ?? null,
    ladder_price: b.ladderPrice,
    customer_name: b.customerName,
    phone: b.phone,
    address: b.address,
    address_detail: b.addressDetail,
    memo: b.memo,
    status: b.status,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    has_elevator: b.hasElevator,
    has_parking: b.hasParking,
    has_ground_access: b.hasGroundAccess,
    estimate_min: b.estimateMin,
    estimate_max: b.estimateMax,
    final_price: b.finalPrice,
    photos: b.photos,
    admin_memo: b.adminMemo,
    confirmed_time: b.confirmedTime ?? null,
    confirmed_duration: b.confirmedDuration ?? null,
    completion_photos: b.completionPhotos || [],
    slack_thread_ts: b.slackThreadTs ?? null,
    driver_id: b.driverId ?? null,
    driver_name: b.driverName ?? null,
    source: b.source ?? null,
    total_loading_cube: b.totalLoadingCube ?? 0,
    latitude: b.latitude ?? null,
    longitude: b.longitude ?? null,
    route_order: b.routeOrder ?? null,
    agreed_to_terms: b.agreedToTerms ?? false,
    agreed_to_privacy: b.agreedToPrivacy ?? false,
    agreed_to_marketing: b.agreedToMarketing ?? false,
    agreed_to_night_notification: b.agreedToNightNotification ?? false,
  };
}

function partialToRow(updates: Partial<Booking>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(updates)) {
    const dbKey = FIELD_MAP[key];
    if (dbKey) row[dbKey] = val;
  }
  return row;
}

/* ── CRUD ── */

export async function getBookings(date?: string): Promise<Booking[]> {
  let query = supabase
    .from("bookings")
    .select("*")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (date) query = query.eq("date", date);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToBooking);
}

export async function getBookingById(
  id: string,
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .neq("status", "cancelled")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? rowToBooking(data) : null;
}

/** 관리자용: 취소된 건 포함하여 단건 조회 */
export async function getBookingByIdAdmin(
  id: string,
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? rowToBooking(data) : null;
}

export async function getBookingsByPhone(
  phone: string,
): Promise<Booking[]> {
  // 하이픈 포함/미포함 모두 검색 (포맷 불일치 방어)
  const digits = phone.replace(/[^\d]/g, "");
  const formatted =
    digits.length >= 10
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
      : phone;

  // .or() 문자열 직접 삽입 대신 .in() 사용 (PostgREST 주입 방지)
  const phoneVariants = [...new Set([formatted, digits])];
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .in("phone", phoneVariants)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToBooking);
}

export async function getAllBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToBooking);
}

/**
 * 상태별 주문 카운트 (대시보드 탭 배지용)
 * getAllBookings() 대비 전체 행 로드 없이 집계만 수행
 */
export async function getBookingStatusCounts(): Promise<Record<string, number>> {
  // limit 10000: Supabase 기본 1000행 제한 우회 (대시보드 탭 배지 정확도 보장)
  const { data, error } = await supabase
    .from("bookings")
    .select("status")
    .limit(10000);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const s = row.status as string;
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

export async function getBookingsByStatus(
  status: string,
): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToBooking);
}

export async function createBooking(booking: Booking): Promise<Booking> {
  const { data, error } = await supabase
    .from("bookings")
    .insert(bookingToRow(booking))
    .select()
    .single();

  if (error) throw error;
  return rowToBooking(data);
}

export async function updateBooking(
  id: string,
  updates: Partial<Booking>,
  expectedUpdatedAt?: string,
): Promise<Booking | null> {
  const row = {
    ...partialToRow(updates),
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from("bookings")
    .update(row)
    .eq("id", id);

  // Optimistic locking: only update if updated_at matches
  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { data, error } = await query.select().single();

  if (error) {
    if (error.code === "PGRST116") return null; // No rows matched
    throw error;
  }
  return data ? rowToBooking(data) : null;
}

export async function getBookingsPaginated(params: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ bookings: Booking[]; total: number }> {
  const { status, dateFrom, dateTo, search, page = 1, limit = 50 } = params;

  let query = supabase
    .from("bookings")
    .select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (dateFrom) query = query.gte("date", dateFrom);
  if (dateTo) query = query.lte("date", dateTo);
  if (search) {
    // 검색어 최대 100자 제한 + 특수문자 제거 (PostgREST injection 방지)
    const sanitized = search.slice(0, 100).replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s\-]/g, "").trim();
    if (sanitized) {
      const isIdLike = /^[0-9a-f-]{4,}$/i.test(sanitized);
      // Supabase .or() 필터: 각 컬럼을 별도 ilike 조건으로 구성
      const orParts = [
        `customer_name.ilike.%${sanitized}%`,
        `phone.ilike.%${sanitized}%`,
        `address.ilike.%${sanitized}%`,
      ];
      if (isIdLike) orParts.push(`id.ilike.${sanitized}%`);
      query = query.or(orParts.join(","));
    }
  }

  query = query
    .order("date", { ascending: true })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    bookings: (data || []).map(rowToBooking),
    total: count || 0,
  };
}

export async function deleteBooking(id: string): Promise<boolean> {
  const result = await updateBooking(id, { status: "cancelled" });
  return result !== null;
}

export async function getBookingPhonesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, phone")
    .in("id", ids);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.id as string, row.phone as string]));
}

/* ── Blocked Slots ── */

function rowToBlockedSlot(row: Record<string, unknown>): BlockedSlot {
  return {
    id: row.id as string,
    date: row.date as string,
    timeStart: row.time_start as string,
    timeEnd: row.time_end as string,
    reason: (row.reason as string) || undefined,
    createdBy: (row.created_by as string) || undefined,
    createdAt: (row.created_at as string) || undefined,
    driverId: (row.driver_id as string) || null,
  };
}

export async function getBlockedSlots(date: string, driverId?: string): Promise<BlockedSlot[]> {
  let query = supabase
    .from("blocked_slots")
    .select("*")
    .eq("date", date)
    .order("time_start", { ascending: true });

  if (driverId) query = query.eq("driver_id", driverId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToBlockedSlot);
}

export async function getBlockedSlotsRange(
  dateFrom: string,
  dateTo: string,
  driverId?: string,
): Promise<BlockedSlot[]> {
  let query = supabase
    .from("blocked_slots")
    .select("*")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true });

  if (driverId) query = query.eq("driver_id", driverId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToBlockedSlot);
}

export async function createBlockedSlot(
  slot: Omit<BlockedSlot, "id" | "createdAt">,
): Promise<BlockedSlot> {
  const { data, error } = await supabase
    .from("blocked_slots")
    .insert({
      date: slot.date,
      time_start: slot.timeStart,
      time_end: slot.timeEnd,
      reason: slot.reason || null,
      created_by: slot.createdBy || null,
      driver_id: slot.driverId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToBlockedSlot(data);
}

export async function deleteBlockedSlot(id: string): Promise<boolean> {
  const { error, count } = await supabase
    .from("blocked_slots")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) throw error;
  return (count ?? 0) > 0;
}

/* ── Drivers ── */

function rowToDriver(row: Record<string, unknown>): Driver {
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

/* ── 차량 (Vehicles) ── */

function rowToVehicle(row: Record<string, unknown>): Vehicle {
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
