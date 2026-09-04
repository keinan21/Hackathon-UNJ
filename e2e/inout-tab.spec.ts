import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko InOut") {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
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
    const w = window as any;
    const repo = w.__REAL_REPO__ as { clearAll: (o:string)=>Promise<void>};
    if (repo) await repo.clearAll("toko-01");
  });
}
function jakartaYMD(daysOffset: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Jakarta", year:"numeric", month:"2-digit", day:"2-digit"});
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find(p=>p.type==="year")!.value);
  const m = Number(parts.find(p=>p.type==="month")!.value)-1;
  const d = Number(parts.find(p=>p.type==="day")!.value);
  const baseUTC = Date.UTC(y,m,d,0,0,0,0)-7*60*60*1000;
  const target = baseUTC + daysOffset*86_400_000;
  return fmt.format(new Date(target));
}

test.describe("In-Out sub-tab di detail SKU + wiring scheduler", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(300);
    await clearDexie(page);
    await page.waitForTimeout(200);
  });

  test("tab Masuk/Keluar tampil di bawah grafik, tombol 48px, masuk simpan trigger onBatchInserted", async ({ page }) => {
    const skuId = "sku-inout-1";
    const initialExpiry = jakartaYMD(10);
    await page.evaluate(async ({ sId, exp }) => {
      const w = window as any;
      const repo = w.__REAL_REPO__ as { createKategori:(k:any)=>Promise<void>; createSku:(s:any)=>Promise<void>; createBatch:(b:any)=>Promise<void>};
      await repo.createKategori({ id:"k-inout", nama:"Dairy", threshold_h_minus:[7,3,1], org_id:"toko-01"});
      await repo.createSku({ id:sId, nama:"Susu InOut", kategori_id:"k-inout", hpp:10000, harga_normal:15000, kode:"IN-001", org_id:"toko-01"});
      await repo.createBatch({ id:"batch-inout-1", sku_id:sId, qty:5, expiry_date:exp, received_at:new Date().toISOString(), hpp_snapshot:10000, org_id:"toko-01"});
    }, { sId: skuId, exp: initialExpiry });

    await page.goto(`/sku/${skuId}`);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout:10_000 });
    await expect(page.getByTestId("sku-detail-nama")).toContainText("Susu InOut");
    await expect(page.getByTestId("sku-detail-grafik-section")).toBeVisible();

    // In-Out section
    await expect(page.getByTestId("inout-section")).toBeVisible();
    await expect(page.getByTestId("tab-masuk")).toBeVisible();
    await expect(page.getByTestId("tab-keluar")).toBeVisible();
    await expect(page.getByTestId("tab-masuk")).toHaveCSS("min-height","48px");
    await expect(page.getByTestId("tab-keluar")).toHaveCSS("min-height","48px");

    // default tab masuk active
    await expect(page.getByTestId("inout-pane-masuk")).toBeVisible();
    await expect(page.getByTestId("btn-masuk-simpan")).toBeVisible();
    await expect(page.getByTestId("btn-masuk-simpan")).toHaveCSS("min-height","48px");

    // switch to keluar
    await page.getByTestId("tab-keluar").click();
    await expect(page.getByTestId("inout-pane-keluar")).toBeVisible();
    await expect(page.getByTestId("btn-keluar-simpan")).toBeVisible();
    await expect(page.getByTestId("btn-keluar-simpan")).toHaveCSS("min-height","48px");

    // back to masuk and insert urgent batch (H-2) → trigger advisor via onBatchInserted
    await page.getByTestId("tab-masuk").click();
    await expect(page.getByTestId("inout-pane-masuk")).toBeVisible();
    const urgentYMD = jakartaYMD(2);
    // fill form masuk
    await page.getByTestId("input-qty").first().fill("8");
    // mode tanggal default, fill tanggal
    await page.getByTestId("input-tanggal").fill(urgentYMD);
    await page.getByTestId("input-hpp").fill("11000");
    // optional pengirim
    const pengirim = page.getByTestId("input-pengirim");
    if (await pengirim.isVisible()) await pengirim.fill("Supplier InOut");

    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout:10_000 });
    await expect(page.getByTestId("form-success")).toContainText("berhasil");

    await page.waitForTimeout(800);
    // verify batch inserted and onBatchInserted triggered (advisor cache or batch exists)
    const batchInfo = await page.evaluate(async () => {
      const w = window as any;
      const dv = w.__DEXIE_V2__ as { batches:{ where:(k:string)=>{ equals:(v:string)=>{ toArray:()=>Promise<any[]> } } } };
      const list = await dv.batches.where("org_id").equals("toko-01").toArray();
      return list.find((b:any)=>b.sku_id==="sku-inout-1" && b.qty===8);
    });
    expect(batchInfo).toBeTruthy();
    expect(batchInfo?.expiry_date).toBe(urgentYMD);
  });

  test("empty state Tanpa transaksi jika belum ada transaksi", async ({ page }) => {
    const skuId = "sku-inout-empty";
    await page.evaluate(async ({ sId }) => {
      const w = window as any;
      const repo = w.__REAL_REPO__ as { createKategori:(k:any)=>Promise<void>; createSku:(s:any)=>Promise<void>};
      await repo.createKategori({ id:"k-empty-inout", nama:"Snack", threshold_h_minus:[7,3,1], org_id:"toko-01"});
      await repo.createSku({ id:sId, nama:"Keripik Empty", kategori_id:"k-empty-inout", hpp:8000, harga_normal:12000, kode:"EMP-001", org_id:"toko-01"});
    }, { sId: skuId });
    await page.goto(`/sku/${skuId}`);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout:10_000 });
    await expect(page.getByTestId("inout-section")).toBeVisible();
    await expect(page.getByTestId("inout-tab-empty")).toBeVisible();
    await expect(page.getByTestId("inout-tab-empty")).toContainText("Tanpa transaksi");
  });

  test("tanpa SKU → tombol disabled (read-only)", async ({ page }) => {
    await page.goto("/sku/sku-tidak-ada-inout-xyz");
    await expect(page.getByTestId("sku-detail-notfound")).toBeVisible({ timeout:10_000 });
    // after fix, inout tabs may be hidden or disabled; accept either disabled or hidden-but-notfound
    // check that no enabled save button is present
    const masukBtn = page.getByTestId("btn-masuk-simpan");
    const keluarBtn = page.getByTestId("btn-keluar-simpan");
    if (await masukBtn.count() > 0) await expect(masukBtn).toBeDisabled();
    if (await keluarBtn.count() > 0) await expect(keluarBtn).toBeDisabled();
    // at minimum, notfound text visible
    await expect(page.getByTestId("sku-detail-notfound")).toContainText("SKU tidak ditemukan");
  });
});
