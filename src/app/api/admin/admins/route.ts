import { NextRequest, NextResponse } from "next/server";
import { validateToken, getAdminFromToken } from "@/app/api/admin/auth/route";
import { getAdmins, updateAdminRole } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/admins — admin 역할 전용: 어드민 목록 조회
export async function GET(req: NextRequest) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { role } = getAdminFromToken(req);
  if (role !== "admin") {
    return NextResponse.json({ error: "admin 권한이 필요합니다" }, { status: 403 });
  }

  const admins = await getAdmins();
  return NextResponse.json({ admins });
}

// PATCH /api/admin/admins — admin 역할 전용: 역할 변경
export async function PATCH(req: NextRequest) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { role: requesterRole, adminId: requesterId } = getAdminFromToken(req);
  if (requesterRole !== "admin") {
    return NextResponse.json({ error: "admin 권한이 필요합니다" }, { status: 403 });
  }

  const body = await req.json();
  const { id, role } = body as { id?: string; role?: string };

  if (!id || !role || !["admin", "operator"].includes(role)) {
    return NextResponse.json({ error: "id, role(admin|operator) 필요" }, { status: 400 });
  }

  // 본인 계정은 변경 불가
  if (id === requesterId) {
    return NextResponse.json({ error: "본인 계정의 역할은 변경할 수 없습니다" }, { status: 422 });
  }

  const ok = await updateAdminRole(id, role as "admin" | "operator");
  if (!ok) {
    return NextResponse.json({ error: "역할 변경에 실패했습니다" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
