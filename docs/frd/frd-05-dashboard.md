# FRD-05 Feature F5: Dashboard, Badge, dan Histori

> Supervisor buka satu halaman dan langsung paham: mana yang urgent, promo apa yang aktif, dan saran kemarin apa.

- **FRD ID:** FRD-05
- **Feature:** F5 Dashboard, Badge, dan Histori
- **Versi:** 1.0
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
| **Threshold** | Config per Kategori: `H-7, H-3, H-1` default, editable. Trigger notifikasi push dan badge. |  |
| **Notifikasi** | Push PWA dan badge dashboard di H-threshold. WA opsional, tidak wajib v1. Eskalasi tidak ada v1. | Di-schedule via Service Worker dan daily batch 07:00 |
| **UrgencyScore** | `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil atau negatif semakin urgent. Ranking untuk antrian AI. | Rule deterministik, bukan LLM |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-001](../adr/0001-local-first-dexie-backup-drive.md).

---

## Vision

Supervisor buka satu halaman dan langsung paham: mana yang urgent, promo apa yang aktif, dan saran kemarin apa. Tidak perlu buka banyak menu, badge dan warna pandu mata, histori jadi bukti keputusan.

---

## Persona

**Supervisor yang buka HP sambil berdiri di gudang, satu tangan pegang HP.** Dia mau list urgent paling atas, warna merah langsung kelihatan, promo aktif di kartu terpisah, histori saran bisa di-scroll jika mau audit. Semua tulisan Indonesia, tombol besar, tidak perlu zoom.

---

## Requirements

- Dashboard punya 3 seksi: Urgent List (dari FRD-03 sorted urgency), Promo Aktif cards (dari FRD-04 status active), Histori AdvisorCache (5 terbaru dengan timestamp).
- Urgent List: filter per Kategori, tiap baris tampil nama SKU, qty Batch, days_to_expiry, urgencyScore, warna H (merah H kurang sama 1, oranye H kurang sama 3, kuning H kurang sama 7), badge per SKU jumlah qty urgent.
- Promo Aktif card: tampil `Tebus Murah` label, nama Batch dan expiry, pasangan SKU, `harga_tebus`, status active, tombol lihat detail.
- Histori: list `AdvisorSuggestion` dari cache dengan `created_at`, ringkas aksi dan alasan, bisa tap untuk lihat detail.
- Badge SKU: muncul di list SKU dan di dashboard, hitung dari Batch urgent yang threshold terlewati, update real-time dari Dexie via Repository.
- Desain token: font minimal 16px, tombol minimal 48px tinggi, kontras AA, bahasa Indonesia untuk semua label dan empty state ("Belum ada promo" jika kosong).
- Responsive PWA: satu kolom di HP, dua kolom di tablet opsional, tidak perlu desktop kompleks v1.
- Data dari Dexie, bukan dari API. Loading state jelas, error state tidak crash.
- Empty states: jika tidak ada urgent tampil "Stok aman, tidak ada yang mepet expiry". Jika tidak ada promo tampil "Belum ada promo aktif".

---

## Acceptance Gherkin

```gherkin
Feature: Dashboard Badge Histori

  Scenario: Dashboard tampil 3 seksi
    Given ada 2 Batch urgent H-1 dan H-3 dan 1 promo active dan 3 histori cache
    When supervisor buka Dashboard
    Then terlihat seksi Urgent List, Promo Aktif, dan Histori Saran

  Scenario: Urgent list warna dan urutan
    Given Batch H-1 qty 10 dan Batch H-3 qty 20 dan Batch H-10 qty 5
    When Dashboard render
    Then tampil 2 urgent saja H-1 merah di atas H-3 oranye
    And Batch H-10 tidak tampil

  Scenario: Badge count per SKU
    Given SKU Susu punya 2 Batch urgent total qty 15
    When badge dihitung
    Then badge angka 15 di SKU Susu

  Scenario: Batch tanpa expiry tidak berbadge
    Given Batch expiry null
    When Dashboard hitung badge
    Then tidak ada badge untuk batch itu

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

  Scenario: Aksesibilitas tombol dan font
    When Dashboard dirender
    Then semua button punya min-height 48px
    And font body minimal 16px

  Scenario: Filter kategori
    Given ada urgent Dairy dan Snack
    When supervisor pilih filter Dairy
    Then hanya urgent Dairy yang tampil
```

---

## Trace ke TASK

Trace: TASK-11, TASK-17, TASK-19

- TASK-11 — Badge dan urgent dashboard list awal.
- TASK-17 — Dashboard Promo Aktif dan histori saran UI lengkap.
- TASK-19 — Threshold settings page yang tampilkan konteks badge dan HPP floor di settings, terkait visual dashboard.

---

## KPI

- Supervisor capai informasi urgent dalam kurang dari 5 detik setelah buka dashboard.
- 100 persen promo active tampil di dashboard tanpa delay lebih dari 1 detik dari Dexie.
- Badge count akurat 100 persen terhadap qty batch urgent di test.
- Empty state tampil 100 persen saat tidak ada data, tidak ada halaman kosong tanpa pesan.

---

## Must NOT Have

- Tidak ada chart kompleks atau analytics berat di v1.
- Tidak ada export dashboard ke PDF v1.
- Tidak ada notifikasi dari dashboard, notifikasi dari engine FRD-03.
- Tidak ada multi-gudang view v1.

---

## References

- [CONTEXT.md](../../CONTEXT.md:18-21) — Promo Aktif, Threshold, Notifikasi, badge dashboard.
- Draft C6 Dashboard dan Badge [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).
- [ADR-001](../adr/0001-local-first-dexie-backup-drive.md) — Data dari Dexie lokal, Repository pattern.

---

---

## Polish Wave 5 — Biar Jadi (Real Data, Anti-Dummy)

**Gap sekarang:** Dashboard 3 seksi sudah ada tapi masih baca `FakeRepository` dummy.

| Crew | Sisa kerja di FRD-05 | File | Done jika |
|------|----------------------|------|-----------|
| **A Frontend** | Colok Dashboard 3 seksi ke Dexie real: `UrgentList` real + `PromoAktifList` real + `HistoriList` 5 terbaru, empty `Belum ada promo`, font 16px tombol 48px | `src/features/dashboard/DashboardPage.tsx`, `src/features/dashboard/Histori*.tsx` | `npx playwright test e2e/dashboard.spec.ts` 3 seksi + histori detail `/histori/:id` |
| **B Core** | Badge per SKU sum qty urgent real, filter kategori multi-select | `src/components/Badge.tsx` | Badge count = sum qty urgent |

Branch: `feat/polish-dashboard-a`.

*FRD-05 self-contained. Verifikasi: `grep -q "FRD-05" docs/frd/frd-05-dashboard.md && grep -q "TASK-" docs/frd/frd-05-dashboard.md && grep -q "Wave 5 Polish" docs/frd/frd-05-dashboard.md`*
