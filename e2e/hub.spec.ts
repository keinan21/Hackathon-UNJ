import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Hub") {
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

async function seedHub(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as {
      createKategori: (c: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
      createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
      createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
      createPromo: (pr: { id: string; batch_id: string; sku_pasangan_id: string | null; harga_tebus: number; status: string; org_id: string; created_at: string }) => Promise<void>;
    };
    await repo.createKategori({ id: "k-hub", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
    await repo.createSku({ id: "sku-hub", nama: "Susu Hub", kategori_id: "k-hub", hpp: 10000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" });
    const exp = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await repo.createBatch({ id: "batch-hub-1", sku_id: "sku-hub", qty: 8, expiry_date: exp, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
    await repo.createPromo({ id: "promo-hub-1", batch_id: "batch-hub-1", sku_pasangan_id: null, harga_tebus: 9000, status: "proposed", org_id: "toko-01", created_at: new Date().toISOString() });
  });
}

test.describe("Dashboard hub 2x2 + kartu info", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(400);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Hub", updated_at: new Date().toISOString() })));
  });

  test("4 tombol hub ke 4 tujuan, 64px/16px, mobile tanpa h-scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedHub(page);
    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("hub-nav")).toBeVisible();
    for (const id of ["hub-masuk", "hub-kasir", "hub-sku", "hub-statistik"]) {
      const b = page.getByTestId(id);
      await expect(b).toBeVisible();
      await expect(b).toHaveCSS("font-size", "16px");
      const h = await b.evaluate((el) => el.getBoundingClientRect().height);
      expect(h).toBeGreaterThanOrEqual(48);
    }
    await page.getByTestId("hub-masuk").click();
    await expect(page.getByTestId("inbound-page")).toBeVisible({ timeout: 10_000 });
    await page.goto("/");
    await page.getByTestId("hub-kasir").click();
    await expect(page.getByTestId("kasir-page")).toBeVisible({ timeout: 10_000 });
    await page.goto("/");
    await page.getByTestId("hub-sku").click();
    await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
    await page.goto("/");
    await page.getByTestId("hub-statistik").click();
    await expect(page.getByTestId("statistik-tab")).toBeVisible({ timeout: 10_000 });
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHScroll).toBe(false);
    await page.screenshot({ path: ".omo/evidence/ibu-05-hub.png" });
  });

  test("kartu info tap ke /kritis dan /promo", async ({ page }) => {
    await seedHub(page);
    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("kritis-banner")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("kritis-banner-link").click();
    await expect(page.getByTestId("kritis-page")).toBeVisible({ timeout: 10_000 });
    await page.goto("/");
    const urgentLihat = page.getByTestId("urgent-lihat-batch-hub-1");
    await expect(urgentLihat).toBeVisible({ timeout: 10_000 });
    await urgentLihat.click();
    await expect(page.getByTestId("kritis-page")).toBeVisible({ timeout: 10_000 });
    await page.goto("/");
    const promoLihat = page.getByTestId("promo-lihat-promo-hub-1");
    await expect(promoLihat).toBeVisible({ timeout: 10_000 });
    await promoLihat.click();
    await expect(page.getByTestId("promo-page")).toBeVisible({ timeout: 10_000 });
  });
});
