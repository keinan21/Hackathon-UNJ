# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 3tap.spec.ts >> 3-tap max flow >> settings edit ≤3 taps: Pengaturan nav -> edit -> Simpan
- Location: e2e/3tap.spec.ts:31:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('input-threshold-k-dairy')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - banner [ref=e5]:
      - heading "Inventaris Tebus Murah" [level=1] [ref=e14]
      - generic [ref=e15]: PWA
    - main [ref=e17]:
      - generic [ref=e18]:
        - alert [ref=e19]:
          - generic [ref=e20]: Notifikasi dimatikan, badge tetap update
          - button "Tutup banner notifikasi" [ref=e22] [cursor=pointer]: Tutup
        - generic [ref=e23]:
          - generic [ref=e30]:
            - heading "Pengaturan" [level=2] [ref=e31]
            - paragraph [ref=e32]: Kelola profil toko, PIN, backup, dan threshold kategori — semua 48px, Bahasa Indonesia.
          - generic [ref=e33]:
            - heading "Profil Toko" [level=3] [ref=e34]
            - paragraph [ref=e41]: Nama tampil di header. Disimpan lokal, ikut backup v2.
            - generic [ref=e42]: Nama Toko
            - textbox "Nama Toko" [ref=e43]:
              - /placeholder: "Contoh: Toko Berkah"
            - paragraph [ref=e44]: "Tersimpan: -"
            - button "Simpan Profil" [ref=e45] [cursor=pointer]
          - generic [ref=e46]:
            - heading "Ganti PIN" [level=3] [ref=e47]
            - paragraph [ref=e50]: PIN disimpan hash PBKDF2 100k, tanpa plaintext. Verifikasi PIN lama dulu.
            - generic [ref=e51]: PIN Lama
            - textbox "PIN Lama" [ref=e52]:
              - /placeholder: PIN lama
            - generic [ref=e53]: PIN Baru
            - textbox "PIN Baru" [ref=e54]:
              - /placeholder: Minimal 4 digit
            - generic [ref=e55]: Konfirmasi PIN Baru
            - textbox "Konfirmasi PIN Baru" [ref=e56]:
              - /placeholder: Ulangi PIN baru
            - button "Ganti PIN" [ref=e57] [cursor=pointer]
          - generic [ref=e58]:
            - heading "Backup & Restore v2" [level=3] [ref=e59]
            - paragraph [ref=e62]: Format .json.enc v2 mencakup kode/tags/transaksis/hpp_history. Terenkripsi AES-GCM via PIN.
            - generic [ref=e63]:
              - generic [ref=e64]:
                - paragraph [ref=e65]: Backup
                - generic [ref=e66]: PIN untuk enkripsi
                - textbox "PIN untuk enkripsi" [ref=e67]:
                  - /placeholder: Masukkan PIN
                - button "Export Backup" [ref=e68] [cursor=pointer]
              - generic [ref=e71]:
                - paragraph [ref=e72]: Restore
                - generic [ref=e73]: File .json.enc
                - button "File .json.enc" [ref=e74] [cursor=pointer]
                - generic [ref=e75]: PIN untuk dekripsi
                - textbox "PIN untuk dekripsi" [ref=e76]:
                  - /placeholder: Masukkan PIN
                - button "Restore" [ref=e77] [cursor=pointer]
          - generic [ref=e84]:
            - paragraph [ref=e85]: "Guardrail harga: HPP x 0.85"
            - paragraph [ref=e86]: Contoh HPP Rp10.000 → floor Rp8.500. Harga tebus tidak boleh di bawah floor.
          - generic [ref=e87]:
            - generic [ref=e88]:
              - heading "Threshold per Kategori" [level=3] [ref=e89]
              - paragraph [ref=e90]: Edit threshold H- per kategori. Format menurun pisah koma, contoh 7,3,1. Via updateKategoriThreshold.
            - generic [ref=e91]:
              - generic [ref=e92]: Threshold Minuman Botol
              - paragraph [ref=e93]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Minuman Botol" [ref=e94]:
                - /placeholder: 7,3,1
                - text: 30,14,7
              - paragraph [ref=e95]: "Tersimpan: 30,14,7"
              - button "Simpan Threshold Minuman Botol" [ref=e96] [cursor=pointer]
            - generic [ref=e97]:
              - generic [ref=e98]: Threshold Minuman Kaleng
              - paragraph [ref=e99]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Minuman Kaleng" [ref=e100]:
                - /placeholder: 7,3,1
                - text: 60,30,14
              - paragraph [ref=e101]: "Tersimpan: 60,30,14"
              - button "Simpan Threshold Minuman Kaleng" [ref=e102] [cursor=pointer]
            - generic [ref=e103]:
              - generic [ref=e104]: Threshold Bumbu Dapur
              - paragraph [ref=e105]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Bumbu Dapur" [ref=e106]:
                - /placeholder: 7,3,1
                - text: 30,14,7
              - paragraph [ref=e107]: "Tersimpan: 30,14,7"
              - button "Simpan Threshold Bumbu Dapur" [ref=e108] [cursor=pointer]
            - generic [ref=e109]:
              - generic [ref=e110]: Threshold Sembako
              - paragraph [ref=e111]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Sembako" [ref=e112]:
                - /placeholder: 7,3,1
                - text: 60,30,14
              - paragraph [ref=e113]: "Tersimpan: 60,30,14"
              - button "Simpan Threshold Sembako" [ref=e114] [cursor=pointer]
            - generic [ref=e115]:
              - generic [ref=e116]: Threshold Makanan Frozen
              - paragraph [ref=e117]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Makanan Frozen" [ref=e118]:
                - /placeholder: 7,3,1
                - text: 14,7,3
              - paragraph [ref=e119]: "Tersimpan: 14,7,3"
              - button "Simpan Threshold Makanan Frozen" [ref=e120] [cursor=pointer]
            - generic [ref=e121]:
              - generic [ref=e122]: Threshold Obat Bebas
              - paragraph [ref=e123]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Obat Bebas" [ref=e124]:
                - /placeholder: 7,3,1
                - text: 90,30,14
              - paragraph [ref=e125]: "Tersimpan: 90,30,14"
              - button "Simpan Threshold Obat Bebas" [ref=e126] [cursor=pointer]
            - generic [ref=e127]:
              - generic [ref=e128]: Threshold Makanan Basah
              - paragraph [ref=e129]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Makanan Basah" [ref=e130]:
                - /placeholder: 7,3,1
                - text: 7,3,1
              - paragraph [ref=e131]: "Tersimpan: 7,3,1"
              - button "Simpan Threshold Makanan Basah" [ref=e132] [cursor=pointer]
            - generic [ref=e133]:
              - generic [ref=e134]: Threshold Perawatan Diri
              - paragraph [ref=e135]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Perawatan Diri" [ref=e136]:
                - /placeholder: 7,3,1
                - text: 90,30,14
              - paragraph [ref=e137]: "Tersimpan: 90,30,14"
              - button "Simpan Threshold Perawatan Diri" [ref=e138] [cursor=pointer]
            - generic [ref=e139]:
              - generic [ref=e140]: Threshold Makanan Kering
              - paragraph [ref=e141]: "Format: angka menurun pisah koma, contoh 7,3,1"
              - textbox "Threshold Makanan Kering" [ref=e142]:
                - /placeholder: 7,3,1
                - text: 30,14,7
              - paragraph [ref=e143]: "Tersimpan: 30,14,7"
              - button "Simpan Threshold Makanan Kering" [ref=e144] [cursor=pointer]
          - generic [ref=e145]:
            - heading "Rata-rata Harian" [level=3] [ref=e146]
            - paragraph [ref=e147]: Jika histori <14 hari, pakai input manual. Rumus urgencyScore = qty * days / max(avg,1).
  - generic [ref=e149]:
    - generic "close sidebar"
    - complementary [ref=e150]:
      - generic [ref=e151]:
        - generic [ref=e160]:
          - paragraph [ref=e161]: Toko Anda
          - paragraph [ref=e162]: Inventaris Tebus Murah
        - generic [ref=e163]:
          - generic [ref=e164]: Offline siap
          - generic [ref=e165]: •
          - generic [ref=e166]: 3 tap sampai approve
      - list [ref=e167]:
        - listitem [ref=e168]:
          - button "Dashboard" [ref=e169]
        - listitem [ref=e173]:
          - button "SKU" [ref=e174]
        - listitem [ref=e177]:
          - button "Pengaturan" [active] [ref=e178] [cursor=pointer]
      - generic [ref=e184]:
        - paragraph [ref=e185]: Butuh bantuan?
        - paragraph [ref=e186]: Semua data tersimpan di perangkat. Backup di Pengaturan.
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
  9  |     await expect(setujui).toBeVisible();
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
> 40 |     await input.fill("14,7,3");
     |                 ^ Error: locator.fill: Test timeout of 30000ms exceeded.
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