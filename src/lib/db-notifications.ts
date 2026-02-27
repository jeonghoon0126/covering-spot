import { supabase } from "@/lib/supabase";

export interface AdminNotification {
  id: string;
  bookingId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  link: string;
  createdAt: string;
}

interface DbRow {
  id: string;
  booking_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  link: string;
  created_at: string;
}

function toNotification(row: DbRow): AdminNotification {
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    link: row.link,
    createdAt: row.created_at,
  };
}

/** 알림 생성 (fire-and-forget 용) */
export async function createAdminNotification(params: {
  bookingId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  const { error } = await supabase.from("admin_notifications").insert({
    booking_id: params.bookingId,
    type: params.type,
    title: params.title,
    body: params.body || "",
    link: params.link || `/admin/bookings/${params.bookingId}`,
  });
  if (error) console.error("[db-notifications] insert 실패:", error.message);
}

/** 알림 목록 조회 (최신순, 최대 100건) */
export async function getAdminNotifications(
  limit = 100,
  unreadOnly = false,
): Promise<AdminNotification[]> {
  let query = supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (unreadOnly) query = query.eq("is_read", false);
  const { data, error } = await query;
  if (error) {
    console.error("[db-notifications] 조회 실패:", error.message);
    return [];
  }
  return (data as DbRow[]).map(toNotification);
}

/** 읽지 않은 알림 수 */
export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("admin_notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) return 0;
  return count ?? 0;
}

/** 단건 읽음 처리 */
export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from("admin_notifications").update({ is_read: true }).eq("id", id);
}

/** 전체 읽음 처리 */
export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from("admin_notifications").update({ is_read: true }).eq("is_read", false);
}
