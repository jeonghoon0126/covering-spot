import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/app/api/admin/auth/route";
import { getBookingByIdAdmin } from "@/lib/db";
import { sendStatusSms } from "@/lib/sms-notify";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { id } = params;

  const { data, error } = await supabase
    .from("sms_log")
    .select("*")
    .eq("booking_id", id)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[sms/GET] 조회 실패:", error.message);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { id } = params;

  const body = await req.json();
  const { templateKey } = body as { templateKey: string };

  if (!templateKey?.trim()) {
    return NextResponse.json({ error: "templateKey가 필요합니다" }, { status: 400 });
  }

  const booking = await getBookingByIdAdmin(id);
  if (!booking) {
    return NextResponse.json({ error: "예약을 찾을 수 없습니다" }, { status: 404 });
  }
  if (!booking.phone) {
    return NextResponse.json({ error: "전화번호가 없습니다" }, { status: 400 });
  }

  // SMS 발송 (sendStatusSms가 templateKey를 STATUS_TEMPLATES에서 조회함)
  let smsError: string | null = null;
  try {
    await sendStatusSms(
      booking.phone,
      templateKey,
      id,
      booking.finalPrice ?? null,
      null,
      booking.date ?? null,
      booking.confirmedTime ?? null,
    );
  } catch (err) {
    smsError = String(err);
    console.error("[sms/POST] SMS 발송 실패:", err);
  }

  // 발송 이력 저장 (SMS 실패해도 이력은 기록 시도)
  if (!smsError) {
    const { error: insertError } = await supabase.from("sms_log").insert({
      booking_id: id,
      phone: booking.phone,
      template_key: templateKey,
      body_preview: `[${templateKey}] ${booking.customerName ?? ""}`.slice(0, 100),
      sent_by: "admin",
    });
    if (insertError) {
      console.error("[sms/POST] sms_log 저장 실패:", insertError.message);
    }
  }

  if (smsError) {
    return NextResponse.json({ error: "SMS 발송 실패", detail: smsError }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
