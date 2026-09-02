# FRD-03 Feature F3: Expiry Engine dan Notifikasi

> Sistem hitung sendiri mana stok yang paling mepet kadaluarsa, urutkan paling urgent di atas, dan ingatkan supervisor tepat di H-7, H-3, H-1.

- **FRD ID:** FRD-03
- **Feature:** F3 Expiry Engine dan Notifikasi
- **Versi:** 1.0
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu acuan:** Asia/Jakarta (WIB)
- **Trace TASK:** TASK-08, TASK-09, TASK-10, TASK-11
- **File sumber:** `docs/frd.md` FRD-03 section verbatim
- **Detail index:** [docs/frd.md](../frd.md)

---

## Glosarium Relevan (verbatim dari CONTEXT.md)

| Term | Definisi | Catatan |
|------|----------|---------|
| **Expiry** | `expiry_date` per Batch. Barang non-perishable tetap punya Batch tapi `expiry_date = null` dan tidak masuk engine notifikasi. | v1 pakai satu field saja, tidak bedakan best-before vs hard expiry |
| **Days to Expiry** | `ceil((expiry_date - today) / 1day)`. Negatif berarti sudah kadaluarsa. | Dihitung harian oleh engine, basis Asia/Jakarta startOfDay |
| **Avg Daily Usage** | Rata-rata qty terjual per hari per SKU, auto-hitung dari histori transaksi (fallback input manual jika histori kurang dari 14 hari). | Untuk urgencyScore |
| **UrgencyScore** | `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil atau negatif semakin urgent. Ranking untuk antrian AI. | Rule deterministik, bukan LLM |
| **Threshold** | Config per Kategori: `H-7, H-3, H-1` default, editable. Trigger notifikasi push dan badge. |  |
| **Notifikasi** | Push PWA dan badge dashboard di H-threshold. WA opsional, tidak wajib v1. Eskalasi tidak ada v1. | Di-schedule via Service Worker dan daily batch 07:00 |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-002](../adr/0002-langchain-gemini-hybrid-advisor.md).

---

## Vision

Sistem hitung sendiri mana stok yang paling mepet kadaluarsa, urutkan paling urgent di atas, dan ingatkan supervisor tepat di H-7, H-3, H-1 sesuai kategori. Supervisor tidak perlu hitung manual, cukup lihat badge warna dan notifikasi jam 7 pagi.

---

## Persona

**Supervisor yang sibuk dan sering lupa stok Dairy yang cepat basi.** Dia mau buka HP jam 7 pagi, lihat notifikasi "Susu UHT batch 10 pcs H-3", tap langsung lihat list urgent. Dia mau warna merah untuk H-1, oranye H-3, kuning H-7. Barang non-perishable tidak usah diingatkan.

---

## Requirements

- `daysToExpiry(expiry_date, today Asia/Jakarta startOfDay)` = `ceil((expiry_date - startOfDay(today)) / 1day)` dengan `timeZone: Asia/Jakarta`. Hasil negatif untuk sudah lewat. Batch dengan `expiry_date null` return null dan di-skip.
- `urgencyScore(qty, days_to_expiry, avg_daily_usage)` = `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil atau negatif semakin urgent. Jika avg 0, pakai 1 agar tidak Infinity.
- Ranking: query semua Batch dengan expiry tidak null, hitung days dan score, sort ascending (paling urgent di atas).
- Notifikasi scheduler: cek harian jam 07:00 Asia/Jakarta via `setInterval` dan saat app dibuka. Bandingkan `days_to_expiry` dengan `threshold_h_minus` per Kategori. Jika cocok, tampilkan push notification dan update badge.
- Threshold per Kategori editable, default `[7,3,1]` generik. Evaluasi per Batch pakai threshold kategori dari SKU induknya.
- Badge: tampil di dashboard, hitung per SKU jumlah qty batch yang masuk threshold, warna merah jika H kurang sama dengan 1, oranye H kurang sama dengan 3, kuning H kurang sama dengan 7.
- WA hook hanya stub `waHook.log`, tidak kirim WA sungguhan di v1. Eskalasi notifikasi tidak ada v1.
- LLM dilarang hitung `days_to_expiry` dan `urgencyScore`. Semua dari rule lokal.

---

## Acceptance Gherkin

```gherkin
Feature: Expiry Engine dan Notifikasi

  Scenario: Hitung Days to Expiry Asia Jakarta
    Given today adalah 2026-09-02 startOfDay Asia/Jakarta
    And Batch expiry 2026-09-05
    When engine hitung daysToExpiry
    Then hasil adalah 3

  Scenario: Batch tanpa expiry di-skip
    Given Batch expiry null
    When engine hitung daysToExpiry
    Then hasil null dan batch tidak masuk ranking urgent

  Scenario: Hitung UrgencyScore
    Given qty 10 days 3 avg 2
    When engine hitung urgencyScore
    Then hasil 15

  Scenario: Urgency negatif paling urgent
    Given Batch A qty 10 days -2 avg 2
    And Batch B qty 10 days 5 avg 2
    When ranking diurutkan
    Then Batch A di atas Batch B

  Scenario: Avg nol pakai 1
    Given avg_daily_usage 0
    When hitung urgencyScore qty 5 days 4
    Then hasil 20 bukan Infinity

  Scenario: Notifikasi H threshold kategori
    Given kategori Dairy threshold [7,3,1]
    And Batch Susu days 3
    And today mock 2026-09-02
    When scheduler cek jam 07:00
    Then notifikasi muncul 1 dengan nama SKU Susu H-3

  Scenario: Tidak trigger di luar threshold
    Given Batch days 10 dan threshold [7,3,1]
    When scheduler cek
    Then tidak ada notifikasi untuk batch itu

  Scenario: Batch null tidak trigger notifikasi
    Given Batch expiry null
    When scheduler cek
    Then tidak ada notifikasi

  Scenario: Permission denied fallback ke badge
    Given Notification permission denied
    When scheduler coba push
    Then tidak throw error dan badge tetap update
```

---

## Trace ke TASK

Trace: TASK-08, TASK-09, TASK-10, TASK-11

- TASK-08 — Avg Daily Usage dibutuhkan sebagai input urgency.
- TASK-09 — Expiry engine deterministik `daysToExpiry` dan `urgencyScore` dengan TZ Asia/Jakarta.
- TASK-10 — Notifikasi scheduler 07:00 dan threshold per kategori, SW notif, WA hook stub.
- TASK-11 — Badge dan urgent dashboard list dengan warna H dan hitung per SKU.

---

## KPI

- Akurasi `daysToExpiry` 100 persen terhadap startOfDay Asia/Jakarta di unit test.
- Ranking urgent benar untuk 5 batch acak di test, tidak ada miss sort.
- Notifikasi trigger tepat di H yang ada di threshold, 0 false positive untuk H di luar threshold.
- Badge warna sesuai: merah H kurang sama 1, oranye H kurang sama 3, kuning H kurang sama 7.

---

## Must NOT Have

- Tidak ada hitungan urgency atau days oleh LLM.
- Tidak ada WA Business API send, hanya log.
- Tidak ada eskalasi atau snooze notifikasi v1.
- Tidak ada simpan TZ UTC, harus Asia/Jakarta.

---

## References

- [CONTEXT.md](../../CONTEXT.md:12-15) — Expiry, Days to Expiry, Avg Daily Usage, UrgencyScore verbatim.
- [CONTEXT.md](../../CONTEXT.md:26) — LLM hanya wording dan pairing, angka dari DB.
- [ADR-002](../adr/0002-langchain-gemini-hybrid-advisor.md) — Rule hitung urgency tanpa LLM, hemat token.
- Draft C3 Expiry Engine [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).

---

---

## Polish Wave 5 — Biar Jadi (Real Data, Anti-Dummy)

**Gap sekarang:** engine sudah pass unit test tapi notif masih stub, belum baca threshold real per kategori dari Dexie.

| Crew | Sisa kerja di FRD-03 | File | Done jika |
|------|----------------------|------|-----------|
| **B Core** | `notifScheduler` baca `threshold_h_minus` real per Kategori, trigger `07:00 + on open + on batch insert`, batch `expiry=null` skip | `src/engine/expiry.ts`, `src/engine/notifScheduler.ts`, `src/sw/notif.ts` | `bun test src/engine/notifScheduler.test.ts` H-3 trigger H-10 tidak, null tidak |
| **A Frontend** | Badge warna H-1 merah H-3 oranye H-7 kuning real dari `daysToExpiry` Asia/Jakarta | `src/components/Badge.tsx`, `src/features/dashboard/UrgentList.tsx` | `npx playwright test e2e/badge.spec.ts` merah/oranye/kuning |

Branch: `feat/polish-expiry-b` (core) & `feat/polish-expiry-a` (badge).

*FRD-03 self-contained. Verifikasi: `grep -q "FRD-03" docs/frd/frd-03-expiry.md && grep -q "TASK-" docs/frd/frd-03-expiry.md && grep -q "Wave 5 Polish" docs/frd/frd-03-expiry.md`*
