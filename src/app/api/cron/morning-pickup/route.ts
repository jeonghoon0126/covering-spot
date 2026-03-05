import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendStatusSms } from "@/lib/sms-notify";

/**
 * 수거 당일 오전 8시 출발 알림 Cron Job
 * - Vercel Cron: 매일 UTC 23:00 (KST 08:00 다음날) 실행
 * - status IN (user_confirmed, in_progress) 이고 date = 내일(UTC 기준 = KST 오늘) 인 건 → 출발 알림 SMS
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
    // UTC 23:00 기준 내일 = KST 08:00 기준 오늘
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("bookings")
      .select("id, phone, date")
      .in("status", ["user_confirmed", "in_progress"])
      .eq("date", tomorrowStr);

    if (error) {
      console.error("[cron/morning-pickup] 조회 실패:", error.message);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    for (const b of data) {
      if (b.phone) {
        sendStatusSms(b.phone, "morning_pickup", b.id, null, null, b.date).catch((err) =>
          console.error("[cron/morning-pickup] SMS 실패:", b.id, err?.message),
        );
      }
    }

    console.info(`[cron/morning-pickup] ${data.length}건 당일 알림 SMS 발송`);
    return NextResponse.json({ sent: data.length });
  } catch (e) {
    console.error("[cron/morning-pickup]", e);
    return NextResponse.json({ error: "cron 실행 실패" }, { status: 500 });
  }
}
