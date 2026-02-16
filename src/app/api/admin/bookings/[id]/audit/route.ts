import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/app/api/admin/auth/route";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateToken(req)) {
    return NextResponse.json(
      { error: "인증이 필요합니다" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, admin_email, action, details, created_at")
    .eq("booking_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "조회 실패", detail: String(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ logs: data || [] });
}
