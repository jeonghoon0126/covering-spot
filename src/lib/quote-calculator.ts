import { SPOT_AREAS } from "@/data/spot-areas";
import { LADDER_PRICES } from "@/data/spot-ladder";
import type { QuoteInput, QuoteResult } from "@/types/booking";

// 해체 작업이 필요할 수 있는 카테고리 (max 견적에 추가 20% 가산)
const DISASSEMBLY_CATEGORIES = ["장롱", "침대", "소파", "장식장", "거실장"];

export function calculateQuote(input: QuoteInput): QuoteResult {
  // 1. 품목별 소계 계산
  const breakdown = input.items.map((item) => ({
    name: `${item.category} - ${item.name}`,
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
  let crewPrice1 = 0; // 1인 기준 인력비 (estimateMin용)
  if (area) {
    if (crewSize === 1) crewPrice = area.price1;
    else if (crewSize === 2) crewPrice = area.price2;
    else crewPrice = area.price3;
    crewPrice1 = area.price1;
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

  // 6. 견적 레인지 계산
  // estimateMin = 품목합계 + 인력비(1인 기준) + 사다리차
  const estimateMin = itemsTotal + crewPrice1 + ladderPrice;

  // estimateMax = 품목합계 * 1.15 + 해체 품목 추가 10% (가산 방식)
  // 기존: 1.2 * 1.2 = 1.44x (과도한 범위) → 변경: 1.15 + 해체분 0.1 (합리적 범위)
  let itemsTotalMax = itemsTotal * 1.15;

  // 해체 가능 카테고리 품목이 있으면 해당 품목 금액의 10%만 추가 가산
  const hasDisassemblyItem = input.items.some((item) =>
    DISASSEMBLY_CATEGORIES.includes(item.category),
  );
  if (hasDisassemblyItem) {
    const disassemblyTotal = input.items
      .filter((item) => DISASSEMBLY_CATEGORIES.includes(item.category))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    itemsTotalMax += disassemblyTotal * 0.1;
  }

  const estimateMax = Math.round(itemsTotalMax + crewPrice + ladderPrice);

  return {
    itemsTotal,
    crewSize,
    crewPrice,
    ladderPrice,
    totalPrice,
    estimateMin,
    estimateMax,
    breakdown,
  };
}
