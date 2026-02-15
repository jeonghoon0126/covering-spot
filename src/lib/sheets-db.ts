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
  estimateMin: "estimate_min",
  estimateMax: "estimate_max",
  finalPrice: "final_price",
  photos: "photos",
  adminMemo: "admin_memo",
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
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("phone", phone)
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
): Promise<Booking | null> {
  const row = {
    ...partialToRow(updates),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("bookings")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? rowToBooking(data) : null;
}

export async function deleteBooking(id: string): Promise<boolean> {
  const result = await updateBooking(id, { status: "cancelled" });
  return result !== null;
}
