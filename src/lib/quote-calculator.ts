import type { SpotArea, SpotLadder, SpotItem } from "@/lib/db";
import { enforceServerItems } from "@/lib/server-price";
import { extractWeight } from "@/lib/booking-utils";
import type { BookingItem, QuoteInput, QuoteResult } from "@/types/booking";

// 해체 작업이 필요할 수 있는 카테고리 (max 견적에 추가 10% 가산)
const DISASSEMBLY_CATEGORIES = ["장롱", "침대", "소파", "장식장", "거실장"];

// 인력 인원수 결정 기준 (품목 합계 기준, 운영팀 협의 수치)
const CREW_SIZE_2_THRESHOLD = 500_000;  // 50만원 이상 → 2인
const CREW_SIZE_3_THRESHOLD = 1_000_000; // 100만원 이상 → 3인

// 특수 중량 품목 (무조건 추가 인력 배치)
const SPECIAL_HEAVY_ITEMS = new Set([
  "양문형 냉장고", "런닝머신", "안마의자",
  "그랜드피아노", "업라이트피아노", "디지털피아노",
]);

/**
 * 사다리차 필요 여부 자동 판정
 */
export function shouldUseLadder(
  floor: number,
  hasElevator: boolean,
  items: BookingItem[],
  customerRequested: boolean,
): boolean {
  if (customerRequested) return true;
  if (floor >= 4 && !hasElevator) return true;
  if (!hasElevator && items.some((i) => i.loadingCube > 1.5)) return true;
  if (!hasElevator && floor >= 3 && items.some((i) => extractWeight(i.displayName) >= 100)) return true;
  return false;
}

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

  // 1-1. 품목별 소계 계산 (최소 단가 5,000원 적용)
  const MIN_UNIT_PRICE = 5_000;
  const breakdown = secureItems.map((item) => {
    const unitPrice = Math.max(item.price, MIN_UNIT_PRICE);
    return {
      name: `${item.category} - ${item.name}`,
      quantity: item.quantity,
      unitPrice,
      subtotal: unitPrice * item.quantity,
    };
  });

  const itemsTotal = breakdown.reduce((sum, b) => sum + b.subtotal, 0);

  // 2. 인력 수 자동 계산 (overrideCrewSize가 있으면 어드민 지정값 사용)
  let crewSize = overrideCrewSize ?? 1;
  if (!overrideCrewSize) {
    // 기존: 품목 합계 기준
    if (itemsTotal >= CREW_SIZE_3_THRESHOLD) crewSize = 3;
    else if (itemsTotal >= CREW_SIZE_2_THRESHOLD) crewSize = 2;
    else crewSize = 1;

    // 추가 인력 조건 (하나라도 해당 시 crewSize += 1)
    const floor = input.floor ?? 1;
    const hasElevator = input.hasElevator ?? true;
    const needsExtraCrew = secureItems.some((item) => {
      const weight = extractWeight(item.displayName);
      // 조건 1: 단일 품목 무게 ≥ 60kg
      if (weight >= 60) return true;
      // 조건 2: 단일 품목 부피 > 2.0m³
      if (item.loadingCube > 2.0) return true;
      // 조건 3: 특수 중량 품목
      if (SPECIAL_HEAVY_ITEMS.has(item.name)) return true;
      // 조건 4: 엘리베이터 없음 + 3층 이상 + 단일 품목 ≥ 40kg
      if (!hasElevator && floor >= 3 && weight >= 40) return true;
      return false;
    });
    if (needsExtraCrew) crewSize += 1;
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

  // 4. 사다리차 자동 판정 + 비용 계산
  const floor = input.floor ?? 1;
  const hasElevator = input.hasElevator ?? true;
  const autoLadder = shouldUseLadder(floor, hasElevator, secureItems, input.needLadder);
  const effectiveNeedLadder = autoLadder;
  const effectiveLadderType = effectiveNeedLadder
    ? (input.ladderType || (floor < 10 ? "10층 미만" : "10층 이상"))
    : undefined;

  let ladderPrice = 0;
  if (effectiveNeedLadder && effectiveLadderType && ladderPrices) {
    const ladderHours = input.ladderHours ?? 0;
    const ladderGroup = ladderPrices.filter((l) => l.type === effectiveLadderType);
    if (ladderGroup.length > 0) {
      const sorted = [...ladderGroup].sort((a, b) => a.sortOrder - b.sortOrder);
      const entry = sorted[ladderHours] ?? sorted[0];
      ladderPrice = entry?.price ?? 0;
    }
  }

  // 5. 총합
  const totalPrice = itemsTotal + crewPrice + ladderPrice;

  // 6. 견적 레인지 계산
  const estimateMin = itemsTotal + crewPrice + ladderPrice;
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
