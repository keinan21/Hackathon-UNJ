# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shell.spec.ts >> Shell responsif + tema + primitif cantik >> desktop 1280: drawer sidebar permanen + bottom-nav tersembunyi + nama toko + ikon
- Location: e2e/shell.spec.ts:21:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('nav-promo')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('nav-promo')

```

```yaml
- banner:
  - img
  - heading "Toko Shell Desktop" [level=1]
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
      - option "Makanan Frozen"
      - option "Perawatan Diri"
      - option "Makanan Basah"
      - option "Rokok"
      - option "Minuman Kaleng"
      - option "Misc"
      - option "Minuman Botol"
      - option "Sembako"
      - option "Bumbu Dapur"
      - option "Obat Bebas"
      - option "Makanan Kering"
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
  - paragraph: Toko Shell Desktop
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
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | async function loginViaUI(page: import("@playwright/test").Page, nama = "Toko Shell") {
  4   |   await page.goto("/");
  5   |   await page.evaluate(() => {
  6   |     localStorage.clear();
  7   |     sessionStorage.clear();
  8   |   });
  9   |   await page.reload();
  10  |   await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });
  11  |   await page.getByTestId("input-nama-toko").fill(nama);
  12  |   await page.getByTestId("input-pin").fill("1234");
  13  |   await page.getByTestId("input-pin-confirm").fill("1234");
  14  |   await page.getByTestId("btn-masuk").click();
  15  |   await expect(page.getByTestId("header-title")).toBeVisible({ timeout: 10_000 });
  16  |   // wait for dashboard content
  17  |   await expect(page.getByText("Ringkasan Warung")).toBeVisible({ timeout: 10_000 }).catch(() => {});
  18  | }
  19  | 
  20  | test.describe("Shell responsif + tema + primitif cantik", () => {
  21  |   test("desktop 1280: drawer sidebar permanen + bottom-nav tersembunyi + nama toko + ikon", async ({ page }) => {
  22  |     await page.setViewportSize({ width: 1280, height: 800 });
  23  |     await loginViaUI(page, "Toko Shell Desktop");
  24  | 
  25  |     const drawer = page.getByTestId("drawer-side");
  26  |     await expect(drawer).toBeVisible({ timeout: 10_000 });
  27  | 
  28  |     // bottom-nav harus hidden di desktop (lg:hidden)
  29  |     const bottomNav = page.getByTestId("bottom-nav");
  30  |     await expect(bottomNav).toBeHidden();
  31  | 
  32  |     // header-title harus terlihat (desktop top bar hidden helper but konten ada)
  33  |     await expect(page.getByTestId("header-title").first()).toBeVisible();
  34  | 
  35  |     // sidebar nama toko
  36  |     await expect(page.getByTestId("sidebar-store-name")).toBeVisible();
  37  |     await expect(page.getByTestId("sidebar-store-name")).toContainText("Toko Shell Desktop");
  38  | 
  39  |     // menu 4 item dengan ikon + label
  40  |     for (const id of ["nav-dashboard", "nav-sku", "nav-promo", "nav-settings"]) {
  41  |       const el = page.getByTestId(id);
> 42  |       await expect(el).toBeVisible();
      |                        ^ Error: expect(locator).toBeVisible() failed
  43  |       // ikon svg ada
  44  |       await expect(el.locator("svg").first()).toBeVisible();
  45  |     }
  46  |     await expect(page.getByTestId("nav-dashboard")).toContainText("Dashboard");
  47  |     await expect(page.getByTestId("nav-sku")).toContainText("SKU");
  48  |     await expect(page.getByTestId("nav-promo")).toContainText("Promo");
  49  |     await expect(page.getByTestId("nav-settings")).toContainText("Pengaturan");
  50  | 
  51  |     // drawer-toggle hidden logic — at desktop drawer-open, overlay hidden
  52  |     await expect(page.getByTestId("drawer-overlay")).toBeHidden();
  53  | 
  54  |     // main content container max-w-7xl (not 480 locked) — check container class includes max-w-7xl expectation via computed
  55  |     const main = page.getByTestId("main-content");
  56  |     await expect(main).toBeVisible();
  57  |     const hasMax7xl = await main.evaluate((el) => el.className.includes("max-w-7xl"));
  58  |     expect(hasMax7xl).toBeTruthy();
  59  | 
  60  |     // konten tidak tertutup nav — sentinel visible
  61  |     const sentinel = page.getByTestId("content-end-sentinel");
  62  |     await expect(sentinel).toBeVisible();
  63  |     // padding-bottom desktop minimal 16px (lg:pb-8)
  64  |     const pb = await main.evaluate((el) => getComputedStyle(el).paddingBottom);
  65  |     expect(parseInt(pb, 10)).toBeGreaterThanOrEqual(16);
  66  |   });
  67  | 
  68  |   test("mobile 390: bottom-nav terlihat + hamburger buka drawer overlay", async ({ page }) => {
  69  |     await page.setViewportSize({ width: 390, height: 844 });
  70  |     await loginViaUI(page, "Toko Shell Mobile");
  71  | 
  72  |     const bottomNav = page.getByTestId("bottom-nav");
  73  |     await expect(bottomNav).toBeVisible();
  74  | 
  75  |     // cek bottom-nav items mobile distinct
  76  |     for (const id of ["bottom-nav-dashboard", "bottom-nav-sku", "bottom-nav-promo", "bottom-nav-settings"]) {
  77  |       await expect(page.getByTestId(id)).toBeVisible();
  78  |     }
  79  | 
  80  |     // drawer-side awalnya tersembunyi (off-screen) — cek tidak visible atau overlay hidden
  81  |     const drawer = page.getByTestId("drawer-side");
  82  |     // hamburger visible
  83  |     const ham = page.getByTestId("hamburger-button");
  84  |     await expect(ham).toBeVisible();
  85  |     await expect(ham).toHaveCSS("min-height", "48px");
  86  | 
  87  |     // buka drawer via hamburger
  88  |     await ham.click();
  89  |     // drawer-side should become visible, overlay visible
  90  |     await expect(drawer).toBeVisible({ timeout: 3000 });
  91  |     await expect(page.getByTestId("drawer-overlay")).toBeVisible();
  92  | 
  93  |     // menu di drawer tetap bisa diklik
  94  |     await expect(page.getByTestId("nav-dashboard")).toBeVisible();
  95  |     // tutup via close button (lebih reliable daripada overlay label di preview)
  96  |     const closeBtn = page.getByTestId("drawer-close-button");
  97  |     if (await closeBtn.isVisible()) {
  98  |       await closeBtn.click();
  99  |     } else {
  100 |       await page.getByTestId("drawer-overlay").click();
  101 |     }
  102 |     await page.evaluate(() => {
  103 |       const el = document.getElementById("drawer-toggle") as HTMLInputElement | null;
  104 |       if (el) {
  105 |         el.checked = false;
  106 |         el.dispatchEvent(new Event("change", { bubbles: true }));
  107 |       }
  108 |     });
  109 |     await page.waitForTimeout(350);
  110 |     await expect(page.locator("#drawer-toggle")).not.toBeChecked({ timeout: 3000 });
  111 |   });
  112 | 
  113 |   test("menu navigasi jalan — klik Dashboard/SKU/Promo/Pengaturan pindah view", async ({ page }) => {
  114 |     await page.setViewportSize({ width: 1280, height: 800 });
  115 |     await loginViaUI(page, "Toko Nav Jalan");
  116 | 
  117 |     // Dashboard view default — Ringkasan Warung + Stok Mepet
  118 |     await expect(page.getByText("Ringkasan Warung").first()).toBeVisible();
  119 |     await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();
  120 | 
  121 |     await page.getByTestId("nav-sku").click();
  122 |     await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
  123 | 
  124 |     // Promo
  125 |     await page.getByTestId("nav-promo").click();
  126 |     await expect(page.getByText(/Promo Tebus Murah|Promo/i).first()).toBeVisible({ timeout: 10_000 });
  127 | 
  128 |     // Pengaturan
  129 |     await page.getByTestId("nav-settings").click();
  130 |     await expect(page.getByText(/Pengaturan|Backup|Profil/i).first()).toBeVisible({ timeout: 10_000 });
  131 | 
  132 |     // Kembali Dashboard
  133 |     await page.getByTestId("nav-dashboard").click();
  134 |     await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible({ timeout: 10_000 });
  135 |   });
  136 | 
  137 |   test("mobile menu navigasi via bottom-nav pindah view", async ({ page }) => {
  138 |     await page.setViewportSize({ width: 390, height: 844 });
  139 |     await loginViaUI(page, "Toko Nav Mobile");
  140 | 
  141 |     await page.getByTestId("bottom-nav-sku").click();
  142 |     await expect(page.getByText(/Katalog|Belum ada SKU|SKU/i).first()).toBeVisible({ timeout: 10_000 });
```