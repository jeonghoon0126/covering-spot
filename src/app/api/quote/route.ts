import { NextRequest, NextResponse } from "next/server";
import { calculateQuote } from "@/lib/quote-calculator";
import type { QuoteInput } from "@/types/booking";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QuoteInput;

    if (!body.area || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "지역과 품목을 선택해주세요" },
        { status: 400 },
      );
    }

    const result = calculateQuote(body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "견적 계산 실패", detail: String(e) },
      { status: 500 },
    );
  }
}
