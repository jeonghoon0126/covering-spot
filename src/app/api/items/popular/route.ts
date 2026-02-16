import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface ItemEntry {
  category: string;
  name: string;
}

interface PopularItem extends ItemEntry {
  count: number;
}

export async function GET() {
  try {
    // 3개월 전 날짜 계산
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const since = threeMonthsAgo.toISOString();

    // 실제 예약 데이터에서 items 컬럼만 조회
    // 유효한 상태: 견적확정 ~ 결제완료 (취소/거절/대기 제외)
    const { data, error } = await supabase
      .from("bookings")
      .select("items")
      .in("status", [
        "quote_confirmed",
        "in_progress",
        "completed",
        "payment_requested",
        "payment_completed",
      ])
      .gte("created_at", since);

    if (error || !data) {
      return NextResponse.json({ items: [] });
    }

    // {category, name} 쌍별 빈도 집계
    const freq = new Map<string, PopularItem>();

    for (const row of data) {
      const items = row.items as ItemEntry[] | null;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (!item.category || !item.name) continue;
        const key = `${item.category}::${item.name}`;
        const existing = freq.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          freq.set(key, {
            category: item.category,
            name: item.name,
            count: 1,
          });
        }
      }
    }

    // count 내림차순 정렬 후 상위 12개
    const topItems = Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return NextResponse.json({ items: topItems });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
