import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getBookingById } from "@/lib/db";
import { validateBookingToken } from "@/lib/booking-token";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SubscribeSchema = z.object({
  bookingId: z.string().regex(UUID_REGEX, "유효하지 않은 bookingId 형식입니다"),
  subscription: z.object({
    endpoint: z.string().url("유효하지 않은 endpoint URL입니다").max(2048),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(64),
    }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
    }

    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { bookingId, subscription } = parsed.data;

    // bookingId가 실제 DB에 존재하는지 검증
    const booking = await getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "존재하지 않는 예약입니다" }, { status: 404 });
    }

    // 토큰 검증: phone 기반 토큰이 일치해야 구독 가능
    if (!validateBookingToken(req, booking.phone)) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
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
