import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { validateToken } from "@/app/api/admin/auth/route";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SendSchema = z.object({
  bookingId: z.string().regex(UUID_REGEX, "유효하지 않은 bookingId 형식입니다"),
  title: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  // url은 /로 시작하는 상대경로만 허용 (피싱 링크 삽입 방지)
  url: z.string().max(200).regex(/^\//, "url은 /로 시작하는 상대경로여야 합니다").optional(),
});

export async function POST(req: NextRequest) {
  try {
    // admin 토큰 검증 (HMAC) 또는 내부 호출 (x-internal-token)
    // ⚠️ ADMIN_PASSWORD 재사용 금지 — 별도 INTERNAL_PUSH_SECRET 환경변수 사용
    const internalSecret = process.env.INTERNAL_PUSH_SECRET;
    const isInternalCall = !!internalSecret && req.headers.get("x-internal-token") === internalSecret;
    if (!isInternalCall && !validateToken(req)) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
    }

    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { bookingId, title, message, url } = parsed.data;

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
