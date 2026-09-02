# FRD-01 Feature F1: PWA Shell Offline

> PWA inventaris perishable offline untuk UMKM toko tunggal. FRD ini self-contained, bisa dikerjakan tanpa buka FRD lain.

- **FRD ID:** FRD-01
- **Feature:** F1 PWA Shell Offline
- **Versi:** 1.0
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu acuan:** Asia/Jakarta (WIB)
- **Target pengguna:** Supervisor, satu HP, satu toko, non-tech
- **Trace TASK:** TASK-01, TASK-04
- **File sumber:** `docs/frd.md` FRD-01 section verbatim
- **Detail index:** [docs/frd.md](../frd.md)

---

## Glosarium Relevan (verbatim dari CONTEXT.md)

| Term | Definisi | Catatan |
|------|----------|---------|
| **Supervisor** | Satu-satunya user v1, pegang 1 HP device. Punya PIN. Bisa approve promo, edit threshold, backup. | Tidak ada multi-role v1 |
| **Notifikasi** | Push PWA dan badge dashboard di H-threshold. WA opsional, tidak wajib v1. Eskalasi tidak ada v1. | Di-schedule via Service Worker dan daily batch 07:00 |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-001](../adr/0001-local-first-dexie-backup-drive.md), [ADR-002](../adr/0002-langchain-gemini-hybrid-advisor.md).

---

## Prinsip Umum (ringkas, detail di docs/frd.md index)

1. Single device, single supervisor. Satu HP, akses pakai PIN.
2. Offline-first, local-first. Data di IndexedDB via Dexie.
3. Repository pattern. Akses via `InventoryRepository`.
4. Hybrid advisor. Rule angka, LLM hanya pairing wording.
5. 3-tap max. Tombol 48px, font 16px, bahasa Indonesia.
6. Expiry milik Batch, bukan SKU.
7. Guardrail `harga_tebus >= HPP * 0.85`.
8. Tidak ada backend wajib.

---

## Vision

Supervisor bisa buka aplikasi inventaris di HP seperti aplikasi native, tetap jalan saat tidak ada internet, data tidak hilang saat tutup browser, dan bisa di-install dari browser tanpa Play Store. Semua ini jalan di satu HP offline 100 persen untuk operasional harian.

---

## Persona

**Supervisor UMKM, non-tech, 35-55 tahun.** Pegang satu HP Android, kuota terbatas, sering di gudang sinyal lemah. Tidak paham istilah teknis. Butuh buka tutup cepat, tombol besar, bahasa Indonesia, dan tidak mau login ribet. Harapan: tap ikon di home screen, langsung lihat stok.

---

## Requirements

- Aplikasi harus installable sebagai PWA: punya `manifest.webmanifest` dengan `name`, `short_name`, `icons` 192 dan 512, `display: standalone`, `themeColor`, dan `backgroundColor`.
- Service Worker harus cache app shell (HTML, CSS, JS, ikon) dengan Workbox via `vite-plugin-pwa`, strategi CacheFirst untuk shell dan NetworkFirst untuk data dinamis jika ada.
- Harus ada halaman fallback offline yang ramah: pesan bahasa Indonesia singkat, tombol muat ulang, tetap tampilkan shell walau data belum ada.
- Harus ada prompt install yang sopan, tidak memblokir, bisa di-dismiss, muncul lagi setelah 7 hari jika di-dismiss.
- Build harus hasilkan `dist/manifest.webmanifest` dan `dist/sw.js`, tidak ada backend atau server khusus.
- Harus jalan di Chrome Android terbaru dan Edge desktop, tidak perlu iOS optimasi khusus v1.
- Semua data operasional tetap di Dexie (IndexedDB), Service Worker tidak cache data transaksi mentah.
- Izin notifikasi diminta setelah PWA terpasang, tidak saat pertama buka agar tidak mengganggu.

---

## Acceptance Gherkin

```gherkin
Feature: PWA Shell Offline

  Scenario: Install PWA dari browser
    Given supervisor buka alamat PWA di Chrome Android
    And manifest.webmanifest tersedia dengan ikon 192 dan 512
    When browser tawarkan "Install" dan supervisor tap Install
    Then ikon muncul di home screen
    And tap ikon buka aplikasi mode standalone tanpa address bar

  Scenario: Buka aplikasi saat offline
    Given PWA sudah ter-install dan pernah dibuka online sekali
    And Service Worker sudah cache app shell
    When HP matikan data dan supervisor buka PWA dari home screen
    Then shell tetap tampil dalam waktu kurang dari 2 detik
    And data stok tampil dari Dexie tanpa error jaringan

  Scenario: Build hasilkan artefak PWA
    Given repo di-build dengan bun run build
    When build selesai
    Then file dist/manifest.webmanifest ada
    And file dist/sw.js ada
    And manifest berisi name dan icons

  Scenario: Fallback offline saat belum ada cache data
    Given PWA baru install dan Dexie masih kosong
    When supervisor buka saat offline
    Then tampil pesan "Kamu offline, data tersimpan lokal akan tampil saat ada" dan tombol Muat Ulang
    And tidak ada crash halaman putih

  Scenario: Dismiss prompt install tidak memaksa
    Given prompt install muncul
    When supervisor tap Tutup
    Then prompt hilang
    And tidak muncul lagi di sesi yang sama
```

---

## Trace ke TASK

Trace: TASK-01, TASK-04

- TASK-01 — Init Vite React TS scaffold, PWA tooling, struktur `src/db`, `src/engine`, `src/advisor`, `src/features`, `public/icons`, config `vite.config.ts` PWA minimal.
- TASK-04 — PWA shell, manifest, Service Worker offline cache, fallback page, install prompt hook.

Ketergantungan: FRD-01 blokir semua feature lain. Tanpa shell offline, tidak ada feature yang bisa diuji offline.

---

## KPI

- Installability 100 persen di Chrome Android: `manifest` valid dan `sw.js` ada setelah build.
- Time to shell kurang dari 2 detik saat offline (cache shell hit).
- 0 crash halaman putih saat offline, fallback tampil 100 persen.
- Build sukses `bun run build` exit 0 di CI lokal.

---

## Must NOT Have

- Tidak ada backend atau API route untuk PWA shell.
- Tidak ada push server eksternal di FRD ini, hanya Service Worker lokal.
- Tidak ada sync multi-HP, tidak ada Supabase atau Firebase.
- Tidak ada splash screen native kustom di luar manifest.

---

## References

- [CONTEXT.md](../../CONTEXT.md) — Supervisor single device, Notifikasi push PWA.
- [ADR-001 local-first Dexie](../adr/0001-local-first-dexie-backup-drive.md) — Vite React Dexie pure local, zero cloud, vite-plugin-pwa matang, Repository pattern untuk reversibilitas.
- Draft [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md) — C1 PWA Offline Shell.

---

---

## Polish Wave 5 — Biar Jadi (Real Data, Anti-Dummy)

> Bagian ini untuk teman yang tidak pakai `.omo` — baca ini saja, bukan `.omo/plans`.

**Gap sekarang:** shell sudah ada tapi `src/App.tsx` masih `seedMode=many` dummy + `OfflineFallback` belum colok Dexie real.

| Crew | Sisa kerja di FRD-01 | File | Done jika |
|------|----------------------|------|-----------|
| **A Frontend** | Hilangkan `seedMode`, `?offline=1` tetap render shell dari cache real, tombol 48px | `src/App.tsx`, `src/components/OfflineFallback.tsx` | `npx playwright test e2e/pwa.spec.ts` 5 pass offline |
| **D Platform** | `vite.config.ts` PWA `manifest.webmanifest` + `sw.js` must ada di `dist/` | `vite.config.ts`, `public/icons/**` | `bun run build && test -f dist/sw.js` PASS |

Branch: `feat/polish-pwa-a` & `feat/polish-pwa-d` (1 FRD = 1 file polish, no tabrakan).

*FRD-01 self-contained. Verifikasi: `grep -q "FRD-01" docs/frd/frd-01-pwa.md && grep -q "TASK-" docs/frd/frd-01-pwa.md && grep -q "Wave 5 Polish" docs/frd/frd-01-pwa.md`*
