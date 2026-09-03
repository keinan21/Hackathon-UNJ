# FRD-05 Feature F5: Dashboard, Badge, dan Histori

> Supervisor buka satu halaman dan langsung paham: mana yang kritis, promo apa yang aktif, dan saran kemarin apa, dengan 3 tab utama dan sub-tab Statistik.

- **FRD ID:** FRD-05
- **Feature:** F5 Dashboard, Badge, dan Histori
- **Versi:** 1.1 (2026-09-03: tambah 3 tab plus sub-tab Statistik, grafik mini SVG, halaman kritis)
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu acuan:** Asia/Jakarta (WIB)
- **Trace TASK:** TASK-11, TASK-17, TASK-19
- **File sumber:** `docs/frd.md` FRD-05 section verbatim
- **Detail index:** [docs/frd.md](../frd.md)

---

## Glosarium Relevan (verbatim dari CONTEXT.md)

| Term | Definisi | Catatan |
|------|----------|---------|
| **Promo Aktif** | Tebus Murah yang sudah di-approve supervisor (status `active`), tampil di dashboard dan badge SKU. Belum approve = `proposed`. | Transisi: proposed ke active ke expired atau consumed |
| **Threshold** | Config per Kategori: `H-7, H-3, H-1` default, editable. Trigger notifikasi push dan badge. Kritis = days <= max threshold. | Threshold di setting bawah |
| **Notifikasi** | Push PWA dan badge dashboard di H-threshold plus Telegram rekap 07:00. Eskalasi tidak ada v1. | Di-schedule via Service Worker dan daily batch 07:00 |
| **UrgencyScore** | `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil atau negatif semakin urgent. Ranking untuk antrian AI. | Rule deterministik, bukan LLM |
| **Omzet** | `Σ harga_jual_snapshot * qty keluar` 14 hari. | Untuk Statistik |
| **Cashflow** | `omzet - belanja 14d` | Untuk Statistik |
| **Grafik Mini** | SVG inline 14 titik arus masuk-keluar harian, tanpa dep chart, marker BEP hijau #16a34a. | BEP = kumulatif margin >= 0 |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-001](../adr/0001-local-first-dexie-backup-drive.md), [ADR-003](../adr/0003-telegram-notif.md).

---

## Vision

Supervisor buka satu halaman dan langsung paham: mana yang kritis, promo apa yang aktif, dan saran kemarin apa. Navigasi 3 tab di bawah bikin ia tidak tersesat, Statistik kasih angka omzet dan margin 14 hari dengan grafik mini yang ringan, dan halaman khusus kritis tunjukkan semua stok mepet yang perlu tindakan hari ini. Tidak perlu buka banyak menu, badge dan warna pandu mata, histori jadi bukti keputusan.

---

## Persona

**Supervisor yang buka HP sambil berdiri di gudang, satu tangan pegang HP.** Dia tap tab Dashboard lihat yang kritis di atas, tap tab SKU untuk cari barang, tap tab Setting untuk backup. Di Dashboard ia scroll ke Statistik untuk lihat rank dan omzet. Dia mau list kritis paling atas, warna merah langsung kelihatan, promo aktif di kartu terpisah, histori saran bisa di-scroll jika mau audit, dan grafik mini 14 hari dengan titik hijau BEP yang jelas. Semua tulisan Indonesia, tombol besar, tidak perlu zoom, max 3 tap dari buka sampai approve promo.

---

## Requirements

- Navigasi utama 3 tab di bawah (BottomNav): **Dashboard | SKU | Setting**, ikon plus label Indonesia, tinggi 48px, aktif state jelas. Dashboard sebagai default. Deep-link `/sku/:id` dari halaman kritis tetap bisa kembali ke Dashboard.
- Sub-tab: **Statistik** di dalam Dashboard (tab kedua setelah Ringkasan), dan **In-Out** di dalam detail SKU (Masuk dan Keluar). Tidak ada tab tambahan.
- Dashboard Ringkasan punya 3 seksi: Urgent Kritis (hanya batch kritis `days <= max threshold` kategori, sorted urgency), Promo Aktif cards (dari FRD-04 status active), Histori AdvisorCache (5 terbaru dengan timestamp).
- Halaman khusus Kritis: list per-batch kritis (nama SKU, kode SKU, sisa qty, H-minus, urgency, warna badge), filter per Kategori, tap baris langsung ke detail SKU `/sku/:id`. Jika tidak ada kritis tampil "Stok aman, tidak ada yang mepet expiry" dengan tombol ke SKU.
- Urgent Kritis di Dashboard: hanya tampilkan yang kritis, bukan semua batch dengan expiry. Tiap baris tampil nama SKU, kode, qty Batch, days_to_expiry, urgencyScore, warna H (merah H terkecil kategori, oranye tengah, kuning terbesar), badge per SKU jumlah qty kritis. Tap untuk ke halaman kritis atau detail SKU.
- Promo Aktif card: tampil `Tebus Murah` label, nama Batch dan expiry, pasangan SKU, `harga_tebus`, status active, tombol lihat detail.
- Histori: list `AdvisorSuggestion` dari cache dengan `created_at`, ringkas aksi dan alasan, bisa tap untuk lihat detail.
- Statistik 14 hari (sub-tab Dashboard): rank masuk dan keluar qty, kecepatan per SKU dan per Kategori (avgUsage), histori keluar masuk harian, omzet plus margin plus cashflow 14 hari dari `src/engine/omzet.ts` (angka dari DB, bukan LLM). Empty jika tanpa transaksi tampil pesan Indonesia.
- Grafik mini arus 14 hari: SVG inline tanpa dependensi chart baru, 14 titik harian (sumbu x tanggal, sumbu y qty atau kumulatif margin), garis arus masuk dan keluar, marker lingkaran hijau #16a34a pada titik pertama kumulatif margin lebih sama dengan 0 sebagai sinyal BEP (BEP = `Σ margin harian >= 0`, margin dari `omzet.ts`: `harga_jual - HPP`). Jika tanpa transaksi, grafik tampil empty state Indonesia. Grafik ada di detail SKU dan di Statistik.
- Badge SKU: muncul di list SKU dan di dashboard, hitung dari Batch kritis saja (`days <= max threshold`), update real-time dari Dexie via Repository. Batch `expiry null` tidak berbadge.
- Desain token: font minimal 16px, tombol minimal 48px tinggi, kontras AA, bahasa Indonesia untuk semua label dan empty state ("Belum ada promo" jika kosong, "Belum ada SKU" di katalog).
- Responsive PWA: satu kolom di HP, dua kolom di tablet opsional, tidak perlu desktop kompleks v1.
- Data dari Dexie, bukan dari API. Loading state jelas, error state tidak crash.
- Empty states: jika tidak ada kritis tampil "Stok aman". Jika tidak ada promo tampil "Belum ada promo aktif". Jika tidak ada histori tampil "Belum ada saran".
- Validasi 3-tap: dari buka app ke approve promo tidak lebih dari 3 tap (Dashboard ke Kritis ke Detail SKU ke Approve, atau Dashboard Promo ke Approve). Navigasi 3 tab jaga jarak tap tetap pendek.

---

## Acceptance Gherkin

```gherkin
Feature: Dashboard Badge Histori

  Scenario: Navigasi 3 tab
    Given supervisor buka app
    Then BottomNav tampil 3 tab Dashboard, SKU, Setting dengan label Indonesia
    When tap SKU
    Then pindah ke katalog SKU
    When tap Setting
    Then pindah ke Setting
    When tap Dashboard
    Then kembali ke Dashboard

  Scenario: Sub-tab Statistik di Dashboard
    Given supervisor di Dashboard
    When tap Statistik
    Then tampil rank, kecepatan, histori, omzet margin cashflow 14 hari
    And grafik mini 14 titik render

  Scenario: Dashboard tampil 3 seksi hanya kritis
    Given ada 2 Batch kritis H-1 dan H-3 dan 1 Batch H-10 tidak kritis dan 1 promo active dan 3 histori cache
    When supervisor buka Dashboard
    Then terlihat seksi Urgent Kritis dengan 2 baris saja, Promo Aktif, dan Histori Saran
    And Batch H-10 tidak tampil di urgent

  Scenario: Halaman khusus kritis
    Given ada 3 Batch kritis dari kategori berbeda
    When supervisor buka halaman kritis
    Then tampil list per-batch kritis dengan nama, sisa, H-, urgensi
    When tap satu baris
    Then pindah ke /sku/:id detail SKU tersebut
    Given tidak ada kritis
    When buka halaman kritis
    Then tampil "Stok aman, tidak ada yang mepet expiry"

  Scenario: Urgent list warna dan urutan hanya kritis
    Given Batch H-1 qty 10 kritis dan Batch H-3 qty 20 kritis dan Batch H-10 qty 5 tidak kritis
    When Dashboard render
    Then tampil 2 kritis saja H-1 merah di atas H-3 oranye
    And Batch H-10 tidak tampil

  Scenario: Badge count per SKU hanya kritis
    Given SKU Susu punya 2 Batch kritis total qty 15 dan 1 Batch tidak kritis qty 100
    When badge dihitung
    Then badge angka 15 di SKU Susu

  Scenario: Batch tanpa expiry tidak berbadge
    Given Batch expiry null
    When Dashboard hitung badge
    Then tidak ada badge untuk batch itu

  Scenario: Grafik mini 14 titik plus BEP hijau
    Given SKU punya transaksi 14 hari dengan margin kumulatif capai 0 di hari ke 5
    When detail SKU render grafik mini
    Then SVG tampil 14 titik
    And marker lingkaran hijau #16a34a ada di titik hari ke 5
    Given tanpa transaksi
    Then grafik tampil empty Indonesia

  Scenario: Promo Aktif card isi
    Given promo active Batch Susu H-2 pasangan Roti harga_tebus 9000
    When Dashboard tampilkan Promo Aktif
    Then card berisi "Tebus Murah" dan "9000" dan nama pasangan Roti

  Scenario: Histori 5 terbaru
    Given advisorCache punya 10 entri
    When Dashboard buka histori
    Then tampil 5 terbaru urut created_at desc

  Scenario: Empty state
    Given tidak ada promo active
    When Dashboard Promo Aktif dirender
    Then tampil pesan "Belum ada promo aktif"

  Scenario: Statistik omzet angka dari DB
    Given transaksis keluar 5 pcs harga_jual 15000 HPP 12000 selama 14 hari
    When Statistik render
    Then omzet tampil Rp 75000 dan margin tampil Rp 15000 dan cashflow = omzet - belanja

  Scenario: Aksesibilitas tombol dan font
    When Dashboard dirender
    Then semua button punya min-height 48px
    And font body minimal 16px

  Scenario: Filter kategori di kritis
    Given ada kritis Dairy dan Snack
    When supervisor pilih filter Dairy di halaman kritis
    Then hanya kritis Dairy yang tampil

  Scenario: 3-tap ke approve
    Given ada promo proposed
    When supervisor buka Dashboard tap Promo tap Setujui
    Then tidak lebih dari 3 tap sampai approve
```

---

## Trace ke TASK

Trace: TASK-11, TASK-17, TASK-19

- TASK-11 — Badge dan halaman kritis plus urgent dashboard list hanya kritis.
- TASK-17 — Dashboard Promo Aktif dan histori saran UI lengkap, 3 tab wiring.
- TASK-19 — Statistik 14 hari plus grafik mini SVG, omzet via `omzet.ts`, threshold settings page terkait visual dashboard.

---

## KPI

- Supervisor capai informasi kritis dalam kurang dari 5 detik setelah buka dashboard.
- 100 persen promo active tampil di dashboard tanpa delay lebih dari 1 detik dari Dexie.
- Badge count akurat 100 persen terhadap qty batch kritis di test.
- Grafik mini render 14 titik 100 persen benar, marker BEP hijau #16a34a di posisi yang tepat.
- Empty state tampil 100 persen saat tidak ada data, tidak ada halaman kosong tanpa pesan.
- Navigasi 3 tab plus sub-tab tidak lebih dari 3 tap ke approve promo.

---

## Must NOT Have

- Tidak ada chart kompleks atau analytics berat di v1, hanya grafik mini SVG inline 14 titik.
- Tidak ada export dashboard ke PDF v1.
- Tidak ada notifikasi dari dashboard, notifikasi dari engine FRD-03.
- Tidak ada multi-gudang view v1.
- Tidak ada dashboard tampilkan semua batch, hanya yang kritis (`days <= max threshold`).
- Tidak ada dependensi chart baru (chart.js, recharts), hanya SVG inline.

---

## References

- [CONTEXT.md](../../CONTEXT.md:18-21) — Promo Aktif, Threshold, Notifikasi, Omzet, Cashflow, Grafik Mini, badge dashboard.
- Draft C6 Dashboard dan Badge [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).
- [ADR-001](../adr/0001-local-first-dexie-backup-drive.md) — Data dari Dexie lokal, Repository pattern.
- [ADR-003](../adr/0003-telegram-notif.md) — Telegram rekap untuk referensi cashflow yang sama.

---

---

## Polish Wave 5 — Biar Jadi (Real Data, Anti-Dummy)

**Gap sekarang:** Dashboard 3 seksi sudah ada tapi masih baca `FakeRepository` dummy, belum ada 3 tab dan grafik mini.

| Crew | Sisa kerja di FRD-05 | File | Done jika |
|------|----------------------|------|-----------|
| **A Frontend** | Colok Dashboard 3 seksi ke Dexie real: `UrgentList` real hanya kritis plus `PromoAktifList` real plus `HistoriList` 5 terbaru, BottomNav 3 tab Dashboard/SKU/Setting plus sub-tab Statistik (rank, kecepatan, histori, omzet/margin), grafik mini SVG 14 titik plus BEP #16a34a, halaman kritis `/kritis` | `src/features/dashboard/DashboardPage.tsx`, `src/features/dashboard/Histori*.tsx`, `src/components/BottomNav.tsx`, `src/App.tsx` | `npx playwright test e2e/dashboard.spec.ts` 3 tab tampil, 3 seksi plus Statistik plus grafik 14 titik, `npx playwright test e2e/kritis.spec.ts` tap ke detail |
| **B Core** | Badge per SKU sum qty kritis real, filter kategori | `src/components/Badge.tsx` | Badge count = sum qty kritis |

Branch: `feat/polish-dashboard-a`.

*FRD-05 self-contained. Verifikasi: `grep -q "FRD-05" docs/frd/frd-05-dashboard.md && grep -q "TASK-" docs/frd/frd-05-dashboard.md && grep -q "Wave 5 Polish" docs/frd/frd-05-dashboard.md && grep -q "3 tab" docs/frd/frd-05-dashboard.md`*
