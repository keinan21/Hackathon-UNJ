import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Saran") {
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

async function seedMepet(
  page: import("@playwright/test").Page,
  opts: { hppSnapshot: number; expiryOffsetDays: number },
) {
  await page.evaluate(async ({ o }) => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as {
      createKategori: (c: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
      createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
      createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
    };
    await repo.createKategori({ id: "k-mkn", nama: "Makanan Kering", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
    await repo.createSku({ id: "sku-mie", nama: "Mie Instan", kategori_id: "k-mkn", hpp: 10000, harga_normal: 15000, kode: "MKR-001", org_id: "toko-01" });
    const exp = new Date(Date.now() + o.expiryOffsetDays * 86400000).toISOString().slice(0, 10);
    await repo.createBatch({
      id: "batch-mie-1",
      sku_id: "sku-mie",
      qty: 10,
      expiry_date: exp,
      received_at: new Date().toISOString(),
      hpp_snapshot: o.hppSnapshot,
      org_id: "toko-01",
    });
  }, { o: opts });
}

async function countPromos(page: import("@playwright/test").Page, status?: string) {
  return page.evaluate(async ({ s }) => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { listPromos: (o: string, st?: string) => Promise<Array<unknown>> };
    const list = await repo.listPromos("toko-01", s);
    return list.length;
  }, { s: status });
}

test.describe("Saran Tebus di /kritis — klik hasilkan usulan proposed", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(400);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Saran", updated_at: new Date().toISOString() })));
  });

  test("klik Lihat Saran Tebus di kritis → promo proposed +1, toast, histori muncul", async ({ page }) => {
    await seedMepet(page, { hppSnapshot: 10000, expiryOffsetDays: 2 });
    await page.goto("/kritis");
    await expect(page.getByTestId("kritis-page")).toBeVisible({ timeout: 10_000 });
    const item = page.getByTestId("kritis-item");
    await expect(item).toBeVisible({ timeout: 10_000 });

    await expect(await countPromos(page, "proposed")).toBe(0);
    await item.getByRole("button", { name: /Lihat saran tebus untuk/i }).click();

    await expect(page.getByTestId("saran-toast")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("saran-toast")).toContainText("Usulan tebus murah dibuat");
    await expect(await countPromos(page, "proposed")).toBe(1);

    await page.goto("/");
    await expect(page.getByTestId("histori-batch-mie-1")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: ".omo/evidence/ibu-20-saran-kritis.png" });

    // klik kedua idempoten — tidak tulis promo baru
    await page.goto("/kritis");
    await expect(page.getByTestId("kritis-item")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("kritis-item").getByRole("button", { name: /Lihat saran tebus untuk/i }).click();
    await expect(page.getByTestId("saran-toast")).toContainText("sudah ada", { timeout: 10_000 });
    await expect(await countPromos(page, "proposed")).toBe(1);
  });

  test("batch tanpa HPP → toast error Indonesia, promo tidak nambah", async ({ page }) => {
    await seedMepet(page, { hppSnapshot: 0, expiryOffsetDays: 2 });
    await page.goto("/kritis");
    await expect(page.getByTestId("kritis-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("kritis-item")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("kritis-item").getByRole("button", { name: /Lihat saran tebus untuk/i }).click();
    await expect(page.getByTestId("saran-error")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("saran-error")).toContainText("HPP harus lebih dari 0");
    await expect(await countPromos(page)).toBe(0);
  });
});
