import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendStatusSms } from "@/lib/sms-notify";

/**
 * 견적 미확인 7일 자동 만료 Cron Job
 * - Vercel Cron: 매일 UTC 00:00 (KST 09:00) 실행
 * - quote_confirmed_at < NOW() - 7일 인 quote_confirmed 건 → cancelled
 * - 고객에게 SMS 발송
 */
export async function GET(req: NextRequest) {
  // CRON_SECRET 검증 (Vercel Cron 또는 수동 호출 인증)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // 7일 이상 경과한 quote_confirmed 예약 조회
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { data: expired, error: fetchError } = await supabase
      .from("bookings")
      .select("id, phone, customer_name")
      .eq("status", "quote_confirmed")
      .lt("quote_confirmed_at", cutoff.toISOString())
      .not("quote_confirmed_at", "is", null);

    if (fetchError) {
      console.error("[cron/expire-quotes] 조회 실패:", fetchError.message);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({ cancelled: 0 });
    }

    const ids = expired.map((b) => b.id);

    // 일괄 취소
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (updateError) {
      console.error("[cron/expire-quotes] 취소 업데이트 실패:", updateError.message);
      return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
    }

    // SMS 발송 (fire-and-forget)
    for (const b of expired) {
      if (b.phone) {
        sendStatusSms(b.phone, "quote_expired", b.id).catch((err) =>
          console.error("[cron/expire-quotes] SMS 실패:", b.id, err?.message),
        );
      }
    }

    console.info(`[cron/expire-quotes] ${expired.length}건 자동 취소 완료`);
    return NextResponse.json({ cancelled: expired.length, ids });
  } catch (e) {
    console.error("[cron/expire-quotes]", e);
    return NextResponse.json({ error: "cron 실행 실패" }, { status: 500 });
  }
}
