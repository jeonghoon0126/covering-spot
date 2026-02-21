import { NextRequest, NextResponse } from "next/server";
import { validateDriverToken } from "@/lib/driver-auth";
import { supabase } from "@/lib/supabase";
import { sendStatusSms } from "@/lib/sms-notify";

// 드라이버가 직접 변경 가능한 상태 전환만 허용
const ALLOWED_TRANSITIONS: Record<string, string> = {
  quote_confirmed: "in_progress",  // 수거 시작
  in_progress: "completed",        // 수거 완료
};

/**
 * PUT /api/driver/bookings/[id]
 * 드라이버 본인의 예약 상태만 업데이트 가능
 * 허용 전환: quote_confirmed → in_progress, in_progress → completed
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = validateDriverToken(req);
  if (!auth) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const newStatus = body?.status;
  if (!newStatus || typeof newStatus !== "string") {
    return NextResponse.json({ error: "상태값이 필요합니다" }, { status: 400 });
  }

  // 허용된 목표 상태인지 확인
  const validTargets = Object.values(ALLOWED_TRANSITIONS);
  if (!validTargets.includes(newStatus)) {
    return NextResponse.json({ error: "변경 불가능한 상태입니다" }, { status: 403 });
  }

  // 현재 예약 조회 (소유권 + 현재 상태 + 고객 전화번호 확인)
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, status, driver_id, phone")
    .eq("id", id)
    .single();

  if (fetchError || !booking) {
    return NextResponse.json({ error: "예약을 찾을 수 없습니다" }, { status: 404 });
  }

  // 본인 예약인지 확인 (소유권 검사)
  if (booking.driver_id !== auth.driverId) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  // 상태 전환 유효성 검사 (현재 상태 기준)
  const allowedNext = ALLOWED_TRANSITIONS[booking.status as string];
  if (allowedNext !== newStatus) {
    return NextResponse.json(
      { error: `현재 상태(${booking.status})에서 ${newStatus}로 변경할 수 없습니다` },
      { status: 409 },
    );
  }

  // TOCTOU 방지: UPDATE에 driver_id + status 조건을 추가하여 DB 레벨에서 atomic하게 처리
  // → SELECT와 UPDATE 사이에 재배차나 중복 요청이 발생해도 의도치 않은 상태 전환 방지
  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("driver_id", auth.driverId)   // DB 레벨 소유권 재확인
    .eq("status", booking.status)      // DB 레벨 현재 상태 재확인 (낙관적 잠금)
    .select("id, status")
    .single();

  if (updateError || !updated) {
    // PGRST116 = no rows matched → 다른 요청이 먼저 처리했거나 재배차된 경우
    if (updateError?.code === "PGRST116") {
      return NextResponse.json(
        { error: "다른 요청이 먼저 처리되었습니다. 새로고침 후 다시 시도해주세요." },
        { status: 409 },
      );
    }
    console.error("[driver/bookings PUT]", updateError);
    return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
  }

  // 고객 SMS 발송 (fire-and-forget: SMS 실패가 응답을 막지 않음)
  if (booking.phone) {
    sendStatusSms(booking.phone, newStatus, id).catch((err) => {
      console.error("[SMS 발송 실패]", { bookingId: id, status: newStatus, error: err?.message });
    });
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
