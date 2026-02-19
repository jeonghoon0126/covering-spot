import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBookingById } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, subscription } = body;

    if (!bookingId || !subscription?.endpoint) {
      return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
    }

    // bookingId가 실제 DB에 존재하는지 검증
    const booking = await getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "존재하지 않는 예약입니다" }, { status: 404 });
    }

    // upsert: 같은 booking + endpoint면 업데이트
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        booking_id: bookingId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      { onConflict: "booking_id,endpoint" },
    );

    if (error) {
      console.error("[push/subscribe]", error);
      return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/subscribe]", e);
    return NextResponse.json({ error: "구독 처리 실패" }, { status: 500 });
  }
}
