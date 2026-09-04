import { test, expect } from "@playwright/test";

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

test.describe("Kritis - definisi threshold + halaman khusus", () => {
  test("happy: /kritis lists batches kritis (days <= max threshold), badge merah for H<=min, tap -> /sku/:id", async ({ page }) => {
    await page.goto("/?seed=demo");
    // Dashboard banner should appear for kritis
    await expect(page.getByTestId("kritis-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("kritis-banner-link")).toBeVisible();
    await expect(page.getByTestId("kritis-banner")).toContainText("batch kritis");

    // Navigate to kritis page via banner
    await page.getByTestId("kritis-banner-link").click();
    await expect(page).toHaveURL(/\/kritis/);
    await expect(page.getByTestId("kritis-page")).toBeVisible();

    // List should contain 2 kritis items (H-1 and H-3, H-10 hidden because > max 7)
    const list = page.getByTestId("kritis-list");
    await expect(list).toBeVisible();
    const items = page.getByTestId("kritis-item");
    await expect(items).toHaveCount(2);

    // Filter: items sorted expiry asc — H-1 first
    const firstText = await items.first().innerText();
    expect(firstText).toContain("H-1");
    const secondText = await items.nth(1).innerText();
    expect(secondText).toContain("H-3");

    // Badge warna: H-1 merah #C62828 text white
    const h1Badge = page.getByTestId("kritis-badge").first();
    await expect(h1Badge).toBeVisible();
    await expect(h1Badge).toHaveCSS("background-color", hexToRgb("#C62828"));
    await expect(h1Badge).toHaveCSS("color", hexToRgb("#FFFFFF"));
    await expect(page.getByTestId("kritis-h-remaining").first()).toHaveText("H-1");

    // H-3 oranye #EF6C00
    const h3Badge = page.getByTestId("kritis-badge").nth(1);
    await expect(h3Badge).toBeVisible();
    await expect(h3Badge).toHaveCSS("background-color", hexToRgb("#EF6C00"));

    // H-10 hidden — no H-10 badge in kritis list
    await expect(page.getByTestId("kritis-h-remaining").filter({ hasText: "H-10" })).toHaveCount(0);

    // Tap Lihat Detail -> /sku/:id
    const detailBtn = page.getByTestId("kritis-tombol-lihat-detail").first();
    await expect(detailBtn).toBeVisible();
    await expect(detailBtn).toHaveCSS("min-height", "48px");
    await expect(detailBtn).toHaveCSS("font-size", "16px");
    await detailBtn.click();
    await expect(page).toHaveURL(/\/sku\//);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
  });

  test("direct /kritis URL shows same kritis list", async ({ page }) => {
    await page.goto("/kritis?seed=demo");
    await expect(page.getByTestId("kritis-page")).toBeVisible();
    await expect(page.getByTestId("kritis-list")).toBeVisible();
    await expect(page.getByTestId("kritis-item")).toHaveCount(2);
    // Verify H-remaining badges present
    await expect(page.getByTestId("kritis-h-remaining").first()).toContainText("H-");
  });

  test("failure: tidak ada kritis -> empty Indonesia", async ({ page }) => {
    await page.goto("/kritis?seed=empty");
    await expect(page.getByTestId("kritis-page")).toBeVisible();
    const empty = page.getByTestId("kritis-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("Tidak ada batch kritis");
    // Ensure no items
    await expect(page.getByTestId("kritis-item")).toHaveCount(0);
    await expect(page.getByTestId("kritis-list")).toHaveCount(0);
    // a11y live polite
    await expect(empty).toHaveAttribute("role", "status");
  });

  test("a11y: badge, list, tombol 48px 16px, Bahasa Indonesia", async ({ page }) => {
    await page.goto("/kritis?seed=demo");
    await expect(page.getByTestId("kritis-page")).toBeVisible();
    const badge = page.getByTestId("kritis-badge").first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("aria-label", /Batch .* H-/);
    await expect(badge.locator("svg")).toBeVisible();

    const btn = page.getByTestId("kritis-tombol-lihat-detail").first();
    await expect(btn).toHaveCSS("min-height", "48px");
    await expect(btn).toHaveCSS("font-size", "16px");
    await expect(btn).toHaveText("Lihat Detail");

    // Back button 48px
    const back = page.getByTestId("kritis-back");
    await expect(back).toBeVisible();
    await expect(back).toHaveCSS("min-height", "48px");
  });
});
