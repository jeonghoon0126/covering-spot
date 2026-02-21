import { describe, it, expect } from "vitest";
import { calculateQuote } from "@/lib/quote-calculator";
import type { QuoteInput } from "@/types/booking";

describe("calculateQuote", () => {
  // 기본 단일 품목 견적
  it("단일 품목 견적을 정확히 계산한다", () => {
    const input: QuoteInput = {
      area: "강남구",
      items: [
        { category: "가전", name: "냉장고", displayName: "냉장고", price: 50000, quantity: 1, loadingCube: 0 },
      ],
      needLadder: false,
    };
    const result = calculateQuote(input);

    expect(result.itemsTotal).toBe(50000);
    expect(result.crewSize).toBe(1);
    // 강남구 1인 단가 = 50000
    expect(result.crewPrice).toBe(50000);
    expect(result.totalPrice).toBe(100000);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].subtotal).toBe(50000);
  });

  // 인력 자동 스케일링: 50만 이상 → 2인
  it("품목 합계 50만 이상이면 2인 크루로 배정된다", () => {
    const input: QuoteInput = {
      area: "강남구",
      items: [
        { category: "가전", name: "냉장고", displayName: "냉장고", price: 250000, quantity: 2, loadingCube: 0 },
      ],
      needLadder: false,
    };
    const result = calculateQuote(input);

    expect(result.itemsTotal).toBe(500000);
    expect(result.crewSize).toBe(2);
    // 강남구 2인 단가 = 75000
    expect(result.crewPrice).toBe(75000);
  });

  // 인력 자동 스케일링: 100만 이상 → 3인
  it("품목 합계 100만 이상이면 3인 크루로 배정된다", () => {
    const input: QuoteInput = {
      area: "강남구",
      items: [
        { category: "가전", name: "냉장고", displayName: "냉장고", price: 500000, quantity: 2, loadingCube: 0 },
      ],
      needLadder: false,
    };
    const result = calculateQuote(input);

    expect(result.itemsTotal).toBe(1000000);
    expect(result.crewSize).toBe(3);
    // 강남구 3인 단가 = 113000
    expect(result.crewPrice).toBe(113000);
  });

  // 해체 가산금이 가산 방식으로 올바르게 적용되는지
  it("해체 품목이 있으면 가산 방식으로 estimateMax에 반영된다", () => {
    const input: QuoteInput = {
      area: "강남구",
      items: [
        { category: "장롱", name: "장롱 3자", displayName: "장롱 3자", price: 100000, quantity: 1, loadingCube: 0 },
      ],
      needLadder: false,
    };
    const result = calculateQuote(input);

    // itemsTotalMax = 100000 * 1.15 + 100000 * 0.1 = 115000 + 10000 = 125000
    // estimateMax raw = 125000 + crewPrice(50000) = 175000 → ceil to 만원 = 180000
    expect(result.estimateMax).toBe(180000);
  });

  // 해체 품목 + 일반 품목 혼합
  it("해체 품목과 일반 품목이 섞여도 해체 가산은 해체 품목에만 적용된다", () => {
    const input: QuoteInput = {
      area: "강남구",
      items: [
        { category: "장롱", name: "장롱 3자", displayName: "장롱 3자", price: 100000, quantity: 1, loadingCube: 0 },
        { category: "가전", name: "냉장고", displayName: "냉장고", price: 100000, quantity: 1, loadingCube: 0 },
      ],
      needLadder: false,
    };
    const result = calculateQuote(input);

    // itemsTotal = 200000
    // itemsTotalMax = 200000 * 1.15 + 100000(장롱만) * 0.1 = 230000 + 10000 = 240000
    // estimateMax raw = 240000 + crewPrice(50000) = 290000 → ceil to 만원 = 290000
    expect(result.estimateMax).toBe(290000);
  });

  // 사다리차 비용 추가
  it("사다리차 비용이 정확히 추가된다", () => {
    const input: QuoteInput = {
      area: "강남구",
      items: [
        { category: "가전", name: "냉장고", displayName: "냉장고", price: 50000, quantity: 1, loadingCube: 0 },
      ],
      needLadder: true,
      ladderType: "10층 미만",
      ladderHours: 0, // 기본요금 130000
    };
    const result = calculateQuote(input);

    expect(result.ladderPrice).toBe(130000);
    expect(result.totalPrice).toBe(50000 + 50000 + 130000); // 품목 + 인력 + 사다리
  });

  // 지역별 단가 적용
  it("지역별 인력비가 정확히 적용된다", () => {
    const input: QuoteInput = {
      area: "구리",
      items: [
        { category: "가전", name: "냉장고", displayName: "냉장고", price: 50000, quantity: 1, loadingCube: 0 },
      ],
      needLadder: false,
    };
    const result = calculateQuote(input);

    // 구리 1인 단가 = 46000
    expect(result.crewPrice).toBe(46000);
  });

  // estimateMin < estimateMax 항상 성립
  it("estimateMin이 항상 estimateMax 이하이다", () => {
    const input: QuoteInput = {
      area: "강남구",
      items: [
        { category: "장롱", name: "장롱 3자", displayName: "장롱 3자", price: 200000, quantity: 3, loadingCube: 0 },
        { category: "가전", name: "냉장고", displayName: "냉장고", price: 150000, quantity: 2, loadingCube: 0 },
      ],
      needLadder: true,
      ladderType: "10층 이상",
      ladderHours: 2,
    };
    const result = calculateQuote(input);

    expect(result.estimateMin).toBeLessThanOrEqual(result.estimateMax);
  });

  // 빈 품목 리스트
  it("품목이 없으면 품목 합계 0, 인력 1인으로 반환한다", () => {
    const input: QuoteInput = {
      area: "강남구",
      items: [],
      needLadder: false,
    };
    const result = calculateQuote(input);

    expect(result.itemsTotal).toBe(0);
    expect(result.crewSize).toBe(1);
    expect(result.breakdown).toHaveLength(0);
  });
});
