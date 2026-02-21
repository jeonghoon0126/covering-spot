import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateToken } from "@/app/api/admin/auth/route";

export async function POST(req: NextRequest) {
  try {
    // admin 토큰 검증 (HMAC) 또는 내부 호출 (x-internal-token)
    // ⚠️ ADMIN_PASSWORD 재사용 금지 — 별도 INTERNAL_PUSH_SECRET 환경변수 사용
    const internalSecret = process.env.INTERNAL_PUSH_SECRET;
    const isInternalCall = !!internalSecret && req.headers.get("x-internal-token") === internalSecret;
    if (!isInternalCall && !validateToken(req)) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const body = await req.json();
    const { bookingId, title, message, url } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId 필수" }, { status: 400 });
    }

    // 구독 조회
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("booking_id", bookingId);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: "VAPID 키 미설정" }, { status: 500 });
    }

    // Dynamic import to avoid build issues when web-push is not available
    const webpush = await import("web-push");
    webpush.setVapidDetails(
      "mailto:admin@covering.co.kr",
      vapidPublicKey,
      vapidPrivateKey,
    );

    const payload = JSON.stringify({
      title: title || "커버링 방문수거",
      body: message || "예약 상태가 변경되었습니다",
      url: url || `/booking/manage`,
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
        );
        sent++;
      } catch {
        // 만료된 구독 삭제
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
      }
    }

    return NextResponse.json({ sent });
  } catch (e) {
    console.error("[push/send]", e);
    return NextResponse.json({ error: "푸시 발송 실패" }, { status: 500 });
  }
}
