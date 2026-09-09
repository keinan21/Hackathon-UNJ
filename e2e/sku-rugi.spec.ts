import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Rugi") {
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

async function seedKategori(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { createKategori: (c: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void> };
    await repo.createKategori({ id: "k-mkr", nama: "Makanan Kering", threshold_h_minus: [30, 14, 7], org_id: "toko-01" });
  });
}

async function findSku(page: import("@playwright/test").Page, nama: string) {
  return page.evaluate(async ({ n }) => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { listSkus: (o: string) => Promise<Array<{ id: string; nama: string }>> };
    const list = await repo.listSkus("toko-01");
    return list.find((s) => s.nama === n) ?? null;
  }, { n: nama });
}

async function bukaFormBaru(page: import("@playwright/test").Page) {
  await page.getByTestId("nav-sku").click();
  await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("btn-tambah-sku").click();
  await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("input-nama").fill("Mie Rugi");
  await page.getByTestId("input-hpp").fill("5000");
  await page.getByTestId("input-harga").fill("3000");
}

test.describe("Cegatan harga rugi — modal konfirmasi", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(400);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Rugi", updated_at: new Date().toISOString() })));
    await seedKategori(page);
    await page.reload();
  });

  test("Batal → tetap di form, tidak tersimpan", async ({ page }) => {
    await bukaFormBaru(page);
    await expect(page.getByTestId("warning-harga")).toBeVisible({ timeout: 3000 });
    await page.getByTestId("btn-simpan-sku").click();
    await expect(page.getByTestId("confirm-rugi-dialog")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("confirm-rugi-text")).toContainText("rugi Rp2.000");
    await page.getByTestId("btn-rugi-batal").click();
    await expect(page.getByTestId("confirm-rugi-dialog")).toBeHidden({ timeout: 3000 });
    await expect(page.getByTestId("sku-baru-page")).toBeVisible();
    expect(await findSku(page, "Mie Rugi")).toBeNull();
  });

  test("Yakin → tersimpan + badge Di bawah modal di katalog", async ({ page }) => {
    await bukaFormBaru(page);
    await page.getByTestId("btn-simpan-sku").click();
    await expect(page.getByTestId("confirm-rugi-dialog")).toBeVisible({ timeout: 3000 });
    await page.getByTestId("btn-rugi-yakin").click();
    await expect(page.getByTestId("form-toast")).toBeVisible({ timeout: 10_000 });
    const saved = await findSku(page, "Mie Rugi");
    expect(saved).toBeTruthy();
    await page.waitForTimeout(600);
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
    const badge = page.getByTestId(`badge-rugi-${saved!.id}`);
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await expect(badge).toContainText("Di bawah modal");
    await page.screenshot({ path: ".omo/evidence/ibu-02-rugi.png" });
  });

  test("HPP kosong → HPP harus lebih dari 0", async ({ page }) => {
    await page.getByTestId("nav-sku").click();
    await page.getByTestId("btn-tambah-sku").click();
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("input-nama").fill("Tanpa Modal");
    await page.getByTestId("input-harga").fill("3000");
    await page.getByTestId("btn-simpan-sku").click();
    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("form-error")).toContainText("HPP harus lebih dari 0");
  });
});
