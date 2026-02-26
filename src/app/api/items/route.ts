import { NextResponse } from "next/server";
import { getSpotItems } from "@/lib/db";

export async function GET() {
  try {
    const items = await getSpotItems(true);
    // 기존 클라이언트 호환성 유지: SpotCategory[] 형태로 반환
    const categoryMap = new Map<string, { name: string; items: typeof items }>();
    for (const item of items) {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, { name: item.category, items: [] });
      }
      categoryMap.get(item.category)!.items.push(item);
    }
    const categories = Array.from(categoryMap.values());
    return NextResponse.json({ categories });
  } catch (e) {
    console.error("[items/GET]", e);
    return NextResponse.json({ error: "품목 조회 실패" }, { status: 500 });
  }
}
