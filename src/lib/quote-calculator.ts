import { SPOT_AREAS } from "@/data/spot-areas";
import { LADDER_PRICES } from "@/data/spot-ladder";
import type { QuoteInput, QuoteResult } from "@/types/booking";

export function calculateQuote(input: QuoteInput): QuoteResult {
  // 1. 품목별 소계 계산
  const breakdown = input.items.map((item) => ({
    name: item.displayName || `${item.category} - ${item.name}`,
    quantity: item.quantity,
    unitPrice: item.price,
    subtotal: item.price * item.quantity,
  }));

  const itemsTotal = breakdown.reduce((sum, b) => sum + b.subtotal, 0);

  // 2. 인력 수 자동 계산
  let crewSize = 1;
  if (itemsTotal >= 1000000) crewSize = 3;
  else if (itemsTotal >= 500000) crewSize = 2;

  // 3. 지역 단가로 인력비 계산
  const area = SPOT_AREAS.find((a) => a.name === input.area);
  let crewPrice = 0;
  if (area) {
    if (crewSize === 1) crewPrice = area.price1;
    else if (crewSize === 2) crewPrice = area.price2;
    else crewPrice = area.price3;
  }

  // 4. 사다리차 비용
  let ladderPrice = 0;
  if (input.needLadder && input.ladderType && input.ladderHours != null) {
    const ladder = LADDER_PRICES.find((l) => l.type === input.ladderType);
    if (ladder) {
      const priceEntry = ladder.prices[input.ladderHours] || ladder.prices[0];
      ladderPrice = priceEntry?.price || 0;
    }
  }

  // 5. 총합
  const totalPrice = itemsTotal + crewPrice + ladderPrice;

  return {
    itemsTotal,
    crewSize,
    crewPrice,
    ladderPrice,
    totalPrice,
    breakdown,
  };
}
