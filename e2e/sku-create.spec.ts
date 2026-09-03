import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko SKU") {
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
    const dv = w.__DEXIE_V2__ as { tags: { where: (k: string) => { equals: (v: string) => { delete: () => Promise<void> } } }; sku_tags: { where: (k: string) => { equals: (v: string) => { delete: () => Promise<void> } } } } | undefined;
    try {
      if (dv) {
        await dv.tags.where("org_id").equals("toko-01").delete().catch(() => {});
        await dv.sku_tags.where("org_id").equals("toko-01").delete().catch(() => {});
      }
    } catch {}
  });
}

async function seedKategoriViaRepo(page: import("@playwright/test").Page, kat: { id: string; nama: string; threshold: number[] }) {
  await page.evaluate(async ({ k }) => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { createKategori: (c: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void> };
    await repo.createKategori({ id: k.id, nama: k.nama, threshold_h_minus: k.threshold, org_id: "toko-01" });
  }, { k: kat });
}

test.describe("SKU create form — barcode, tag, preview, warning", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(400);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko SKU", updated_at: new Date().toISOString() })));
  });

  test("buat SKU lengkap valid → sukses + kode preview + tag terpasang", async ({ page }) => {
    await seedKategoriViaRepo(page, { id: "k-mkr", nama: "Makanan Kering", threshold: [30, 14, 7] });
    await page.reload();
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("btn-tambah-sku").click();
    await expect(page).toHaveURL(/\/sku\/baru/);
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("preview-kode")).toBeVisible();
    await expect(page.getByTestId("preview-kode")).toContainText("MKR-001");

    await page.getByTestId("select-kategori").selectOption("k-mkr");
    await page.getByTestId("input-nama").fill("Roti Tawar Gandum");
    await page.getByTestId("input-hpp").fill("8000");
    await page.getByTestId("input-harga").fill("12000");
    await page.getByTestId("input-barcode").fill("8991001001001");
    await page.getByTestId("input-tags").fill("laris, kulkas");

    await expect(page.getByTestId("btn-simpan-sku")).toHaveCSS("min-height", "48px");
    await expect(page.getByTestId("btn-simpan-sku")).toHaveCSS("font-size", "16px");
    await expect(page.getByTestId("input-nama")).toHaveCSS("min-height", "48px");

    await page.getByTestId("btn-simpan-sku").click();

    await expect(page.getByTestId("form-toast")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("form-toast")).toContainText("berhasil");

    await page.waitForTimeout(600);
    await expect(page).toHaveURL("/");
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Roti Tawar Gandum")).toBeVisible({ timeout: 10_000 });

    const skuKode = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { listSkus: (o: string) => Promise<Array<{ kode: string; nama: string }>> };
      const list = await repo.listSkus("toko-01");
      const found = list.find((s) => s.nama === "Roti Tawar Gandum");
      return found?.kode ?? "";
    });
    expect(skuKode).toBe("MKR-001");

    const hasTags = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const dv = w.__DEXIE_V2__ as { tags: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ nama: string }>> } } }; sku_tags: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ sku_id: string }>> } } } };
      const tags = await dv.tags.where("org_id").equals("toko-01").toArray();
      return tags.map((t) => t.nama).sort().join(",");
    });
    expect(hasTags).toContain("kulkas");
    expect(hasTags).toContain("laris");
  });

  test("barcode duplikat → Barcode sudah dipakai", async ({ page }) => {
    await seedKategoriViaRepo(page, { id: "k-mkr2", nama: "Makanan Kering", threshold: [30, 14, 7] });
    await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; barcode?: string; kode?: string; org_id: string }) => Promise<void> };
      await repo.createSku({ id: "sku-exist", nama: "Roti Existing", kategori_id: "k-mkr2", hpp: 8000, harga_normal: 12000, barcode: "8999990001", kode: "MKR-001", org_id: "toko-01" });
    });
    await page.reload();
    await page.getByTestId("nav-sku").click();
    await page.getByTestId("btn-tambah-sku").click();
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("input-nama").fill("Roti Baru");
    await page.getByTestId("input-hpp").fill("8000");
    await page.getByTestId("input-harga").fill("12000");
    await page.getByTestId("input-barcode").fill("8999990001");
    await page.getByTestId("btn-simpan-sku").click();

    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("form-error")).toContainText("Barcode sudah dipakai");
    await expect(page.getByTestId("sku-baru-page")).toBeVisible();
  });

  test("harga di bawah HPP → warning kuning tampil dan tetap boleh simpan", async ({ page }) => {
    await seedKategoriViaRepo(page, { id: "k-sembako", nama: "Sembako", threshold: [60, 30, 14] });
    await page.reload();
    await page.getByTestId("nav-sku").click();
    await page.getByTestId("btn-tambah-sku").click();
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("input-nama").fill("Beras Premium");
    await page.getByTestId("input-hpp").fill("60000");
    await page.getByTestId("input-harga").fill("50000");

    await expect(page.getByTestId("warning-harga")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("warning-harga")).toContainText("di bawah HPP");

    await page.getByTestId("btn-simpan-sku").click();
    await expect(page.getByTestId("form-toast")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("form-toast")).toContainText("berhasil");

    const saved = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { listSkus: (o: string) => Promise<Array<{ nama: string; hpp: number; harga_normal: number }>> };
      const list = await repo.listSkus("toko-01");
      return list.find((s) => s.nama === "Beras Premium");
    });
    expect(saved).toBeTruthy();
    expect(saved?.harga_normal).toBe(50000);
  });

  test("preview kode berubah saat ganti kategori + validasi HPP wajib >0", async ({ page }) => {
    await seedKategoriViaRepo(page, { id: "k-sembako2", nama: "Sembako", threshold: [60, 30, 14] });
    await seedKategoriViaRepo(page, { id: "k-rokok", nama: "Rokok", threshold: [180, 90, 30] });
    await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void> };
      await repo.createSku({ id: "sku-sem-1", nama: "Beras Lama", kategori_id: "k-sembako2", hpp: 50000, harga_normal: 60000, kode: "SEM-001", org_id: "toko-01" });
      await repo.createSku({ id: "sku-sem-2", nama: "Minyak Lama", kategori_id: "k-sembako2", hpp: 20000, harga_normal: 25000, kode: "SEM-002", org_id: "toko-01" });
    });
    await page.reload();
    await page.getByTestId("nav-sku").click();
    await page.getByTestId("btn-tambah-sku").click();
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("select-kategori").selectOption("k-sembako2");
    await expect(page.getByTestId("preview-kode")).toContainText("SEM-003", { timeout: 3000 });

    await page.getByTestId("select-kategori").selectOption("k-rokok");
    await expect(page.getByTestId("preview-kode")).toContainText("RKK-001");

    await page.getByTestId("input-nama").fill("Rokok Baru");
    await page.getByTestId("input-hpp").fill("0");
    await page.getByTestId("input-harga").fill("10000");
    await page.getByTestId("btn-simpan-sku").click();
    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("form-error")).toContainText("HPP harus lebih dari 0");

    await page.getByTestId("input-hpp").fill("25000");
    await page.getByTestId("input-harga").fill("30000");
    await page.getByTestId("btn-simpan-sku").click();
    await expect(page.getByTestId("form-toast")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("form-toast")).toContainText("berhasil");
  });
});
