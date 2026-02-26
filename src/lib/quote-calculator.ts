import type { SpotArea, SpotLadder, SpotItem } from "@/lib/db";
import { enforceServerItems } from "@/lib/server-price";
import type { QuoteInput, QuoteResult } from "@/types/booking";

// 해체 작업이 필요할 수 있는 카테고리 (max 견적에 추가 10% 가산)
const DISASSEMBLY_CATEGORIES = ["장롱", "침대", "소파", "장식장", "거실장"];

// 인력 인원수 결정 기준 (품목 합계 기준, 운영팀 협의 수치)
const CREW_SIZE_2_THRESHOLD = 500_000;  // 50만원 이상 → 2인
const CREW_SIZE_3_THRESHOLD = 1_000_000; // 100만원 이상 → 3인

export function calculateQuote(
  input: QuoteInput,
  overrideCrewSize?: number,
  spotItems?: SpotItem[],
  areas?: SpotArea[],
  ladderPrices?: SpotLadder[],
): QuoteResult {
  // 1. 품목 단가를 서버 기준으로 덮어쓰기 (클라이언트 변조 방어)
  //    spotItems가 없으면 변조 방어 없이 클라이언트 값 사용 (레거시 호환)
  const secureItems = spotItems
    ? enforceServerItems(input.items, spotItems)
    : input.items.map((item) => ({
        ...item,
        displayName: item.displayName ?? item.name,
      }));

  // 1-1. 품목별 소계 계산
  const breakdown = secureItems.map((item) => ({
    name: `${item.category} - ${item.name}`,
    quantity: item.quantity,
    unitPrice: item.price,
    subtotal: item.price * item.quantity,
  }));

  const itemsTotal = breakdown.reduce((sum, b) => sum + b.subtotal, 0);

  // 2. 인력 수 자동 계산 (overrideCrewSize가 있으면 어드민 지정값 사용)
  let crewSize = overrideCrewSize ?? 1;
  if (!overrideCrewSize) {
    if (itemsTotal >= CREW_SIZE_3_THRESHOLD) crewSize = 3;
    else if (itemsTotal >= CREW_SIZE_2_THRESHOLD) crewSize = 2;
    else crewSize = 1;
  }

  // 3. 지역 단가로 인력비 계산
  const area = areas?.find((a) => a.name === input.area);
  let crewPrice = 0;
  let crewPrice1 = 0;
  if (area) {
    if (crewSize === 1) crewPrice = area.price1;
    else if (crewSize === 2) crewPrice = area.price2;
    else crewPrice = area.price3;
    crewPrice1 = area.price1;
  }

  // 4. 사다리차 비용
  let ladderPrice = 0;
  if (input.needLadder && input.ladderType && input.ladderHours != null && ladderPrices) {
    const ladderGroup = ladderPrices.filter((l) => l.type === input.ladderType);
    if (ladderGroup.length > 0) {
      const sorted = [...ladderGroup].sort((a, b) => a.sortOrder - b.sortOrder);
      const entry = sorted[input.ladderHours] ?? sorted[0];
      ladderPrice = entry?.price ?? 0;
    }
  }

  // 5. 총합
  const totalPrice = itemsTotal + crewPrice + ladderPrice;

  // 6. 견적 레인지 계산
  const estimateMin = itemsTotal + crewPrice1 + ladderPrice;
  let itemsTotalMax = itemsTotal * 1.15;
  const hasDisassemblyItem = secureItems.some((item) =>
    DISASSEMBLY_CATEGORIES.includes(item.category),
  );
  if (hasDisassemblyItem) {
    const disassemblyTotal = secureItems
      .filter((item) => DISASSEMBLY_CATEGORIES.includes(item.category))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    itemsTotalMax += disassemblyTotal * 0.1;
  }

  const estimateMaxRaw = Math.round(itemsTotalMax + crewPrice + ladderPrice);
  const estimateMinRounded = Math.floor(estimateMin / 10000) * 10000;
  const estimateMaxRounded = Math.ceil(estimateMaxRaw / 10000) * 10000;

  return {
    itemsTotal,
    crewSize,
    crewPrice,
    ladderPrice,
    totalPrice,
    estimateMin: estimateMinRounded,
    estimateMax: estimateMaxRounded,
    breakdown,
  };
}
