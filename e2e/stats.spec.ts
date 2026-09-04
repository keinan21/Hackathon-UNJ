import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Stats") {
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

async function seedStats(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as {
      createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
      createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
      createTransaksi: (t: { id: string; sku_id: string; qty_sold: number; sold_at: string; org_id: string; jenis: string; harga_jual_snapshot: number }) => Promise<void>;
    };
    const nowIso = new Date().toISOString();
    const cat = { id: "k-stats", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
    await repo.createKategori(cat).catch(() => {});
    await repo.createSku({ id: "sku-susu-stats", nama: "Susu UHT 1L", kategori_id: cat.id, hpp: 8000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" }).catch(() => {});
    await repo.createSku({ id: "sku-roti-stats", nama: "Roti Tawar", kategori_id: cat.id, hpp: 5000, harga_normal: 10000, kode: "ROT-001", org_id: "toko-01" }).catch(() => {});
    // masuk rank: susu 10, roti 5
    await repo.createTransaksi({ id: "t-masuk-1", sku_id: "sku-susu-stats", qty_sold: 10, sold_at: nowIso, org_id: "toko-01", jenis: "masuk", harga_jual_snapshot: 0 });
    await repo.createTransaksi({ id: "t-masuk-2", sku_id: "sku-roti-stats", qty_sold: 5, sold_at: nowIso, org_id: "toko-01", jenis: "masuk", harga_jual_snapshot: 0 });
    // keluar rank: susu 2 (15000), roti 1 (10000) => omzet 40000, margin 19000
    await repo.createTransaksi({ id: "t-keluar-1", sku_id: "sku-susu-stats", qty_sold: 2, sold_at: nowIso, org_id: "toko-01", jenis: "keluar", harga_jual_snapshot: 15000 });
    await repo.createTransaksi({ id: "t-keluar-2", sku_id: "sku-roti-stats", qty_sold: 1, sold_at: nowIso, org_id: "toko-01", jenis: "keluar", harga_jual_snapshot: 10000 });
  });
}

test.describe("Statistik 14d — rank + kecepatan + omzet real Dexie", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(300);
    await clearDexie(page);
    await page.waitForTimeout(200);
  });

  test("happy: rank masuk/keluar + kecepatan per SKU/kategori + histori + omzet Rp exact 40000/19000", async ({ page }) => {
    await seedStats(page);
    await page.goto("/");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    // click Statistik tab — 48px, Bahasa Indonesia
    const tab = page.getByTestId("tab-statistik");
    await expect(tab).toBeVisible();
    await expect(tab).toContainText("Statistik");
    await expect(tab).toHaveCSS("min-height", "48px");
    await expect(tab).toHaveCSS("font-size", "16px");
    await tab.click();
    await page.waitForTimeout(800);
    await expect(page.getByTestId("statistik-tab")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("stats-header")).toBeVisible();
    await expect(page.getByText("Statistik 14 Hari")).toBeVisible();
    // omzet & margin exact Rp
    await expect(page.getByTestId("stats-omzet-value")).toContainText("Rp40.000");
    await expect(page.getByTestId("stats-margin-value")).toContainText("Rp19.000");
    await expect(page.getByTestId("stats-cashflow-value")).toContainText("Rp40.000");
    // rank masuk: susu 10 pcs first
    const masukList = page.getByTestId("rank-masuk-list");
    await expect(masukList).toBeVisible();
    const masukItems = masukList.locator("li");
    await expect(masukItems).toHaveCount(2);
    await expect(masukItems.first()).toContainText("Susu UHT 1L");
    await expect(masukItems.first()).toContainText("10 pcs");
    // rank keluar: susu 2 pcs first (2 > 1)
    const keluarList = page.getByTestId("rank-keluar-list");
    await expect(keluarList).toBeVisible();
    const keluarItems = keluarList.locator("li");
    await expect(keluarItems).toHaveCount(2);
    await expect(keluarItems.first()).toContainText("Susu UHT 1L");
    await expect(keluarItems.first()).toContainText("2 pcs");
    // kecepatan per SKU — avg = qty / distinctDays (1 day => 2,0 and 1,0)
    const kecepatanSkuList = page.getByTestId("kecepatan-sku-list");
    await expect(kecepatanSkuList).toBeVisible();
    await expect(page.getByTestId("kecepatan-sku-item-sku-susu-stats")).toBeVisible();
    await expect(page.getByTestId("kecepatan-sku-item-sku-roti-stats")).toBeVisible();
    await expect(page.getByTestId("kecepatan-sku-avg-sku-susu-stats")).toContainText("/ hari");
    // kecepatan per kategori
    const kecKatList = page.getByTestId("kecepatan-kategori-list");
    await expect(kecKatList).toBeVisible();
    await expect(page.getByTestId("kecepatan-kategori-item-k-stats")).toBeVisible();
    // histori keluar-masuk 4 transaksi
    const histori = page.getByTestId("histori-transaksi-list");
    await expect(histori).toBeVisible();
    await expect(histori.locator("li")).toHaveCount(4);
    await expect(page.getByText("Masuk").first()).toBeVisible();
    await expect(page.getByText("Keluar").first()).toBeVisible();
    // Bahasa Indonesia headers
    await expect(page.getByTestId("section-rank-masuk")).toBeVisible();
    await expect(page.getByTestId("section-rank-keluar")).toBeVisible();
    await expect(page.getByTestId("section-kecepatan-sku")).toBeVisible();
    await expect(page.getByTestId("section-kecepatan-kategori")).toBeVisible();
    await expect(page.getByTestId("section-histori-transaksi")).toBeVisible();
    await expect(page.getByTestId("section-omzet")).toBeVisible();
  });

  test("tanpa transaksi → empty Belum ada transaksi + header tetap + Rp 0", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    const tab = page.getByTestId("tab-statistik");
    await expect(tab).toBeVisible();
    await tab.click();
    await page.waitForTimeout(800);
    await expect(page.getByTestId("statistik-tab")).toBeVisible();
    await expect(page.getByTestId("stats-header")).toBeVisible();
    await expect(page.getByText("Statistik 14 Hari")).toBeVisible();
    await expect(page.getByTestId("stats-empty")).toBeVisible();
    await expect(page.getByTestId("stats-empty")).toContainText("Belum ada transaksi");
    // omzet tetap 0
    await expect(page.getByTestId("stats-omzet-value")).toContainText("Rp0");
    await expect(page.getByTestId("stats-margin-value")).toContainText("Rp0");
  });

  test("tab Statistik 48px Bahasa Indonesia + responsive 375 no h-scroll", async ({ page }) => {
    await seedStats(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await page.waitForTimeout(600);
    const tab = page.getByTestId("tab-statistik");
    await expect(tab).toBeVisible();
    await expect(tab).toHaveCSS("min-height", "48px");
    await tab.click();
    await page.waitForTimeout(800);
    await expect(page.getByTestId("statistik-tab")).toBeVisible();
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHScroll).toBe(false);
  });
});
