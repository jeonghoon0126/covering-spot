import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendDailyEventsReport, sendErrorAlert } from "@/lib/slack-notify";

// 배너 타입별 Mixpanel where 절 (banner_id 정수 비교)
const POPUP_WHERE    = 'properties["banner_id"] == 48';   // 팝업: 방문수거_MVP
const BENEFIT_WHERE  = 'properties["banner_id"] == 41';   // 혜택: 방문수거 혜택배너
const CAROUSEL_WHERE = 'properties["banner_id"] == 47';   // 캐러셀: 방문수거 OPEN (카카오)

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

const SOURCE_LABELS: Record<string, string> = {
  home_bottom_sheet: "팝업",
  benefit_banner: "혜택배너",
};

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

    // Mixpanel 배너 3종 + Supabase 이벤트 병렬 조회
    const [popupBanner, benefitBanner, carouselBanner, eventsResult, stepsResult, funnelKakaoResult, sourceFunnelResult] = await Promise.all([
      getMixpanelBannerCount(dateStr, POPUP_WHERE),
      getMixpanelBannerCount(dateStr, BENEFIT_WHERE),
      getMixpanelBannerCount(dateStr, CAROUSEL_WHERE),
      supabase.from("spot_events").select("event_name").gte("created_at", from).lt("created_at", to),
      supabase.from("spot_events").select("properties").eq("event_name", "[VIEW] SpotBookingScreen_step").gte("created_at", from).lt("created_at", to),
      supabase.from("spot_events").select("id", { count: "exact", head: true }).eq("event_name", "[CLICK] SpotHomeScreen_cta").eq("properties->>location", "funnel").gte("created_at", from).lt("created_at", to),
      supabase.from("spot_events").select("event_name, properties").in("event_name", [
        "[ROUTE] SpotHomeScreen",
        "[CLICK] SpotHomeScreen_bookingBtn",
        "[ROUTE] SpotBookingScreen",
        "[EVENT] SpotBookingComplete",
      ]).gte("created_at", from).lt("created_at", to),
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

    const funnelKakao = funnelKakaoResult.count ?? 0;

    // 소스별 퍼널 집계 (배너 유입 소스 추적, 3/05 배포 이후 데이터)
    const sourceEventMap: Record<string, Record<string, number>> = {};
    for (const row of sourceFunnelResult.data ?? []) {
      const src = (row.properties as Record<string, unknown>)?.source as string;
      if (!src || src === "carousel_banner") continue; // 카카오 캐러셀은 웹 유입 없음
      if (!sourceEventMap[src]) sourceEventMap[src] = {};
      sourceEventMap[src][row.event_name] = (sourceEventMap[src][row.event_name] ?? 0) + 1;
    }
    const sourceFunnel = Object.entries(sourceEventMap).map(([src, counts]) => ({
      source: SOURCE_LABELS[src] ?? src,
      home: counts["[ROUTE] SpotHomeScreen"] ?? 0,
      bookingBtn: counts["[CLICK] SpotHomeScreen_bookingBtn"] ?? 0,
      bookingScreen: counts["[ROUTE] SpotBookingScreen"] ?? 0,
      complete: counts["[EVENT] SpotBookingComplete"] ?? 0,
    }));

    await sendDailyEventsReport(dateLabel, events, steps, popupBanner, benefitBanner, carouselBanner, funnelKakao, sourceFunnel);

    return NextResponse.json({ ok: true, date: dateLabel, popupBanner, benefitBanner, carouselBanner, funnelKakao, sourceFunnel });
  } catch (e) {
    console.error("[daily-events-report]", e);
    sendErrorAlert("GET /api/cron/daily-events-report", e).catch(() => {});
    return NextResponse.json({ error: "report failed" }, { status: 500 });
  }
}
