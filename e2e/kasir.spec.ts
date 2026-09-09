import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Kasir") {
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

async function seedKasir(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as {
      createKategori: (c: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
      createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
      createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
    };
    await repo.createKategori({ id: "k-ks", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
    await repo.createSku({ id: "sku-ks-susu", nama: "Susu UHT 1L", kategori_id: "k-ks", hpp: 10000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" });
    await repo.createSku({ id: "sku-ks-roti", nama: "Roti Tawar", kategori_id: "k-ks", hpp: 8000, harga_normal: 12000, kode: "ROT-001", org_id: "toko-01" });
    const now = new Date().toISOString();
    const near = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const far = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await repo.createBatch({ id: "b-ks-1", sku_id: "sku-ks-susu", qty: 5, expiry_date: near, received_at: now, hpp_snapshot: 10000, org_id: "toko-01" });
    await repo.createBatch({ id: "b-ks-2", sku_id: "sku-ks-susu", qty: 10, expiry_date: far, received_at: now, hpp_snapshot: 10000, org_id: "toko-01" });
    await repo.createBatch({ id: "b-ks-3", sku_id: "sku-ks-roti", qty: 4, expiry_date: far, received_at: now, hpp_snapshot: 8000, org_id: "toko-01" });
  });
}

async function readBatches(page: import("@playwright/test").Page, skuId: string) {
  return page.evaluate(async ({ s }) => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { listBatchesBySku: (sku: string, o: string) => Promise<Array<{ id: string; qty: number; expiry_date: string | null }>> };
    return repo.listBatchesBySku(s, "toko-01");
  }, { s: skuId });
}

test.describe("Kasir /keluar — keranjang multi-barang FEFO", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(400);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Kasir", updated_at: new Date().toISOString() })));
    await seedKasir(page);
    await page.reload();
  });

  test("2 barang → total Rp42.000 → FEFO 5+10 keluar 7 jadi 0+8 + transaksi", async ({ page }) => {
    await page.goto("/keluar");
    await expect(page.getByTestId("kasir-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("kasir-empty-hint")).toBeVisible();
    await expect(page.getByTestId("kasir-simpan")).toBeDisabled();

    await page.getByTestId("kasir-search").fill("susu");
    await expect(page.getByTestId("kasir-row-sku-ks-susu")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("kasir-plus-sku-ks-susu").click();
    await page.getByTestId("kasir-plus-sku-ks-susu").click();
    await page.getByTestId("kasir-search").fill("");
    await expect(page.getByTestId("kasir-row-sku-ks-roti")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("kasir-plus-sku-ks-roti").click();
    await expect(page.getByTestId("kasir-total")).toContainText("Rp42.000");

    await page.getByTestId("kasir-simpan").click();
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("form-success")).toContainText("Penjualan tersimpan");

    const susu = await readBatches(page, "sku-ks-susu");
    const near = susu.find((b) => b.id === "b-ks-1");
    const far = susu.find((b) => b.id === "b-ks-2");
    expect(near?.qty).toBe(3);
    expect(far?.qty).toBe(10);
    const roti = await readBatches(page, "sku-ks-roti");
    expect(roti.find((b) => b.id === "b-ks-3")?.qty).toBe(3);

    const trans = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const dv = w.__DEXIE_V2__ as { transaksis: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ sku_id: string; qty_sold: number; jenis: string; harga_jual_snapshot: number }>> } } } };
      return dv.transaksis.where("org_id").equals("toko-01").toArray();
    });
    const keluar = trans.filter((t) => t.jenis === "keluar");
    expect(keluar).toHaveLength(2);
    expect(keluar.find((t) => t.sku_id === "sku-ks-susu")?.harga_jual_snapshot).toBe(15000);
    await page.screenshot({ path: ".omo/evidence/ibu-07-kasir.png" });
  });

  test("qty 99 dari stok 12 → error per-baris, stok utuh (all-or-nothing)", async ({ page }) => {
    await page.goto("/keluar");
    await expect(page.getByTestId("kasir-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("kasir-qty-sku-ks-susu").fill("99");
    await page.getByTestId("kasir-plus-sku-ks-roti").click();
    await page.getByTestId("kasir-simpan").click();
    const err = page.getByTestId("kasir-error-sku-ks-susu");
    await expect(err).toBeVisible({ timeout: 5000 });
    await expect(err).toContainText("Stok tidak cukup");
    const susu = await readBatches(page, "sku-ks-susu");
    expect(susu.find((b) => b.id === "b-ks-1")?.qty).toBe(5);
    expect(susu.find((b) => b.id === "b-ks-2")?.qty).toBe(10);
    const roti = await readBatches(page, "sku-ks-roti");
    expect(roti.find((b) => b.id === "b-ks-3")?.qty).toBe(4);
  });

  test("keranjang kosong → tombol disabled + hint", async ({ page }) => {
    await page.goto("/keluar");
    await expect(page.getByTestId("kasir-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("kasir-simpan")).toBeDisabled();
    await expect(page.getByTestId("kasir-empty-hint")).toBeVisible();
    await expect(page.getByTestId("kasir-total")).toContainText("Rp0");
  });
});
