import { supabase } from "@/lib/supabase";

/* ── 단가 테이블 타입 ── */

export interface SpotItem {
  id: string;
  category: string;
  name: string;
  displayName: string;
  price: number;
  loadingCube: number;
  active: boolean;
}

export interface SpotArea {
  id: string;
  name: string;
  price1: number;
  price2: number;
  price3: number;
  active: boolean;
}

export interface SpotLadder {
  id: string;
  type: string;
  duration: string;
  price: number;
  sortOrder: number;
}

export interface SpotItemAlias {
  id: string;
  alias: string;
  category: string;
  name: string;
}

/* ── 단가 조회 함수 ── */

export async function getSpotItems(activeOnly = true): Promise<SpotItem[]> {
  let query = supabase.from("spot_items").select("*").order("category").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    name: r.name,
    displayName: r.display_name,
    price: r.price,
    loadingCube: Number(r.loading_cube),
    active: r.active,
  }));
}

export async function getSpotAreas(activeOnly = true): Promise<SpotArea[]> {
  let query = supabase.from("spot_areas").select("*").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    price1: r.price1,
    price2: r.price2,
    price3: r.price3,
    active: r.active,
  }));
}

export async function getSpotLadder(): Promise<SpotLadder[]> {
  const { data, error } = await supabase
    .from("spot_ladder")
    .select("*")
    .order("type")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    duration: r.duration,
    price: r.price,
    sortOrder: r.sort_order,
  }));
}

export async function getSpotItemAliases(): Promise<SpotItemAlias[]> {
  const { data, error } = await supabase
    .from("spot_item_aliases")
    .select("*")
    .order("alias");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    alias: r.alias,
    category: r.category,
    name: r.name,
  }));
}

/* ── Blocked Slots ── */

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
