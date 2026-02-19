import { test, expect } from "@playwright/test";

test.describe("예약 흐름", () => {
  test("메인 페이지 로딩", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/커버링 스팟/);
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
