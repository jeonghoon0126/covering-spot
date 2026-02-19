import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEarliestBookableDate, isDateBookable } from "@/lib/booking-utils";

describe("booking-utils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getEarliestBookableDate", () => {
    it("오전(12시 이전)에는 내일부터 예약 가능하다", () => {
      // 2026-02-18 오전 10시 KST
      vi.setSystemTime(new Date("2026-02-18T01:00:00Z")); // UTC 01:00 = KST 10:00
      const result = getEarliestBookableDate();
      expect(result).toBe("2026-02-19");
    });

    it("오후(12시 이후)에는 모레부터 예약 가능하다", () => {
      // 2026-02-18 오후 2시 KST
      vi.setSystemTime(new Date("2026-02-18T05:00:00Z")); // UTC 05:00 = KST 14:00
      const result = getEarliestBookableDate();
      expect(result).toBe("2026-02-20");
    });
  });

  describe("isDateBookable", () => {
    it("과거 날짜는 예약 불가", () => {
      // 2026-02-18 오전 10시 KST
      vi.setSystemTime(new Date("2026-02-18T01:00:00Z"));
      expect(isDateBookable("2026-02-17")).toBe(false);
    });

    it("오늘은 예약 불가", () => {
      // 2026-02-18 오전 10시 KST → earliest = 02-19
      vi.setSystemTime(new Date("2026-02-18T01:00:00Z"));
      expect(isDateBookable("2026-02-18")).toBe(false);
    });

    it("오전이면 내일은 예약 가능", () => {
      // 2026-02-18 오전 10시 KST → earliest = 02-19
      vi.setSystemTime(new Date("2026-02-18T01:00:00Z"));
      expect(isDateBookable("2026-02-19")).toBe(true);
    });

    it("오후이면 내일은 예약 불가, 모레부터 가능", () => {
      // 2026-02-18 오후 2시 KST → earliest = 02-20
      vi.setSystemTime(new Date("2026-02-18T05:00:00Z"));
      expect(isDateBookable("2026-02-19")).toBe(false);
      expect(isDateBookable("2026-02-20")).toBe(true);
    });

    it("먼 미래 날짜는 예약 가능", () => {
      vi.setSystemTime(new Date("2026-02-18T01:00:00Z"));
      expect(isDateBookable("2026-12-31")).toBe(true);
    });
  });
});
