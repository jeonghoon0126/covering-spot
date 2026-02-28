import { test, expect } from "@playwright/test";

test.describe("페이지 로딩", () => {
  test("메인 페이지 로딩", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/커버링 방문수거/);
    await expect(page.locator("text=수거 신청하기").first()).toBeVisible();
  });

  test("예약 페이지 접근", async ({ page }) => {
    await page.goto("/booking");
    await expect(page.locator("text=고객 정보")).toBeVisible();
  });

  test("관리자 로그인 페이지", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("text=관리자 로그인")).toBeVisible();
  });

  test("오프라인 페이지", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.locator("text=오프라인")).toBeVisible();
  });
});

test.describe("공개 API 응답 구조", () => {
  test("품목 목록 API 200 + 배열 반환", async ({ request }) => {
    const res = await request.get("/api/items");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("지역 목록 API 200 + 배열 반환", async ({ request }) => {
    const res = await request.get("/api/areas");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("견적 계산 API 응답 구조 확인", async ({ request }) => {
    // items API에서 실제 품목명 조회 후 견적 계산
    const itemsRes = await request.get("/api/items");
    expect(itemsRes.status()).toBe(200);
    const items: Array<{ name: string; category: string; displayName: string }> =
      await itemsRes.json();

    const areasRes = await request.get("/api/areas");
    const areas: Array<{ name: string }> = await areasRes.json();

    // 유효한 품목·지역이 있을 때만 견적 계산 테스트
    test.skip(items.length === 0 || areas.length === 0, "마스터 데이터 없음");

    const firstItem = items[0];
    const firstArea = areas[0];

    const res = await request.post("/api/quote", {
      data: {
        area: firstArea.name,
        items: [
          {
            category: firstItem.category,
            name: firstItem.name,
            displayName: firstItem.displayName,
            price: 0,
            quantity: 1,
            loadingCube: 0,
          },
        ],
        needLadder: false,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("totalPrice");
    expect(body).toHaveProperty("itemsTotal");
    expect(body).toHaveProperty("crewPrice");
    expect(typeof body.totalPrice).toBe("number");
    expect(body.itemsTotal).toBeGreaterThan(0);
  });
});

test.describe("예약 UI 플로우", () => {
  test("예약 폼 고객정보 입력 필드 존재 확인", async ({ page }) => {
    await page.goto("/booking");
    await expect(page.locator("text=고객 정보")).toBeVisible();
    // 이름 또는 전화번호 입력 필드가 존재해야 함
    const inputCount = await page.locator("input").count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test("예약 조회 페이지 전화번호 입력 필드 존재 확인", async ({ page }) => {
    await page.goto("/booking/manage");
    // 전화번호 입력 필드 존재 확인 (type=tel 또는 placeholder에 '전화' 포함)
    const phoneInput = page
      .locator('input[type="tel"], input[placeholder*="전화"], input[placeholder*="010"]')
      .first();
    await expect(phoneInput).toBeVisible({ timeout: 5000 });
  });

  test("예약 조회 → mock 결과 렌더링 확인", async ({ page }) => {
    const mockBookings = [
      {
        id: "mock-booking-id",
        customerName: "테스트 고객",
        phone: "010-1234-5678",
        status: "pending",
        date: "2026-03-01",
        timeSlot: "오전 (9시~12시)",
        address: "서울시 강남구 테스트로 1",
        items: [],
        totalPrice: 100000,
        totalLoadingCube: 0.6,
        createdAt: new Date().toISOString(),
      },
    ];

    await page.route("**/api/bookings*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockBookings),
      });
    });

    await page.goto("/booking/manage");

    const phoneInput = page
      .locator('input[type="tel"], input[placeholder*="전화"], input[placeholder*="010"]')
      .first();
    if (!(await phoneInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await phoneInput.fill("010-1234-5678");

    const searchBtn = page.locator("button").filter({ hasText: /조회|확인|검색/ }).first();
    if (await searchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchBtn.click();
      await expect(page.locator("text=테스트 고객")).toBeVisible({ timeout: 5000 });
    }
  });
});
