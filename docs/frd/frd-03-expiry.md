# FRD-03 Feature F3: Expiry Engine dan Notifikasi

> Sistem hitung sendiri mana stok yang paling mepet kadaluarsa, urutkan paling urgent di atas, dan ingatkan supervisor tepat di H-7, H-3, H-1 plus rekap Telegram 07:00 dengan cashflow.

- **FRD ID:** FRD-03
- **Feature:** F3 Expiry Engine dan Notifikasi
- **Versi:** 1.1 (2026-09-03: tambah Telegram rekap 07:00 plus cashflow, definisi kritis, input tanggal atau durasi)
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
| **Expiry** | `expiry_date` per Batch. Barang non-perishable tetap punya Batch tapi `expiry_date = null` dan tidak masuk engine notifikasi. | v1 pakai satu field saja |
| **Days to Expiry** | `ceil((expiry_date - today) / 1day)`. Negatif berarti sudah kadaluarsa. | Dihitung harian oleh engine, basis Asia/Jakarta startOfDay |
| **Avg Daily Usage** | Rata-rata qty terjual per hari per SKU, auto-hitung dari histori transaksi (fallback input manual jika histori kurang dari 14 hari). | Untuk urgencyScore |
| **UrgencyScore** | `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil atau negatif semakin urgent. Ranking untuk antrian AI. | Rule deterministik, bukan LLM |
| **Threshold** | Config per Kategori: `H-7, H-3, H-1` default, editable. Trigger notifikasi push dan badge. | Kritis = days <= max threshold |
| **Notifikasi** | Push PWA dan badge dashboard di H-threshold plus Telegram rekap 07:00. Eskalasi tidak ada v1. | Di-schedule via Service Worker dan daily batch 07:00 |
| **Omzet** | `Σ harga_jual_snapshot * qty keluar` 14 hari. | Untuk rekap Telegram |
| **Cashflow** | `omzet - belanja 14d` (belanja = `Σ harga_beli * qty masuk`). | Untuk rekap Telegram 07:00 |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-002](../adr/0002-langchain-gemini-hybrid-advisor.md), [ADR-003](../adr/0003-telegram-notif.md).

---

## Vision

Sistem hitung sendiri mana stok yang paling mepet kadaluarsa, urutkan paling urgent di atas, dan ingatkan supervisor tepat di H-7, H-3, H-1 sesuai kategori. Tiap pagi jam 7, rekap kritis plus omzet, margin, dan cashflow 14 hari masuk Telegram agar owner bisa pantau tanpa buka HP toko. Supervisor tidak perlu hitung manual, cukup lihat badge warna dan chat Telegram.

---

## Persona

**Supervisor yang sibuk dan sering lupa stok Dairy yang cepat basi.** Dia mau buka HP jam 7 pagi, lihat notifikasi "Susu UHT batch 10 pcs H-3" dan pesan Telegram dengan list yang sama plus omzet 14 hari. Dia mau warna merah untuk H-1, oranye H-3, kuning H-7. Barang non-perishable tidak usah diingatkan. Jika ia input expiry pakai durasi 30 hari, sistem ubah jadi tanggal yang benar.

---

## Requirements

- `daysToExpiry(expiry_date, today Asia/Jakarta startOfDay)` = `ceil((expiry_date - startOfDay(today)) / 1day)` dengan `timeZone: Asia/Jakarta`. Hasil negatif untuk sudah lewat. Batch dengan `expiry_date null` return null dan di-skip dari semua ranking, badge, dan Telegram.
- `urgencyScore(qty, days_to_expiry, avg_daily_usage)` = `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil atau negatif semakin urgent. Jika avg 0, pakai 1 agar tidak Infinity.
- Ranking: query semua Batch dengan expiry tidak null, hitung days dan score, sort ascending (paling urgent di atas).
- Definisi kritis: sebuah Batch disebut kritis jika `days_to_expiry <= max(threshold_h_minus)` kategori induk SKU-nya. Contoh kategori Dairy [7,3,1] maka kritis jika H kurang sama 7, kategori [14,7,3] maka kritis jika H kurang sama 14. Dashboard dan halaman khusus hanya tampilkan yang kritis. Badge merah jika H kurang sama nilai terkecil, oranye jika H kurang sama nilai tengah, kuning jika H kurang sama nilai terbesar.
- Input tanggal Batch: dukung dua mode di form masuk, pilih tanggal kalender atau isi durasi X hari dari `received_at`. Durasi dikonversi ke `expiry_date = startOfDay(received_at + X hari, Asia/Jakarta)`. Validasi expiry tidak boleh sebelum received.
- Notifikasi scheduler: cek harian jam 07:00 Asia/Jakarta via `setInterval` dan saat app dibuka dan saat batch baru dimasukkan (on insert). Bandingkan `days_to_expiry` dengan `threshold_h_minus` per Kategori. Jika cocok, tampilkan push notification dan update badge.
- Telegram rekap 07:00: tiap hari jam 07:00 Asia/Jakarta kirim rekap ke Telegram via `fetch https://api.telegram.org/bot<token>/sendMessage` direct-HTTPS tanpa backend (ADR-003). Isi: list stok kritis (nama SKU, qty, H-minus, warna urgency) plus ringkasan 14 hari: omzet, margin, cashflow. Angka omzet, margin, cashflow dari engine deterministik `src/engine/omzet.ts`, bukan LLM. Rumus: `omzet = Σ harga_jual_snapshot * qty keluar`, `margin = omzet - Σ hpp_snapshot * qty keluar`, `cashflow = omzet - Σ harga_beli * qty masuk` semua rolling 14 hari. Bahasa Indonesia.
- Antre offline Telegram: jika offline atau fetch gagal, masukkan ke `telegramQueue` Dexie dedup key `batchId+tanggal` (satu batch satu hari satu pesan). Retry 3 kali jeda 5 detik, 30 detik, 5 menit. Jika masih gagal, diam dan biarkan badge yang jadi fallback. Token terenkripsi PBKDF2 100k plus AES-GCM via `src/lib/crypto.ts`, tidak pernah plaintext.
- Threshold per Kategori editable, default `[7,3,1]` generik. Evaluasi per Batch pakai threshold kategori dari SKU induknya, via `updateKategoriThreshold` dengan validasi menurun, unik, tidak kosong.
- Badge: tampil di dashboard, hitung per SKU jumlah qty batch kritis yang masuk threshold, warna merah jika H kurang sama 1, oranye H kurang sama 3, kuning H kurang sama 7 (atau mapping dinamis terhadap threshold kategori: terkecil merah, tengah oranye, terbesar kuning).
- Notifikasi push browser 07:00 tetap jalan. Telegram adalah allowlist tambahannya. Gagal kirim Telegram tidak block operasional.
- WA Business API tetap stub `waHook.log` (Must NOT kirim WA sungguhan). Yang real-send hanya Telegram allowlist di atas.
- Eskalasi notifikasi tidak ada v1.
- LLM dilarang hitung `days_to_expiry`, `urgencyScore`, `omzet`, `margin`, `cashflow`, dan BEP. Semua dari rule lokal.

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
    Then hasil null dan batch tidak masuk ranking urgent dan tidak ikut Telegram

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

  Scenario: Kritis ikut max threshold kategori
    Given kategori Dairy threshold [7,3,1] dan kategori Beras [14,7,3]
    And Batch Susu days 5 kategori Dairy dan Batch Beras days 10 kategori Beras
    When cek kritis
    Then Susu kritis karena 5 <= 7 dan Beras kritis karena 10 <= 14
    And Batch Susu days 10 tidak kritis karena 10 > 7

  Scenario: Badge warna kritis
    Given Batch kritis days 1 threshold [7,3,1]
    Then badge merah
    Given Batch kritis days 3
    Then badge oranye
    Given Batch kritis days 7
    Then badge kuning

  Scenario: Input durasi jadi tanggal
    Given received_at 2026-09-02 dan durasi 30
    When konversi
    Then expiry 2026-10-02 startOfDay Asia/Jakarta

  Scenario: Notifikasi H threshold kategori
    Given kategori Dairy threshold [7,3,1]
    And Batch Susu days 3
    And today mock 2026-09-02
    When scheduler cek jam 07:00
    Then notifikasi muncul 1 dengan nama SKU Susu H-3

  Scenario: Telegram rekap 07:00 berisi kritis plus cashflow
    Given ada 2 Batch kritis dan omzet 500000 margin 80000 cashflow 20000 dalam 14 hari
    When scheduler 07:00 kirim Telegram
    Then fetch ke api.telegram.org dipanggil dengan text berisi nama SKU kritis dan angka omzet margin cashflow dari DB
    And jika offline maka masuk telegramQueue dedup batchId+tanggal

  Scenario: Telegram retry 3x
    Given telegramQueue ada 1 pesan gagal
    When retry dengan jeda 5s lalu 30s lalu 5m
    Then coba 3 kali lalu diam dan biarkan badge fallback

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
    Then tidak throw error dan badge tetap update dan Telegram tetap antre
```

---

## Trace ke TASK

Trace: TASK-08, TASK-09, TASK-10, TASK-11

- TASK-08 — Avg Daily Usage dibutuhkan sebagai input urgency.
- TASK-09 — Expiry engine deterministik `daysToExpiry` dan `urgencyScore` dengan TZ Asia/Jakarta, plus `omzet.ts` untuk cashflow.
- TASK-10 — Notifikasi scheduler 07:00, on-open, on-insert, Telegram rekap plus `telegramQueue`, SW notif, WA hook stub.
- TASK-11 — Badge dan urgent dashboard list dengan warna H dan hitung per SKU, hanya tampilkan yang kritis.

---

## KPI

- Akurasi `daysToExpiry` 100 persen terhadap startOfDay Asia/Jakarta di unit test.
- Ranking urgent benar untuk 5 batch acak di test, tidak ada miss sort.
- Notifikasi trigger tepat di H yang ada di threshold, 0 false positive untuk H di luar threshold.
- Definisi kritis `days <= max threshold` benar 100 persen di test per kategori.
- Isi Telegram rekap berisi angka omzet, margin, cashflow yang sama dengan hitungan `omzet.ts` 100 persen.
- Badge warna sesuai: merah H terkecil, oranye tengah, kuning terbesar per threshold kategori.

---

## Must NOT Have

- Tidak ada hitungan urgency, days, omzet, margin, cashflow, atau BEP oleh LLM.
- Tidak ada WA Business API send, hanya stub log (Must NOT). Yang allowlist real-send hanya Telegram direct-HTTPS (ADR-003).
- Tidak ada eskalasi atau snooze notifikasi v1.
- Tidak ada simpan TZ UTC, harus Asia/Jakarta.
- Tidak ada backend untuk notifikasi. Telegram pakai fetch langsung, tanpa server, token terenkripsi.
- Tidak ada OCR. Telegram hanya kirim rekap, bukan baca foto.
- Tidak ada Telegram tanpa antre dan retry, harus ada `telegramQueue` 3x 5s/30s/5m dedup.

---

## References

- [CONTEXT.md](../../CONTEXT.md:12-15) — Expiry, Days to Expiry, Avg Daily Usage, UrgencyScore verbatim.
- [CONTEXT.md](../../CONTEXT.md:16) — Omzet, Margin, Cashflow untuk rekap Telegram.
- [ADR-002](../adr/0002-langchain-gemini-hybrid-advisor.md) — Rule hitung urgency tanpa LLM, hemat token.
- [ADR-003](../adr/0003-telegram-notif.md) — Telegram direct-HTTPS tanpa backend, token PBKDF2+AES-GCM, queue retry 3x dedup `batchId+tanggal`, local-first rationale.
- Draft C3 Expiry Engine [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).

---

---

## Polish Wave 5 — Biar Jadi (Real Data, Anti-Dummy)

**Gap sekarang:** engine sudah pass unit test tapi notif masih stub, belum baca threshold real per kategori dari Dexie dan belum kirim Telegram.

| Crew | Sisa kerja di FRD-03 | File | Done jika |
|------|----------------------|------|-----------|
| **B Core** | `notifScheduler` baca `threshold_h_minus` real per Kategori, trigger `07:00 + on open + on batch insert`, batch `expiry=null` skip, `telegramQueue` retry 3x, `omzet.ts` untuk cashflow | `src/engine/expiry.ts`, `src/engine/notifScheduler.ts`, `src/engine/omzet.ts`, `src/lib/telegram.ts`, `src/sw/notif.ts` | `bun test src/engine/notifScheduler.test.ts` H-3 trigger H-10 tidak, null tidak, `bun test src/engine/omzet.test.ts` omzet dan cashflow benar |
| **A Frontend** | Badge warna H-1 merah H-3 oranye H-7 kuning real dari `daysToExpiry` Asia/Jakarta, hanya kritis | `src/components/Badge.tsx`, `src/features/dashboard/UrgentList.tsx` | `npx playwright test e2e/badge.spec.ts` merah/oranye/kuning |

Branch: `feat/polish-expiry-b` (core) dan `feat/polish-expiry-a` (badge).

*FRD-03 self-contained. Verifikasi: `grep -q "FRD-03" docs/frd/frd-03-expiry.md && grep -q "TASK-" docs/frd/frd-03-expiry.md && grep -q "Wave 5 Polish" docs/frd/frd-03-expiry.md`*
