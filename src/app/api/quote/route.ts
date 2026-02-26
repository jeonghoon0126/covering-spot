import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateQuote } from "@/lib/quote-calculator";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getSpotItems, getSpotAreas, getSpotLadder } from "@/lib/db";

const QuoteRequestSchema = z.object({
  area: z.string().min(1),
  items: z.array(z.object({
    category: z.string(),
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1).max(100),
    displayName: z.string().default(""),
    loadingCube: z.number().min(0).default(0),
  })).min(1),
  needLadder: z.boolean(),
  ladderType: z.string().optional(),
  ladderHours: z.number().int().min(0).max(10).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 30 requests per IP per 60s
    const ip = getRateLimitKey(req);
    const rl = rateLimit(`${ip}:/api/quote/POST`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해주세요", retryAfter: rl.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfter) },
        },
      );
    }

    const body = await req.json();
    const parsed = QuoteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "지역과 품목을 선택해주세요" },
        { status: 400 },
      );
    }

    const [spotItems, areas, ladderPrices] = await Promise.all([
      getSpotItems(true),
      getSpotAreas(true),
      getSpotLadder(),
    ]);
    const result = calculateQuote(parsed.data, undefined, spotItems, areas, ladderPrices);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[quote/POST]", e);
    return NextResponse.json(
      { error: "견적 계산 실패" },
      { status: 500 },
    );
  }
}
