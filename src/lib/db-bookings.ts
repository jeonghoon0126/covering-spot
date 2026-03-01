import { supabase } from "@/lib/supabase";
import type { Booking } from "@/types/booking";

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
  preferredSlots: "preferred_slots",
  quoteConfirmedAt: "quote_confirmed_at",
};

export function rowToBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    date: row.date as string,
    timeSlot: row.time_slot as string,
    area: row.area as string,
    items: (row.items as Booking["items"]) ?? [],
    totalPrice: (row.total_price as number) ?? 0,
    crewSize: (row.crew_size as number) ?? 1,
    needLadder: (row.need_ladder as boolean) ?? false,
    ladderType: (row.ladder_type as string) ?? undefined,
    ladderHours:
      row.ladder_hours != null ? (row.ladder_hours as number) : undefined,
    ladderPrice: (row.ladder_price as number) ?? 0,
    customerName: row.customer_name as string,
    phone: row.phone as string,
    address: row.address as string,
    addressDetail: (row.address_detail as string) ?? "",
    memo: (row.memo as string) ?? "",
    status: (row.status as Booking["status"]) ?? "pending",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    hasElevator: (row.has_elevator as boolean) ?? false,
    hasParking: (row.has_parking as boolean) ?? false,
    hasGroundAccess: (row.has_ground_access as boolean) ?? false,
    estimateMin: (row.estimate_min as number) ?? 0,
    estimateMax: (row.estimate_max as number) ?? 0,
    finalPrice:
      row.final_price != null ? (row.final_price as number) : null,
    photos: (row.photos as string[]) ?? [],
    adminMemo: (row.admin_memo as string) ?? "",
    confirmedTime: (row.confirmed_time as string) ?? null,
    confirmedDuration: row.confirmed_duration != null ? (row.confirmed_duration as number) : null,
    completionPhotos: (row.completion_photos as string[]) ?? [],
    slackThreadTs: (row.slack_thread_ts as string) ?? null,
    driverId: (row.driver_id as string) ?? null,
    driverName: (row.driver_name as string) ?? null,
    source: (row.source as string) ?? null,
    totalLoadingCube: (row.total_loading_cube as number) ?? 0,
    latitude: row.latitude != null ? (row.latitude as number) : null,
    longitude: row.longitude != null ? (row.longitude as number) : null,
    routeOrder: row.route_order != null ? (row.route_order as number) : null,
    unloadingStopAfter: (row.unloading_stop_after as string) ?? null,
    agreedToTerms: (row.agreed_to_terms as boolean) ?? false,
    agreedToPrivacy: (row.agreed_to_privacy as boolean) ?? false,
    agreedToMarketing: (row.agreed_to_marketing as boolean) ?? false,
    agreedToNightNotification: (row.agreed_to_night_notification as boolean) ?? false,
    preferredSlots: (row.preferred_slots as string[]) ?? [],
    quoteConfirmedAt: (row.quote_confirmed_at as string) ?? null,
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
    preferred_slots: b.preferredSlots ?? [],
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
    .neq("status", "cancelled")
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
  // Supabase RPC로 SQL GROUP BY 집계 (전체 행 로드 대신 집계만 수행)
  const { data, error } = await supabase.rpc("get_booking_status_counts");

  if (error) {
    console.error("[getBookingStatusCounts] RPC 실패, 폴백:", error.message);
    // 폴백: 기존 방식 (RPC 함수가 아직 배포 안 된 환경)
    const { data: fallback, error: fbErr } = await supabase
      .from("bookings")
      .select("status")
      .limit(10000);
    if (fbErr) throw fbErr;
    const counts: Record<string, number> = {};
    for (const row of fallback || []) {
      const s = row.status as string;
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }

  const counts: Record<string, number> = {};
  for (const row of (data || []) as { status: string; count: number }[]) {
    counts[row.status] = Number(row.count);
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
