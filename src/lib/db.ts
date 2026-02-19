import { supabase } from "@/lib/supabase";
import type { Booking } from "@/types/booking";

export interface BlockedSlot {
  id?: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  reason?: string;
  createdBy?: string;
  createdAt?: string;
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

export async function getBookingsByPhone(
  phone: string,
): Promise<Booking[]> {
  // 하이픈 포함/미포함 모두 검색 (포맷 불일치 방어)
  const digits = phone.replace(/[^\d]/g, "");
  const formatted =
    digits.length >= 10
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
      : phone;

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .or(`phone.eq.${formatted},phone.eq.${digits}`)
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
    // PostgREST 필터 injection 방지: 특수문자 제거
    const sanitized = search.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s\-]/g, "");
    if (sanitized) {
      query = query.or(
        `customer_name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%,address.ilike.%${sanitized}%`,
      );
    }
  }

  query = query
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
  };
}

export async function getBlockedSlots(date: string): Promise<BlockedSlot[]> {
  const { data, error } = await supabase
    .from("blocked_slots")
    .select("*")
    .eq("date", date)
    .order("time_start", { ascending: true });

  if (error) throw error;
  return (data || []).map(rowToBlockedSlot);
}

export async function getBlockedSlotsRange(
  dateFrom: string,
  dateTo: string,
): Promise<BlockedSlot[]> {
  const { data, error } = await supabase
    .from("blocked_slots")
    .select("*")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true });

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
    })
    .select()
    .single();

  if (error) throw error;
  return rowToBlockedSlot(data);
}

export async function deleteBlockedSlot(id: string): Promise<boolean> {
  const { error, count } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return (count ?? 1) > 0;
}
