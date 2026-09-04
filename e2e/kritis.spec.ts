import { test, expect } from "@playwright/test";

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Kritis") {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("input-nama-toko").fill(nama);
  await page.getByTestId("input-pin").fill("1234");
  await page.getByTestId("input-pin-confirm").fill("1234");
  await page.getByTestId("btn-masuk").click();
  await expect(page.getByTestId("header-title")).toBeVisible({ timeout: 10_000 });
}

async function clearDexie(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { clearAll: (o: string) => Promise<void> } | undefined;
    if (repo) await repo.clearAll("toko-01");
  });
}

function expiryFor(days: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const base = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const exp = new Date(base + days * 86_400_000);
  const f2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  return f2.format(exp);
}

async function seedKritisDemo(page: import("@playwright/test").Page) {
  await page.evaluate(
    async ({ exp1, exp3, exp10 }) => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
        createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
      };
      const cat = { id: "k-dairy", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
      await repo.createKategori(cat).catch(() => {});
      await repo.createSku({ id: "sku-susu", nama: "Susu UHT 1L", kategori_id: cat.id, hpp: 10000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" }).catch(() => {});
      await repo.createSku({ id: "sku-yoghurt", nama: "Yoghurt Cup 100ml", kategori_id: cat.id, hpp: 8000, harga_normal: 12000, kode: "YOG-001", org_id: "toko-01" }).catch(() => {});
      await repo.createSku({ id: "sku-roti", nama: "Roti Tawar", kategori_id: "k-snack", hpp: 5000, harga_normal: 8000, kode: "ROT-001", org_id: "toko-01" }).catch(() => {});
      // need snack kategori too for roti
      await repo.createKategori({ id: "k-snack", nama: "Snack", threshold_h_minus: [7, 3, 1], org_id: "toko-01" }).catch(() => {});
      await repo.createBatch({ id: "b-h1", sku_id: "sku-susu", qty: 10, expiry_date: exp1, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
      await repo.createBatch({ id: "b-h3", sku_id: "sku-yoghurt", qty: 8, expiry_date: exp3, received_at: new Date().toISOString(), hpp_snapshot: 8000, org_id: "toko-01" });
      await repo.createBatch({ id: "b-h10", sku_id: "sku-roti", qty: 5, expiry_date: exp10, received_at: new Date().toISOString(), hpp_snapshot: 5000, org_id: "toko-01" });
    },
    { exp1: expiryFor(1), exp3: expiryFor(3), exp10: expiryFor(10) },
  );
}

test.describe("Kritis - definisi threshold + halaman khusus (real Dexie)", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(300);
    await clearDexie(page);
    await page.waitForTimeout(200);
  });

  test("happy: /kritis lists batches kritis (days <= max threshold), badge merah for H<=min, tap -> /sku/:id", async ({ page }) => {
    await seedKritisDemo(page);
    await page.goto("/");
    await page.waitForTimeout(800);
    await expect(page.getByTestId("kritis-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("kritis-banner-link")).toBeVisible();
    await expect(page.getByTestId("kritis-banner")).toContainText("batch kritis");
    await page.getByTestId("kritis-banner-link").click();
    await expect(page).toHaveURL(/\/kritis/);
    await expect(page.getByTestId("kritis-page")).toBeVisible();
    const list = page.getByTestId("kritis-list");
    await expect(list).toBeVisible();
    const items = page.getByTestId("kritis-item");
    await expect(items).toHaveCount(2);
    const firstText = await items.first().innerText();
    expect(firstText).toContain("H-1");
    const secondText = await items.nth(1).innerText();
    expect(secondText).toContain("H-3");
    const h1Badge = page.getByTestId("kritis-badge").first();
    await expect(h1Badge).toBeVisible();
    await expect(h1Badge).toHaveCSS("background-color", hexToRgb("#C62828"));
    await expect(h1Badge).toHaveCSS("color", hexToRgb("#FFFFFF"));
    await expect(page.getByTestId("kritis-h-remaining").first()).toHaveText("H-1");
    const h3Badge = page.getByTestId("kritis-badge").nth(1);
    await expect(h3Badge).toBeVisible();
    await expect(h3Badge).toHaveCSS("background-color", hexToRgb("#EF6C00"));
    await expect(page.getByTestId("kritis-h-remaining").filter({ hasText: "H-10" })).toHaveCount(0);
    const detailBtn = page.getByTestId("kritis-tombol-lihat-detail").first();
    await expect(detailBtn).toBeVisible();
    await expect(detailBtn).toHaveCSS("min-height", "48px");
    await expect(detailBtn).toHaveCSS("font-size", "16px");
    await detailBtn.click();
    await expect(page).toHaveURL(/\/sku\//);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
  });

  test("direct /kritis URL shows same kritis list", async ({ page }) => {
    await seedKritisDemo(page);
    await page.goto("/kritis");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("kritis-page")).toBeVisible();
    await expect(page.getByTestId("kritis-list")).toBeVisible();
    await expect(page.getByTestId("kritis-item")).toHaveCount(2);
    await expect(page.getByTestId("kritis-h-remaining").first()).toContainText("H-");
  });

  test("failure: tidak ada kritis -> empty Indonesia", async ({ page }) => {
    await page.goto("/kritis");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("kritis-page")).toBeVisible();
    const empty = page.getByTestId("kritis-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("Tidak ada batch kritis");
    await expect(page.getByTestId("kritis-item")).toHaveCount(0);
    await expect(page.getByTestId("kritis-list")).toHaveCount(0);
    await expect(empty).toHaveAttribute("role", "status");
  });

  test("a11y: badge, list, tombol 48px 16px, Bahasa Indonesia", async ({ page }) => {
    await seedKritisDemo(page);
    await page.goto("/kritis");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("kritis-page")).toBeVisible();
    const badge = page.getByTestId("kritis-badge").first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("aria-label", /Batch .* H-/);
    await expect(badge.locator("svg")).toBeVisible();
    const btn = page.getByTestId("kritis-tombol-lihat-detail").first();
    await expect(btn).toHaveCSS("min-height", "48px");
    await expect(btn).toHaveCSS("font-size", "16px");
    await expect(btn).toHaveText("Lihat Detail");
    const back = page.getByTestId("kritis-back");
    await expect(back).toBeVisible();
    await expect(back).toHaveCSS("min-height", "48px");
  });
});
