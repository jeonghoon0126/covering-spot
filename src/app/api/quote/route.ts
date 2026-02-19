import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateQuote } from "@/lib/quote-calculator";

const QuoteRequestSchema = z.object({
  area: z.string().min(1),
  items: z.array(z.object({
    category: z.string(),
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1).max(100),
    displayName: z.string().default(""),
  })).min(1),
  needLadder: z.boolean(),
  ladderType: z.string().optional(),
  ladderHours: z.number().int().min(0).max(10).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = QuoteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "지역과 품목을 선택해주세요" },
        { status: 400 },
      );
    }

    const result = calculateQuote(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[quote/POST]", e);
    return NextResponse.json(
      { error: "견적 계산 실패" },
      { status: 500 },
    );
  }
}
