import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/app/api/admin/auth/route";
import {
  getAdminNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/db";

/** GET /api/admin/notifications — 알림 목록 + 읽지 않은 건수 */
export async function GET(req: NextRequest) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";
  const [notifications, unreadCount] = await Promise.all([
    getAdminNotifications(100, unreadOnly),
    getUnreadNotificationCount(),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

/** PATCH /api/admin/notifications — 단건 읽음 처리 */
export async function PATCH(req: NextRequest) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id 필요" }, { status: 400 });
  }

  await markNotificationRead(id);
  return NextResponse.json({ ok: true });
}

/** PUT /api/admin/notifications — 전체 읽음 처리 */
export async function PUT(req: NextRequest) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  await markAllNotificationsRead();
  return NextResponse.json({ ok: true });
}
