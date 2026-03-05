import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  headerBlock,
  sectionBlock,
  fieldsBlock,
  dividerBlock,
  actionButtonBlock,
} from "@/lib/slack-blocks";

const BASE_URL = "https://coveringspot.vercel.app";

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function formatManWon(n: number): string {
  return Math.round(n / 10000) + "만원";
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
 * - status IN (user_confirmed, in_progress) 이고 date = 내일인 건 → 요약 + 스레드 상세
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
      .select("id, customer_name, phone, address, date, time_slot, final_price, items")
      .in("status", ["user_confirmed", "in_progress"])
      .eq("date", tomorrowStr)
      .order("time_slot", { ascending: true });

    if (error) {
      console.error("[cron/tomorrow-pickup-slack] 조회 실패:", error.message);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const pickupChannel = process.env.SLACK_PICKUP_CHANNEL_ID;
    if (!pickupChannel) {
      console.error("[cron/tomorrow-pickup-slack] SLACK_PICKUP_CHANNEL_ID 미설정");
      return NextResponse.json({ error: "SLACK_PICKUP_CHANNEL_ID 미설정" }, { status: 500 });
    }

    // 예상 매출 합계
    const totalRevenue = data.reduce((s, b) => s + (b.final_price ?? 0), 0);

    // 요약 메시지
    const summaryBlocks = [
      headerBlock(`📦 내일(${tomorrowStr}) 수거 예정 ${data.length}건`),
      fieldsBlock([
        { label: "수거 건수", value: `${data.length}건` },
        { label: "예상 매출 합계", value: totalRevenue > 0 ? formatManWon(totalRevenue) : "미정" },
      ]),
      actionButtonBlock([
        { text: "어드민 바로가기", url: `${BASE_URL}/admin`, primary: true },
      ]),
    ];

    const summaryTs = await postSlack(summaryBlocks, undefined, pickupChannel);

    // 건별 스레드 상세
    for (const b of data) {
      const items = Array.isArray(b.items)
        ? (b.items as Array<{ category: string; name: string; quantity: number }>)
            .map((i) => `${i.category} ${i.name} x${i.quantity}`)
            .join(", ")
        : "-";

      const detailBlocks = [
        sectionBlock(
          `*${b.customer_name}* | ${b.phone}\n${b.address}\n${b.date} ${b.time_slot}`,
        ),
        fieldsBlock([
          { label: "확정 견적", value: b.final_price != null ? formatPrice(b.final_price) : "미정" },
          { label: "품목", value: items },
        ]),
        dividerBlock(),
        actionButtonBlock([
          { text: "상세 보기", url: `${BASE_URL}/admin/bookings/${b.id}`, primary: true },
        ]),
      ];

      await postSlack(detailBlocks, summaryTs ?? undefined, pickupChannel);
    }

    console.info(`[cron/tomorrow-pickup-slack] ${data.length}건 슬랙 알림 발송`);
    return NextResponse.json({ sent: data.length });
  } catch (e) {
    console.error("[cron/tomorrow-pickup-slack]", e);
    return NextResponse.json({ error: "cron 실행 실패" }, { status: 500 });
  }
}
