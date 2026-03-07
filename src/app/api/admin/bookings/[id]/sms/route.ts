import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/app/api/admin/auth/route";
import { getBookingByIdAdmin } from "@/lib/db";
import { sendStatusSms, renderSmsTemplate, sendRawSms } from "@/lib/sms-notify";
import { sendErrorAlert } from "@/lib/slack-notify";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;

  // ?templateKey=xxx → 미리보기 본문 반환
  const previewKey = req.nextUrl.searchParams.get("templateKey");
  if (previewKey) {
    const booking = await getBookingByIdAdmin(id);
    if (!booking) {
      return NextResponse.json({ error: "예약을 찾을 수 없습니다" }, { status: 404 });
    }
    const body = renderSmsTemplate(previewKey, {
      finalPrice: booking.finalPrice ?? null,
      paymentUrl: null,
      date: booking.date ?? null,
      confirmedTime: booking.confirmedTime ?? null,
      phone: booking.phone ?? "",
    });
    return NextResponse.json({ body });
  }

  // templateKey 없으면 발송 이력 반환 (기존 동작)
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateToken(req)) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json();
  const { templateKey, customBody } = body as { templateKey: string; customBody?: string };

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

  // SMS 발송
  let smsError: string | null = null;
  try {
    if (customBody) {
      // 수정된 본문으로 직접 발송
      await sendRawSms(booking.phone, customBody, id);
    } else {
      // 기존 템플릿 발송 (하위 호환)
      await sendStatusSms(
        booking.phone,
        templateKey,
        id,
        booking.finalPrice ?? null,
        null,
        booking.date ?? null,
        booking.confirmedTime ?? null,
      );
    }
  } catch (err) {
    smsError = String(err);
    console.error("[sms/POST] SMS 발송 실패:", err);
    sendErrorAlert("POST /api/admin/bookings/[id]/sms", err, { bookingId: id, templateKey }).catch(() => {});
  }

  // 발송 이력 저장 (SMS 실패해도 이력은 기록 시도)
  if (!smsError) {
    const bodyPreview = customBody
      ? customBody.slice(0, 100)
      : `[${templateKey}] ${booking.customerName ?? ""}`.slice(0, 100);
    const { error: insertError } = await supabase.from("sms_log").insert({
      booking_id: id,
      phone: booking.phone,
      template_key: templateKey,
      body_preview: bodyPreview,
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
