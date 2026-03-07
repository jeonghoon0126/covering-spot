import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  headerBlock,
  sectionBlock,
  dividerBlock,
  actionButtonBlock,
} from "@/lib/slack-blocks";
import { sendErrorAlert } from "@/lib/slack-notify";

const BASE_URL = "https://coveringspot.vercel.app";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Y8ztdzT-Y08-XOkKSX-jryLJFT4r1ID4nuzRcN9ddTU";

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+09:00");
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  return DAYS[d.getDay()];
}

async function postSlack(
  blocks: unknown[],
  threadTs?: string,
  channel?: string,
): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  const ch = channel ?? process.env.SLACK_CHANNEL_ID;
  if (!token || !ch) return null;

  try {
    const body: Record<string, unknown> = { channel: ch, blocks };
    if (threadTs) body.thread_ts = threadTs;

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return data.ok ? (data.ts as string) : null;
  } catch {
    return null;
  }
}

/**
 * 익일 수거 건 전일 오후 9시 슬랙 알림 Cron Job
 * - Vercel Cron: 매일 UTC 12:00 (KST 21:00) 실행
 * - status IN (quote_confirmed, in_progress) 이고 date = 내일인 건 → 단건시트 포맷으로 요약 + 스레드 상세
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
      .select("id, customer_name, phone, address, address_detail, date, time_slot, final_price, items, has_elevator, has_parking, memo, driver_name")
      .in("status", ["quote_confirmed", "in_progress"])
      .eq("date", tomorrowStr)
      .order("time_slot", { ascending: true });

    if (error) {
      console.error("[cron/tomorrow-pickup-slack] 조회 실패:", error.message);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // C0AENH7JW2Y = #pj_대형대량폐기물-수거-완료공유
    const pickupChannel = process.env.SLACK_PICKUP_CHANNEL_ID ?? "C0AENH7JW2Y";

    const totalRevenue = data.reduce((s, b) => s + (b.final_price ?? 0), 0);
    const dateStr = tomorrowStr.slice(5).replace("-", "/");
    const dow = getDayName(tomorrowStr);

    // 번호 목록 텍스트
    const listText = data.map((b, i) => {
      const time = b.time_slot ?? "미정";
      const price = b.final_price != null ? formatPrice(b.final_price) : "미정";
      return `${i + 1}. ${b.customer_name}  |  ${time}  |  ${price}`;
    }).join("\n");

    const summaryText = `총 ${data.length}건  |  예상 매출 ${formatPrice(totalRevenue)}\n\n${listText}`;

    const summaryBlocks = [
      headerBlock(`[방문 수거] ${dateStr}(${dow}) 수거 현황`),
      sectionBlock(summaryText),
      actionButtonBlock([
        { text: "시트 바로가기", url: SHEET_URL },
        { text: "어드민 바로가기", url: `${BASE_URL}/admin`, primary: true },
      ]),
    ];

    const summaryTs = await postSlack(summaryBlocks, undefined, pickupChannel);

    // 건별 스레드 상세
    for (const [i, b] of data.entries()) {
      const items = Array.isArray(b.items)
        ? (b.items as Array<{ category: string; name: string; quantity: number }>)
            .map((item) => `${item.category} ${item.name} x${item.quantity}`)
            .join(", ")
        : "-";

      const fullAddress = [b.address, b.address_detail].filter(Boolean).join(" ");
      const envLines = [
        b.has_elevator ? "엘리베이터 사용가능" : "엘리베이터 사용불가",
        b.has_parking ? "주차가능" : "주차불가",
      ].join("\n");

      const driverText = b.driver_name ? `@${b.driver_name}` : "미배차";

      const mainLines = [
        `*[${i + 1}/${data.length}] ${b.customer_name}*  ${driverText}`,
        ``,
        `수거 날짜: ${b.date.slice(5).replace("-", "/")}`,
        `수거 시간: ${b.time_slot ?? "미정"}`,
        `수거 장소: ${fullAddress}`,
        `특이사항: ${items}`,
        ...(b.memo ? [`메모: ${b.memo}`] : []),
        ``,
        envLines,
        `고객님 전화번호: ${b.phone}`,
        `최종정산금액: ${b.final_price != null ? formatPrice(b.final_price) : "미정"}`,
      ];

      const detailBlocks: unknown[] = [
        sectionBlock(mainLines.join("\n")),
        dividerBlock(),
        actionButtonBlock([
          { text: "상세 보기", url: `${BASE_URL}/admin/bookings/${b.id}`, primary: true },
        ]),
      ];

      await postSlack(detailBlocks, summaryTs ?? undefined, pickupChannel);
    }

    return NextResponse.json({ sent: data.length });
  } catch (e) {
    console.error("[cron/tomorrow-pickup-slack]", e);
    sendErrorAlert("GET /api/cron/tomorrow-pickup-slack", e).catch(() => {});
    return NextResponse.json({ error: "cron 실행 실패" }, { status: 500 });
  }
}
