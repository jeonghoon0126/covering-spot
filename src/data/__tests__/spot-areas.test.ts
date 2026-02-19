import { describe, it, expect } from "vitest";
import { detectAreaFromAddress, SPOT_AREAS } from "@/data/spot-areas";

describe("detectAreaFromAddress", () => {
  // 서울 구 직접 매칭
  it("서울 강남구를 직접 매칭한다", () => {
    const result = detectAreaFromAddress("강남구", "서울특별시");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("강남구");
  });

  it("서울 송파구를 직접 매칭한다", () => {
    const result = detectAreaFromAddress("송파구", "서울특별시");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("송파구");
  });

  // 경기도 시 매칭
  it("경기도 고양시 덕양구를 고양으로 매칭한다", () => {
    const result = detectAreaFromAddress("고양시 덕양구", "경기도");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("고양");
  });

  it("경기도 김포시를 김포로 매칭한다", () => {
    const result = detectAreaFromAddress("김포시", "경기도");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("김포");
  });

  it("경기도 성남시 분당구를 성남으로 매칭한다", () => {
    const result = detectAreaFromAddress("성남시 분당구", "경기도");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("성남");
  });

  // 인천 매칭
  it("인천광역시를 인천으로 매칭한다", () => {
    const result = detectAreaFromAddress("남동구", "인천광역시");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("인천");
  });

  // 충청남도 매칭
  it("충청남도 천안시 동남구를 천안으로 매칭한다", () => {
    const result = detectAreaFromAddress("천안시 동남구", "충청남도");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("천안");
  });

  it("충청남도 아산시를 아산으로 매칭한다", () => {
    const result = detectAreaFromAddress("아산시", "충청남도");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("아산");
  });

  // 서비스 불가 지역
  it("서비스 불가 지역은 null을 반환한다", () => {
    const result = detectAreaFromAddress("해운대구", "부산광역시");
    expect(result).toBeNull();
  });

  it("경기도 내 미등록 지역은 null을 반환한다", () => {
    const result = detectAreaFromAddress("연천군", "경기도");
    expect(result).toBeNull();
  });
});

describe("SPOT_AREAS", () => {
  it("58개 지역이 등록되어 있다", () => {
    expect(SPOT_AREAS).toHaveLength(58);
  });

  it("모든 지역이 유효한 가격을 가지고 있다", () => {
    for (const area of SPOT_AREAS) {
      expect(area.name).toBeTruthy();
      expect(area.price1).toBeGreaterThan(0);
      expect(area.price2).toBeGreaterThan(0);
      expect(area.price3).toBeGreaterThan(0);
      // 인력비 순서: 1인 < 2인 < 3인
      expect(area.price1).toBeLessThan(area.price2);
      expect(area.price2).toBeLessThan(area.price3);
    }
  });
});
