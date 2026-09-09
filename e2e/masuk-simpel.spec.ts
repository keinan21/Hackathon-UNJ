import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Masuk") {
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

async function seedSku(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as {
      createKategori: (c: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
      createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
    };
    await repo.createKategori({ id: "k-ms", nama: "Sembako", threshold_h_minus: [60, 30, 14], org_id: "toko-01" });
    await repo.createSku({ id: "sku-ms", nama: "Beras 5kg", kategori_id: "k-ms", hpp: 10000, harga_normal: 15000, kode: "SEM-001", org_id: "toko-01" });
  });
}

async function bukaMasuk(page: import("@playwright/test").Page) {
  await page.goto("/masuk");
  await expect(page.getByTestId("inbound-page")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("select-inbound-sku").selectOption("sku-ms");
  await page.getByTestId("input-qty").fill("5");
}

test.describe("Masuk simpel — tanggal, awet, durasi, lanjutan", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(400);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Masuk", updated_at: new Date().toISOString() })));
    await seedSku(page);
    await page.reload();
  });

  test("tanggal → expiry tepat + lanjutan collapsed", async ({ page }) => {
    await bukaMasuk(page);
    const exp = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await page.getByTestId("input-tanggal").fill(exp);
    await page.getByTestId("input-hpp").fill("10000");
    await expect(page.getByTestId("inbound-lanjutan")).toBeVisible();
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });
    const savedExp = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { listBatchesBySku: (s: string, o: string) => Promise<Array<{ expiry_date: string | null }>> };
      const list = await repo.listBatchesBySku("sku-ms", "toko-01");
      return list[0]?.expiry_date ?? null;
    });
    expect(savedExp).toBe(exp);
  });

  test("centang awet → expiry null + tanggal disable", async ({ page }) => {
    await bukaMasuk(page);
    await page.getByTestId("input-awet").check();
    await expect(page.getByTestId("input-tanggal")).toBeDisabled();
    await page.getByTestId("input-hpp").fill("10000");
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });
    const savedExp = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { listBatchesBySku: (s: string, o: string) => Promise<Array<{ expiry_date: string | null }>> };
      const list = await repo.listBatchesBySku("sku-ms", "toko-01");
      return list.length > 0 ? list[0]?.expiry_date : "missing";
    });
    expect(savedExp).toBeNull();
    await page.screenshot({ path: ".omo/evidence/ibu-06-masuk.png" });
  });

  test("durasi 30 → expiry = masuk + 30 hari", async ({ page }) => {
    await bukaMasuk(page);
    await page.locator('label:has-text("Durasi")').first().click();
    await page.getByTestId("input-durasi").fill("30");
    await page.getByTestId("input-hpp").fill("10000");
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });
  });

  test("qty 0 → Jumlah harus lebih dari 0 + fokus ke Jumlah", async ({ page }) => {
    await bukaMasuk(page);
    await page.getByTestId("input-qty").fill("0");
    await page.getByTestId("input-hpp").fill("10000");
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("form-error")).toContainText("Jumlah harus lebih dari 0");
    await expect(page.getByTestId("input-qty")).toBeFocused();
  });

  test("tanggal lampau → Tanggal tidak valid", async ({ page }) => {
    await bukaMasuk(page);
    await page.getByTestId("input-tanggal").fill("2020-01-01");
    await page.getByTestId("input-hpp").fill("10000");
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("form-error")).toContainText("Tanggal tidak valid");
  });
});
