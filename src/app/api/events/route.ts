import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { trackServer } from "@/lib/analytics";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getRateLimitKey(req);
    const rl = rateLimit(`${ip}:/api/events/POST`, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }

    const body = await req.json();
    const { event, properties } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    // fire-and-forget: 에러가 나도 200 반환 (클라이언트 추적에 영향 없도록)
    supabase
      .from("spot_events")
      .insert({ event_name: event, properties: properties || {} })
      .then(({ error }) => {
        if (error) console.error("[events] insert 실패:", error.message);
      });

    // Mixpanel 이중 안전장치: 클라이언트 초기화 실패 시에도 서버 경유로 전송
    trackServer(event, properties || {}).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
