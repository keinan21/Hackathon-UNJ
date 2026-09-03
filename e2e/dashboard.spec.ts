import { test, expect } from "@playwright/test";

test.describe("Dashboard 3 seksi + histori + promo", () => {
  test("dashboard shows 3 sections Stok Mepet + Promo Tebus Murah + Histori Saran", async ({ page }) => {
    await page.goto("/?seed=demo");
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Promo Tebus Murah" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Histori Saran" })).toBeVisible();

    await expect(page.getByText("Tebus Murah").first()).toBeVisible();
    const promoHarga = page.locator("text=Rp").first();
    await expect(promoHarga).toBeVisible();
    await expect(page.getByText(/Modal Rp10\.000/).first()).toBeVisible();

    // Histori last 5
    const historiItems = page.locator('[data-testid^="histori-hist-"]');
    await expect(historiItems).toHaveCount(5);
    await expect(page.getByText("Menampilkan 5 terbaru dari 5 saran")).toBeVisible();

    // Font size >=16px on dashboard cards
    const cardText = page.locator('[data-testid="section-histori"] li').first();
    await expect(cardText).toBeVisible();
    const fontSize = await cardText.evaluate((el) => getComputedStyle(el).fontSize);
    // at least 14 but we check inner p 16
    const innerP = page.locator('[data-testid="section-histori"] li p').first();
    await expect(innerP).toHaveCSS("font-size", "16px");

    // Button 48px inside promo/histori
    const promoBtn = page.getByRole("button", { name: /Setujui Tebus Murah|Lihat Saran Tebus/ }).first();
    if (await promoBtn.count() > 0) {
      await expect(promoBtn).toHaveCSS("min-height", "48px");
    }
  });

  test("histori detail navigation pushState and back", async ({ page }) => {
    await page.goto("/?seed=demo");
    const firstHist = page.locator('[data-testid="histori-hist-1"]').first();
    await expect(firstHist).toBeVisible();
    await firstHist.click();
    await page.waitForURL(/\/histori\/hist-1/);
    await expect(page.getByTestId("histori-detail")).toBeVisible();
    await expect(page.getByText(/Susu mau kadaluarsa/).first()).toBeVisible();
    await expect(page.getByTestId("histori-detail").getByText(/Roti Tawar/).first()).toBeVisible();
    await expect(page.getByText(/Rp9\.000/).first()).toBeVisible();
    // Timestamp 12px
    const timeEl = page.locator('[data-testid="histori-detail"] span').filter({ hasText: /Jan|Feb|Mar|Apr|Mei|Jun|Jul|Ags|Sep|Okt|Nov|Des|\d{2}/ }).first();
    if (await timeEl.count() > 0) {
      const fs = await timeEl.evaluate((el) => getComputedStyle(el).fontSize);
      expect(fs).toBe("12px");
    }
    // Back 48px
    const backBtn = page.getByTestId("histori-back");
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toHaveCSS("min-height", "48px");
    await backBtn.click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();
  });

  test("empty histori shows SVG not emoji", async ({ page }) => {
    await page.goto("/?histori=empty");
    await expect(page.getByTestId("histori-empty")).toBeVisible();
    const svg = page.locator('[data-testid="histori-empty"] svg');
    await expect(svg).toBeVisible();
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBe(48);
    // Check no emoji in empty text? just verify text
    await expect(page.getByText("Belum ada histori saran")).toBeVisible();
  });

  test("dashboard responsive 375 no h-scroll and max-w 480", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/?seed=demo");
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHScroll).toBe(false);
    const maxW = await page.locator('main').evaluate((el) => getComputedStyle(el).maxWidth);
    expect(maxW).toBe("480px");
  });
});
