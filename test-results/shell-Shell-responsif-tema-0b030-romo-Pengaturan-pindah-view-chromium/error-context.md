# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shell.spec.ts >> Shell responsif + tema + primitif cantik >> menu navigasi jalan — klik Dashboard/SKU/Promo/Pengaturan pindah view
- Location: e2e/shell.spec.ts:113:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('nav-promo')

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - generic [ref=f1e4]:
    - banner [ref=f1e5]:
      - heading "Toko Nav Jalan" [level=1] [ref=f1e14]
      - generic [ref=f1e15]: PWA
    - main [ref=f1e17]:
      - generic [ref=f1e18]:
        - alert [ref=f1e19]:
          - generic [ref=f1e20]: Notifikasi dimatikan, badge tetap update
          - button "Tutup banner notifikasi" [ref=f1e22] [cursor=pointer]: Tutup
        - generic [ref=f1e23]:
          - generic [ref=f1e24]:
            - generic [ref=f1e29]:
              - heading "Katalog SKU" [level=2] [ref=f1e30]
              - paragraph [ref=f1e31]: Cari, filter, dan kelola barang — semua stok di satu tempat.
            - generic [ref=f1e33]:
              - button "Barang Masuk" [ref=f1e34] [cursor=pointer]
              - button "Tambah SKU" [ref=f1e35] [cursor=pointer]
          - searchbox "Cari SKU" [ref=f1e39]
          - group "Filter kategori dan tag" [ref=f1e40]:
            - generic [ref=f1e41]: Filter kategori
            - combobox "Filter kategori" [ref=f1e42]:
              - option "Semua kategori" [selected]
              - option "Makanan Basah"
              - option "Minuman Botol"
              - option "Perawatan Diri"
              - option "Makanan Kering"
              - option "Misc"
              - option "Sembako"
              - option "Minuman Kaleng"
              - option "Bumbu Dapur"
              - option "Makanan Frozen"
              - option "Obat Bebas"
              - option "Rokok"
            - generic [ref=f1e43]: Filter tag
            - combobox "Filter tag" [ref=f1e44]:
              - option "Semua tag" [selected]
          - status [ref=f1e45]:
            - generic [ref=f1e47]:
              - heading "Belum ada SKU" [level=3] [ref=f1e51]
              - paragraph [ref=f1e52]: Mulai dengan tambah barang pertama. Mudah — cukup nama, kategori, dan harga.
              - button "Tambah SKU" [ref=f1e54] [cursor=pointer]
          - status [ref=f1e55]: 0 SKU ditemukan
  - generic [ref=f1e57]:
    - generic "close sidebar"
    - complementary [ref=f1e58]:
      - generic [ref=f1e59]:
        - generic [ref=f1e68]:
          - paragraph [ref=f1e69]: Toko Anda
          - paragraph [ref=f1e70]: Toko Nav Jalan
        - generic [ref=f1e71]:
          - generic [ref=f1e72]: Offline siap
          - generic [ref=f1e73]: •
          - generic [ref=f1e74]: 3 tap sampai approve
      - list [ref=f1e75]:
        - listitem [ref=f1e76]:
          - button "Dashboard" [ref=f1e77]
        - listitem [ref=f1e81]:
          - button "SKU" [active] [ref=f1e82] [cursor=pointer]
        - listitem [ref=f1e86]:
          - button "Pengaturan" [ref=f1e87]
      - generic [ref=f1e92]:
        - paragraph [ref=f1e93]: Butuh bantuan?
        - paragraph [ref=f1e94]: Semua data tersimpan di perangkat. Backup di Pengaturan.
```

# Test source

```ts
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
  42  |       await expect(el).toBeVisible();
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
> 125 |     await page.getByTestId("nav-promo").click();
      |                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  143 | 
  144 |     await page.getByTestId("bottom-nav-promo").click();
  145 |     await expect(page.getByText(/Promo/i).first()).toBeVisible({ timeout: 10_000 });
  146 | 
  147 |     await page.getByTestId("bottom-nav-settings").click();
  148 |     await expect(page.getByText(/Pengaturan|Backup/i).first()).toBeVisible({ timeout: 10_000 });
  149 | 
  150 |     await page.getByTestId("bottom-nav-dashboard").click();
  151 |     await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible({ timeout: 10_000 });
  152 |   });
  153 | 
  154 |   test("konten paling bawah tidak tertutup bottom-nav (no-overlap boundingBox)", async ({ page }) => {
  155 |     await page.setViewportSize({ width: 390, height: 844 });
  156 |     await loginViaUI(page, "Toko Overlap");
  157 | 
  158 |     const main = page.getByTestId("main-content");
  159 |     const sentinel = page.getByTestId("content-end-sentinel");
  160 |     const bottomNav = page.getByTestId("bottom-nav");
  161 | 
  162 |     await expect(sentinel).toBeVisible();
  163 |     await expect(bottomNav).toBeVisible();
  164 | 
  165 |     const sentinelBox = await sentinel.boundingBox();
  166 |     const navBox = await bottomNav.boundingBox();
  167 |     expect(sentinelBox).not.toBeNull();
  168 |     expect(navBox).not.toBeNull();
  169 |     await sentinel.scrollIntoViewIfNeeded();
  170 |     const afterSentinelBox = await sentinel.boundingBox();
  171 |     const afterNavBox = await bottomNav.boundingBox();
  172 |     expect(afterSentinelBox).not.toBeNull();
  173 |     expect(afterNavBox).not.toBeNull();
  174 |     if (afterSentinelBox && afterNavBox) {
  175 |       expect(afterSentinelBox.y + afterSentinelBox.height).toBeLessThanOrEqual(afterNavBox.y + 4);
  176 |     }
  177 | 
  178 |     const lastCta = page.locator('[data-testid="main-content"] button').last();
  179 |     if (await lastCta.count() > 0) {
  180 |       await expect(lastCta).toBeVisible();
  181 |       await lastCta.scrollIntoViewIfNeeded();
  182 |       await page.waitForTimeout(200);
  183 |       const ctaBox = await lastCta.boundingBox();
  184 |       const navBox2 = await bottomNav.boundingBox();
  185 |       expect(ctaBox).not.toBeNull();
  186 |       expect(navBox2).not.toBeNull();
  187 |       if (ctaBox && navBox2) {
  188 |         expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(navBox2.y + 2);
  189 |       }
  190 |       const overlap = await lastCta.evaluate((el) => {
  191 |         const r = el.getBoundingClientRect();
  192 |         const nav = document.querySelector('[data-testid="bottom-nav"]') as HTMLElement | null;
  193 |         if (!nav) return false;
  194 |         const nr = nav.getBoundingClientRect();
  195 |         return !(r.bottom <= nr.top || r.top >= nr.bottom);
  196 |       });
  197 |       expect(overlap).toBe(false);
  198 |     }
  199 | 
  200 |     const mainPb = await main.evaluate((el) => parseInt(getComputedStyle(el).paddingBottom, 10));
  201 |     expect(mainPb).toBeGreaterThanOrEqual(120);
  202 | 
  203 |     await page.setViewportSize({ width: 1280, height: 800 });
  204 |     await expect(page.getByTestId("bottom-nav")).toBeHidden();
  205 |     await expect(sentinel).toBeVisible();
  206 |     const mainPbDesktop = await main.evaluate((el) => parseInt(getComputedStyle(el).paddingBottom, 10));
  207 |     expect(mainPbDesktop).toBeLessThanOrEqual(40);
  208 |   });
  209 | 
  210 |   test("primitif dipakai shell — PageHeader + rounded-2xl card + Bahasa sederhana", async ({ page }) => {
  211 |     await page.setViewportSize({ width: 1280, height: 800 });
  212 |     await loginViaUI(page, "Toko Primitif");
  213 | 
  214 |     await expect(page.getByText("Ringkasan Warung").first()).toBeVisible();
  215 |     await expect(page.getByText(/3 tap sampai approve/).first()).toBeVisible();
  216 | 
  217 |     // Check at least one card has rounded-2xl (sidebar tip card or wrapper) — via class
  218 |     const warmCard = page.locator(".rounded-2xl").first();
  219 |     await expect(warmCard).toBeVisible();
  220 | 
  221 |     // Bahasa sederhana: check no English "Dashboard" remains? Actually label is Dashboard but subtitle Indonesian
  222 |     // Ensure header-title Indonesian
  223 |     await expect(page.getByTestId("header-title").first()).toContainText("Toko Primitif");
  224 |   });
  225 | });
```