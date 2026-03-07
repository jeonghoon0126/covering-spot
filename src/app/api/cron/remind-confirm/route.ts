import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendStatusSms } from "@/lib/sms-notify";
import { sendErrorAlert } from "@/lib/slack-notify";

/**
 * 수거 전날 오후 6시 리마인드 Cron Job
 * - Vercel Cron: 매일 UTC 09:00 (KST 18:00) 실행
 * - status = quote_confirmed 이고 date = 내일인 건 → 리마인드 SMS
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("bookings")
      .select("id, phone, date")
      .in("status", ["quote_confirmed", "in_progress"])
      .eq("date", tomorrowStr)
      .neq("source", "sheet");

    if (error) {
      console.error("[cron/remind-confirm] 조회 실패:", error.message);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    for (const b of data) {
      if (b.phone) {
        sendStatusSms(b.phone, "remind_pickup", b.id, null, null, b.date).catch((err) =>
          console.error("[cron/remind-confirm] SMS 실패:", b.id, err?.message),
        );
      }
    }

    console.info(`[cron/remind-confirm] ${data.length}건 리마인드 SMS 발송`);
    return NextResponse.json({ sent: data.length });
  } catch (e) {
    console.error("[cron/remind-confirm]", e);
    sendErrorAlert("GET /api/cron/remind-confirm", e).catch(() => {});
    return NextResponse.json({ error: "cron 실행 실패" }, { status: 500 });
  }
}
