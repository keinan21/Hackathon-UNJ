import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Delta") {
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
    await repo.createKategori({ id: "k-semb", nama: "Sembako", threshold_h_minus: [60, 30, 14], org_id: "toko-01" });
    await repo.createSku({ id: "sku-beras", nama: "Beras 5kg", kategori_id: "k-semb", hpp: 10000, harga_normal: 15000, kode: "SEM-001", org_id: "toko-01" });
  });
}

async function isiMasukBedaHarga(page: import("@playwright/test").Page) {
  await page.goto("/masuk");
  await expect(page.getByTestId("inbound-page")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("select-inbound-sku").selectOption("sku-beras");
  await page.getByTestId("input-qty").fill("5");
  const exp = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await page.getByTestId("input-tanggal").fill(exp);
  await page.getByTestId("input-hpp").fill("12000");
}

async function readHppState(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { getSku: (id: string) => Promise<{ hpp: number } | undefined> };
    const dv = w.__DEXIE_V2__ as { hpp_history: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ hpp_lama: number; hpp_baru: number }>> } } } };
    const sku = await repo.getSku("sku-beras");
    const hist = await dv.hpp_history.where("org_id").equals("toko-01").toArray().catch(() => []);
    return { hpp: sku?.hpp, hist };
  });
}

test.describe("Delta HPP barang masuk — teks + persetujuan", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(400);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Delta", updated_at: new Date().toISOString() })));
    await seedSku(page);
    await page.reload();
  });

  test("beda harga → teks delta + wajib centang baru tersimpan + arsip", async ({ page }) => {
    await isiMasukBedaHarga(page);
    await expect(page.getByTestId("hpp-delta-text")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("hpp-delta-text")).toContainText("Rp10.000 → Rp12.000");

    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("form-error")).toContainText("Centang persetujuan ubah modal dulu Bu");

    await page.getByTestId("hpp-delta-check").check();
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });

    const st = await readHppState(page);
    expect(st.hpp).toBe(12000);
    expect(st.hist.some((h) => h.hpp_lama === 10000 && h.hpp_baru === 12000)).toBe(true);
    await page.screenshot({ path: ".omo/evidence/ibu-03-hpp.png" });
  });

  test("harga sama → tanpa panel delta, langsung simpan", async ({ page }) => {
    await page.goto("/masuk");
    await expect(page.getByTestId("inbound-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("select-inbound-sku").selectOption("sku-beras");
    await page.getByTestId("input-qty").fill("5");
    const exp = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await page.getByTestId("input-tanggal").fill(exp);
    await page.getByTestId("input-hpp").fill("10000");
    await expect(page.getByTestId("hpp-delta-text")).toBeHidden({ timeout: 3000 });
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });
    const st = await readHppState(page);
    expect(st.hpp).toBe(10000);
  });

  test("harga beli 0 → Harga beli harus lebih dari 0", async ({ page }) => {
    await page.goto("/masuk");
    await expect(page.getByTestId("inbound-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("select-inbound-sku").selectOption("sku-beras");
    await page.getByTestId("input-qty").fill("5");
    const exp = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await page.getByTestId("input-tanggal").fill(exp);
    await page.getByTestId("input-hpp").fill("0");
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("form-error")).toContainText("Harga beli harus lebih dari 0");
  });
});
