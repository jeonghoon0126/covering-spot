import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendDailyEventsReport } from "@/lib/slack-notify";

export async function GET(req: NextRequest) {
  // CRON_SECRET 검증
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // 어제 KST 기준 시작/끝 (UTC로 변환)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayKST = new Date(Math.floor((now.getTime() + kstOffset) / 86400000) * 86400000 - kstOffset);
    const yesterdayKST = new Date(todayKST.getTime() - 86400000);

    const from = yesterdayKST.toISOString();
    const to = todayKST.toISOString();

    // 이벤트별 카운트
    const { data: eventsRaw, error: eventsErr } = await supabase
      .from("spot_events")
      .select("event_name")
      .gte("created_at", from)
      .lt("created_at", to);

    if (eventsErr) throw eventsErr;

    // 메모리에서 집계
    const countMap: Record<string, number> = {};
    for (const row of eventsRaw ?? []) {
      countMap[row.event_name] = (countMap[row.event_name] ?? 0) + 1;
    }
    const events = Object.entries(countMap)
      .map(([event_name, cnt]) => ({ event_name, cnt }))
      .sort((a, b) => b.cnt - a.cnt);

    // 스텝별 카운트
    const { data: stepsRaw, error: stepsErr } = await supabase
      .from("spot_events")
      .select("properties")
      .eq("event_name", "[VIEW] SpotBookingScreen_step")
      .gte("created_at", from)
      .lt("created_at", to);

    if (stepsErr) throw stepsErr;

    const stepMap: Record<string, number> = {};
    for (const row of stepsRaw ?? []) {
      const step = (row.properties as Record<string, unknown>)?.step as string;
      if (step != null) stepMap[step] = (stepMap[step] ?? 0) + 1;
    }
    const steps = Object.entries(stepMap).map(([step, cnt]) => ({ step, cnt }));

    // KST 날짜 레이블
    const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
    const d = yesterdayKST;
    const dateLabel = `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")} (${DAYS[d.getUTCDay()]})`;

    await sendDailyEventsReport(dateLabel, events, steps);

    return NextResponse.json({ ok: true, date: dateLabel, eventCount: events.length });
  } catch (e) {
    console.error("[daily-events-report]", e);
    return NextResponse.json({ error: "report failed" }, { status: 500 });
  }
}
