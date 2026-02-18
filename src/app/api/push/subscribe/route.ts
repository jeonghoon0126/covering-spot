import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, subscription } = body;

    if (!bookingId || !subscription?.endpoint) {
      return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
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
      console.error("Push subscription save error:", error);
      return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
