import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendDailyEventsReport } from "@/lib/slack-notify";

// 배너 타입별 where 절
// 방문수거 MVP 배너: 혜택탭/홈탭에 노출, 랜딩 페이지로 이동
const MVP_BANNER_WHERE = 'properties["banner_title"] == "방문수거 MVP"';

// 캐러셀 배너: 홈 화면 캐러셀, 카카오톡 채널로 이동 (Popup/Benefit 제외)
const NON_CAROUSEL_TITLES = [
  "방문수거 MVP", "방문 수거",
  "커버링 구독", "친구 초대", "등급제 쿠폰", "기본요금 0원", "5% 쿠폰 지급", "8kg 초과 배출",
  "신규 지역 오픈",
];
const CAROUSEL_WHERE = [
  'not (properties["banner_id"] == "40")',
  ...NON_CAROUSEL_TITLES.map((t) => `properties["banner_title"] != "${t}"`),
].join(" and ");

/** Mixpanel Segmentation API로 배너 클릭 수 조회 */
async function getMixpanelBannerCount(dateStr: string, where: string): Promise<number> {
  const apiSecret = process.env.MIXPANEL_API_SECRET;
  if (!apiSecret) return 0;

  try {
    const auth = Buffer.from(`${apiSecret.trim()}:`).toString("base64");
    const params = new URLSearchParams({
      project_id: "3160293",
      event: "[CLICK] Banner_click",
      from_date: dateStr,
      to_date: dateStr,
      where,
      type: "general",
    });

    const res = await fetch(`https://mixpanel.com/api/2.0/segmentation?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return 0;

    const data = await res.json() as {
      data?: { values?: Record<string, Record<string, number>> };
    };
    const values = data?.data?.values?.["[CLICK] Banner_click"];
    if (!values) return 0;

    return Object.values(values).reduce((sum, v) => sum + v, 0);
  } catch {
    return 0;
  }
}

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

    // KST 날짜 레이블 (yesterdayKST는 UTC 기준이므로 +9h 후 날짜 추출)
    const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
    const dKST = new Date(yesterdayKST.getTime() + kstOffset);
    const dateLabel = `${String(dKST.getUTCMonth() + 1).padStart(2, "0")}/${String(dKST.getUTCDate()).padStart(2, "0")} (${DAYS[dKST.getUTCDay()]})`;
    const dateStr = `${dKST.getUTCFullYear()}-${String(dKST.getUTCMonth() + 1).padStart(2, "0")}-${String(dKST.getUTCDate()).padStart(2, "0")}`;

    // Mixpanel 배너 2종 + Supabase 이벤트 병렬 조회
    const [mvpBanner, carouselBanner, eventsResult, stepsResult] = await Promise.all([
      getMixpanelBannerCount(dateStr, MVP_BANNER_WHERE),
      getMixpanelBannerCount(dateStr, CAROUSEL_WHERE),
      supabase.from("spot_events").select("event_name").gte("created_at", from).lt("created_at", to),
      supabase.from("spot_events").select("properties").eq("event_name", "[VIEW] SpotBookingScreen_step").gte("created_at", from).lt("created_at", to),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (stepsResult.error) throw stepsResult.error;

    // 이벤트별 카운트
    const countMap: Record<string, number> = {};
    for (const row of eventsResult.data ?? []) {
      countMap[row.event_name] = (countMap[row.event_name] ?? 0) + 1;
    }
    const events = Object.entries(countMap)
      .map(([event_name, cnt]) => ({ event_name, cnt }))
      .sort((a, b) => b.cnt - a.cnt);

    // 스텝별 카운트
    const stepMap: Record<string, number> = {};
    for (const row of stepsResult.data ?? []) {
      const step = (row.properties as Record<string, unknown>)?.step as string;
      if (step != null) stepMap[step] = (stepMap[step] ?? 0) + 1;
    }
    const steps = Object.entries(stepMap).map(([step, cnt]) => ({ step, cnt }));

    await sendDailyEventsReport(dateLabel, events, steps, mvpBanner, carouselBanner);

    return NextResponse.json({ ok: true, date: dateLabel, mvpBanner, carouselBanner });
  } catch (e) {
    console.error("[daily-events-report]", e);
    return NextResponse.json({ error: "report failed" }, { status: 500 });
  }
}
