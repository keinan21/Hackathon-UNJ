import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko PromoPage") {
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

async function seedPromo(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as {
      createKategori: (c: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
      createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
      createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
      createPromo: (pr: { id: string; batch_id: string; sku_pasangan_id: string | null; harga_tebus: number; status: string; org_id: string; created_at: string }) => Promise<void>;
    };
    await repo.createKategori({ id: "k-pp", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
    await repo.createSku({ id: "sku-pp-susu", nama: "Susu UHT 1L", kategori_id: "k-pp", hpp: 10000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" });
    await repo.createSku({ id: "sku-pp-roti", nama: "Roti Tawar", kategori_id: "k-pp", hpp: 8000, harga_normal: 12000, kode: "ROT-001", org_id: "toko-01" });
    const exp = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await repo.createBatch({ id: "batch-pp-1", sku_id: "sku-pp-susu", qty: 10, expiry_date: exp, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
    await repo.createPromo({ id: "promo-pp-1", batch_id: "batch-pp-1", sku_pasangan_id: "sku-pp-roti", harga_tebus: 9000, status: "proposed", org_id: "toko-01", created_at: new Date().toISOString() });
  });
}

test.describe("Halaman /promo + /statistik", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(400);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko PromoPage", updated_at: new Date().toISOString() })));
  });

  test("/promo approve happy → active + toast", async ({ page }) => {
    await seedPromo(page);
    await page.goto("/promo");
    await expect(page.getByTestId("promo-page")).toBeVisible({ timeout: 10_000 });
    const card = page.getByTestId("promo-card-proposed").first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("btn-setujui-tebus").first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("dialog-confirm-yakin").click();
    await expect(page.getByTestId("promo-card-active").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("promo-toast")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("promo-toast")).toContainText("Tebus murah aktif");
    await page.getByTestId("promo-back").click();
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: ".omo/evidence/ibu-21-promopage.png" });
  });

  test("/statistik render + dashboard kartu promo tap ke /promo", async ({ page }) => {
    await seedPromo(page);
    await page.goto("/statistik");
    await expect(page.getByTestId("statistik-tab")).toBeVisible({ timeout: 10_000 });
    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    const lihat = page.getByTestId("promo-lihat-promo-pp-1");
    await expect(lihat).toBeVisible({ timeout: 10_000 });
    await lihat.click();
    await expect(page.getByTestId("promo-page")).toBeVisible({ timeout: 10_000 });
  });
});
