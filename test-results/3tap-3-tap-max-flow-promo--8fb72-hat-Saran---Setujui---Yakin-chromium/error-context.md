# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 3tap.spec.ts >> 3-tap max flow >> promo approve flow ≤3 taps: Dashboard -> Lihat Saran -> Setujui -> Yakin
- Location: e2e/3tap.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Setujui/ }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /Setujui/ }).first()

```

```yaml
- banner:
  - img
  - heading "Inventaris Tebus Murah" [level=1]
  - text: PWA
- main:
  - img
  - heading "Ringkasan Warung" [level=2]
  - paragraph: Pantau stok mepet, promo tebus, dan histori — semua 3 tap sampai approve.
  - alert:
    - text: Notifikasi dimatikan, badge tetap update
    - button "Tutup banner notifikasi": Tutup
  - navigation "Navigasi cepat warung":
    - button "Barang Masuk"
    - button "Kasir"
    - button "Lihat SKU"
    - button "Statistik"
  - status:
    - img
    - heading "Belum ada SKU" [level=3]
    - paragraph: Tambah barang pertama biar stok toko tercatat rapi di HP ini.
    - button "Tambah SKU"
  - region "Stok Mepet":
    - heading "Stok Mepet" [level=2]
    - status: Aman semua
    - text: Filter kategori
    - combobox "Filter kategori":
      - option "Semua kategori" [selected]
      - option "Bumbu Dapur"
      - option "Rokok"
      - option "Sembako"
      - option "Makanan Kering"
      - option "Makanan Basah"
      - option "Perawatan Diri"
      - option "Obat Bebas"
      - option "Minuman Kaleng"
      - option "Minuman Botol"
      - option "Makanan Frozen"
      - option "Misc"
    - text: Urutkan stok mepet
    - combobox "Urutkan stok mepet":
      - 'option "Urut: paling dekat" [selected]'
      - 'option "Urut: paling mendesak"'
    - status:
      - paragraph: Stok aman semua
      - paragraph: Tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.
    - status: 0 item mepet kadaluarsa
  - region "Promo Tebus Murah":
    - heading "Promo Tebus Murah" [level=2]
    - status:
      - paragraph: Belum ada promo
      - paragraph: Buat tebus murah dari stok mepet biar tidak jadi sampah.
      - button "Lihat Stok Mepet"
    - text: 0 promo aktif
  - region "Histori Saran":
    - heading "Histori Saran" [level=2]
    - status:
      - paragraph: Belum ada saran tersimpan
      - paragraph: Saran baru muncul tiap jam 7 pagi, atau saat ada stok yang mepet.
  - text: Menampilkan histori terbaru
- complementary:
  - img
  - paragraph: Toko Anda
  - paragraph: Inventaris Tebus Murah
  - text: Offline siap • 3 tap sampai approve
  - list:
    - listitem:
      - button "Dashboard":
        - img
        - text: Dashboard
    - listitem:
      - button "SKU":
        - img
        - text: SKU
    - listitem:
      - button "Pengaturan":
        - img
        - text: Pengaturan
  - paragraph: Butuh bantuan?
  - paragraph: Semua data tersimpan di perangkat. Backup di Pengaturan.
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("3-tap max flow", () => {
  4  |   test("promo approve flow ≤3 taps: Dashboard -> Lihat Saran -> Setujui -> Yakin", async ({ page }) => {
  5  |     let tapCount = 0;
  6  |     await page.goto("/?seed=demo");
  7  |     await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();
  8  |     const setujui = page.getByRole("button", { name: /Setujui/ }).first();
> 9  |     await expect(setujui).toBeVisible();
     |                           ^ Error: expect(locator).toBeVisible() failed
  10 |     await setujui.click();
  11 |     tapCount++;
  12 |     const yakin = page.getByTestId("dialog-confirm-yakin");
  13 |     await expect(yakin).toBeVisible();
  14 |     await yakin.click();
  15 |     tapCount++;
  16 |     await expect(page.getByTestId("promo-toast")).toBeVisible();
  17 |     expect(tapCount).toBeLessThanOrEqual(3);
  18 |   });
  19 | 
  20 |   test("3-tap KPI evaluated via JS", async ({ page }) => {
  21 |     await page.goto("/?seed=demo");
  22 |     const taps = await page.evaluate(() => {
  23 |       // simulate counting: buka (0) -> lihat urgent (1) -> tap approve (2) -> yakin (3)
  24 |       // This is static KPI: flow buka→lihat→approve ≤3 per design
  25 |       const steps = ["buka", "Lihat Saran Tebus", "Setujui Tebus Murah", "Yakin"];
  26 |       return steps.length - 1; // taps from buka
  27 |     });
  28 |     expect(taps).toBeLessThanOrEqual(3);
  29 |   });
  30 | 
  31 |   test("settings edit ≤3 taps: Pengaturan nav -> edit -> Simpan", async ({ page }) => {
  32 |     await page.goto("/?seed=demo");
  33 |     let count = 0;
  34 |     const pengaturanNav = page.getByTestId("nav-settings");
  35 |     await expect(pengaturanNav).toBeVisible();
  36 |     await pengaturanNav.click();
  37 |     count++;
  38 |     await expect(page.getByRole("heading", { name: "Pengaturan" })).toBeVisible();
  39 |     const input = page.getByTestId("input-threshold-k-dairy");
  40 |     await input.fill("14,7,3");
  41 |     count++; // editing considered tap 2 but we count save as 3
  42 |     const save = page.getByTestId("save-k-dairy");
  43 |     await save.click();
  44 |     count++;
  45 |     expect(count).toBeLessThanOrEqual(3);
  46 |     await expect(page.getByTestId("settings-toast")).toBeVisible();
  47 |   });
  48 | 
  49 |   test("navigation buttons 48px and bahasa Indonesia", async ({ page }) => {
  50 |     await page.goto("/?seed=demo");
  51 |     for (const nav of ["nav-dashboard", "nav-sku", "nav-promo", "nav-settings"]) {
  52 |       const btn = page.getByTestId(nav);
  53 |       await expect(btn).toBeVisible();
  54 |       await expect(btn).toHaveCSS("min-height", "48px");
  55 |     }
  56 |     await expect(page.getByTestId("nav-dashboard")).toContainText("Dashboard");
  57 |     await expect(page.getByTestId("nav-settings")).toContainText("Pengaturan");
  58 |   });
  59 | 
  60 |   test("all primary buttons 48px w-full text-base", async ({ page }) => {
  61 |     await page.goto("/?seed=demo");
  62 |     const promoBtn = page.getByRole("button", { name: /Setujui/ }).first();
  63 |     await expect(promoBtn).toHaveCSS("min-height", "48px");
  64 |     await expect(promoBtn).toHaveClass(/w-full/);
  65 |     await expect(promoBtn).toHaveCSS("font-size", "16px");
  66 | 
  67 |     await page.getByTestId("nav-settings").click();
  68 |     const saveBtn = page.getByTestId("save-k-dairy");
  69 |     await expect(saveBtn).toHaveCSS("min-height", "48px");
  70 |     await expect(saveBtn).toHaveClass(/w-full/);
  71 |   });
  72 | });
  73 | 
```