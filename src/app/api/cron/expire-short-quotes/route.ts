import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendStatusSms } from "@/lib/sms-notify";

/**
 * 견적 6시간 자동 취소 + 3시간 전 리마인드 Cron Job
 * - Vercel Cron: 매 30분마다 실행 (every 30 min)
 *
 * 처리 1) 6시간 취소
 *   - quote_confirmed + quote_confirmed_at < NOW() - 6h → cancelled + SMS(quote_expired)
 *
 * 처리 2) 3시간 리마인드 (30분 window)
 *   - quote_confirmed + quote_confirmed_at BETWEEN (NOW() - 3.5h) AND (NOW() - 3h)
 *   - SMS(quote_expiring) 발송, 상태 변경 없음
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();

    // ── 처리 1: 6시간 초과 자동 취소 ──────────────────────────────────────
    const cutoff6h = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const { data: expired, error: fetchError } = await supabase
      .from("bookings")
      .select("id, phone, date")
      .eq("status", "quote_confirmed")
      .not("quote_confirmed_at", "is", null)
      .lt("quote_confirmed_at", cutoff6h.toISOString());

    if (fetchError) {
      console.error("[cron/expire-short-quotes] 만료 조회 실패:", fetchError.message);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    let cancelledCount = 0;
    if (expired && expired.length > 0) {
      const ids = expired.map((b) => b.id);

      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: "cancelled", updated_at: now.toISOString() })
        .in("id", ids);

      if (updateError) {
        console.error("[cron/expire-short-quotes] 취소 업데이트 실패:", updateError.message);
      } else {
        cancelledCount = ids.length;
        for (const b of expired) {
          if (b.phone) {
            sendStatusSms(b.phone, "quote_expired", b.id).catch((err) =>
              console.error("[cron/expire-short-quotes] 취소 SMS 실패:", b.id, err?.message),
            );
          }
        }
        console.info(`[cron/expire-short-quotes] ${cancelledCount}건 6시간 자동 취소`);
      }
    }

    // ── 처리 2: 3시간 리마인드 (30분 window, 중복 방지) ──────────────────
    const reminderWindowEnd = new Date(now.getTime() - 3 * 60 * 60 * 1000);      // 3h 이상 경과
    const reminderWindowStart = new Date(now.getTime() - 3.5 * 60 * 60 * 1000);  // 3.5h 미만 경과

    const { data: reminders, error: reminderError } = await supabase
      .from("bookings")
      .select("id, phone")
      .eq("status", "quote_confirmed")
      .not("quote_confirmed_at", "is", null)
      .gte("quote_confirmed_at", reminderWindowStart.toISOString())
      .lt("quote_confirmed_at", reminderWindowEnd.toISOString());

    if (reminderError) {
      console.error("[cron/expire-short-quotes] 리마인드 조회 실패:", reminderError.message);
    }

    let remindedCount = 0;
    if (reminders && reminders.length > 0) {
      for (const b of reminders) {
        if (b.phone) {
          sendStatusSms(b.phone, "quote_expiring", b.id).catch((err) =>
            console.error("[cron/expire-short-quotes] 리마인드 SMS 실패:", b.id, err?.message),
          );
          remindedCount++;
        }
      }
      console.info(`[cron/expire-short-quotes] ${remindedCount}건 3시간 리마인드 SMS`);
    }

    return NextResponse.json({ cancelled: cancelledCount, reminded: remindedCount });
  } catch (e) {
    console.error("[cron/expire-short-quotes]", e);
    return NextResponse.json({ error: "cron 실행 실패" }, { status: 500 });
  }
}
