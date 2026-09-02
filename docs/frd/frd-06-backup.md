# FRD-06 Feature F6: Backup dan Restore

> Jika HP hilang atau rusak, data tidak hilang. Supervisor bisa backup satu file terenkripsi dan restore di HP baru dengan PIN yang sama.

- **FRD ID:** FRD-06
- **Feature:** F6 Backup dan Restore
- **Versi:** 1.0
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu acuan:** Asia/Jakarta (WIB)
- **Trace TASK:** TASK-03, TASK-18
- **File sumber:** `docs/frd.md` FRD-06 section verbatim
- **Detail index:** [docs/frd.md](../frd.md)

---

## Glosarium Relevan (verbatim dari CONTEXT.md)

| Term | Definisi | Catatan |
|------|----------|---------|
| **Supervisor** | Satu-satunya user v1, pegang 1 HP device. Punya PIN. Bisa approve promo, edit threshold, backup. | Tidak ada multi-role v1 |
| **Threshold** | Config per Kategori: `H-7, H-3, H-1` default, editable. Trigger notifikasi push dan badge. |  |
| **Notifikasi** | Push PWA dan badge dashboard di H-threshold. WA opsional, tidak wajib v1. Eskalasi tidak ada v1. | Di-schedule via Service Worker dan daily batch 07:00 |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-001](../adr/0001-local-first-dexie-backup-drive.md).

---

## Vision

Jika HP hilang atau rusak, data tidak hilang. Supervisor bisa backup satu file terenkripsi, simpan di HP atau Drive, dan restore di HP baru dengan PIN yang sama. Proses offline, aman, dan tidak butuh cloud wajib.

---

## Persona

**Supervisor yang takut HP jatuh ke air.** Dia mau tiap minggu tap Backup, file tersimpan, kalau ganti HP tinggal tap Restore, masukkan PIN, semua SKU Batch dan promo kembali. Dia tidak paham enkripsi, tapi mau rasa aman bahwa file tidak bisa dibuka orang lain tanpa PIN.

---

## Requirements

- Export: baca semua tabel Dexie (`skus`, `kategoris`, `batches`, `transaksis`, `promos`, `advisorCache`, `settings`) jadi satu JSON, kompres opsional, enkripsi AES-GCM-256 dengan key = PBKDF2(PIN, salt 16 byte random, 100k iterasi), hasilkan file `.json.enc` dan trigger download.
- Import Restore: pilih file, masukkan PIN, decrypt, validasi JSON, replace atau merge ke Dexie (v1 replace dengan konfirmasi "Hapus data lama dan ganti dengan backup"), tampilkan ringkasan jumlah SKU dan Batch yang dipulihkan.
- Drive hook opsional: tombol `Backup ke Google Drive` jika `window.showPicker` tersedia, jika tidak tampil instruksi manual upload file ke Drive.
- Notifikasi backup mingguan: jika 7 hari tidak backup, tampilkan pengingat di dashboard (bukan push wajib).
- Keamanan: PIN tidak disimpan plaintext, hanya hash untuk verifikasi. File tanpa PIN tidak bisa decrypt. Salt disimpan di header file.
- Validasi: file corrupt tampil error bahasa Indonesia jelas, tidak crash. Versi file dicatat untuk migrasi nanti.
- Tidak ada sync otomatis, semua manual. Tidak ada backend.
- Tombol 48px, bahasa Indonesia, konfirmasi sebelum restore.

---

## Acceptance Gherkin

```gherkin
Feature: Backup dan Restore

  Scenario: Export terenkripsi roundtrip
    Given ada 2 SKU dan 3 Batch di Dexie
    And PIN supervisor 1234 sudah set
    When supervisor tap Backup dan pilih Export Terenkripsi
    Then file .json.enc terunduh
    When supervisor hapus semua data lalu tap Restore pilih file dan masukkan PIN 1234
    Then data kembali 2 SKU dan 3 Batch

  Scenario: PIN salah gagal decrypt
    Given file backup terenkripsi dengan PIN 1234
    When restore dengan PIN 0000
    Then gagal dengan pesan "PIN salah, tidak bisa buka backup"

  Scenario: File corrupt tidak crash
    Given file backup rusak atau bukan JSON
    When supervisor coba restore
    Then tampil error "File rusak, coba file lain" tanpa crash

  Scenario: Konfirmasi replace sebelum restore
    Given Dexie sudah ada data
    When supervisor pilih file backup dan tap Restore
    Then muncul konfirmasi "Hapus data lama dan ganti dengan backup" dengan tombol Batal dan Lanjut

  Scenario: Drive hook manual fallback
    Given window.showPicker tidak tersedia
    When supervisor tap Backup ke Google Drive
    Then tampil instruksi "File sudah diunduh, upload manual ke Google Drive"

  Scenario: Pengingat mingguan
    Given terakhir backup 8 hari lalu
    When supervisor buka Dashboard
    Then tampil pengingat "Sudah 7 hari belum backup, yuk backup sekarang" dengan tombol Backup

  Scenario: Header salt dan versi
    Given file backup baru dibuat
    When file diperiksa
    Then header berisi salt 16 byte dan version 1
```

---

## Trace ke TASK

Trace: TASK-03, TASK-18

- TASK-03 — Supervisor PIN auth dan crypto PBKDF2 AES-GCM untuk API key, fondasi enkripsi yang dipakai ulang untuk backup.
- TASK-18 — Backup Restore JSON terenkripsi dan Drive hook, export import roundtrip.

---

## KPI

- Roundtrip backup restore 100 persen pulihkan jumlah SKU dan Batch di test.
- Decrypt dengan PIN salah 100 persen gagal dengan pesan jelas, tidak ada data bocor.
- File corrupt 100 persen ditangani tanpa crash.
- Pengingat mingguan muncul tepat setelah 7 hari tanpa backup.

---

## Must NOT Have

- Tidak ada backup otomatis ke cloud tanpa tap supervisor.
- Tidak ada sync multi-HP atau conflict resolution v1.
- Tidak ada plaintext backup tanpa enkripsi sebagai default, harus terenkripsi.
- Tidak ada backend server untuk simpan backup v1.

---

## References

- [ADR-001](../adr/0001-local-first-dexie-backup-drive.md) — Local-first, backup Drive opsional, mitigasi data loss, Repository reversible.
- [CONTEXT.md](../../CONTEXT.md:19) — Supervisor single device PIN.
- Draft C5 Backup Restore [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).

---

---

## Polish Wave 5 — Biar Jadi (Real Data, Anti-Dummy)

**Gap sekarang:** backup sudah roundtrip tapi belum dipanggil dari UI real + gitleaks fix baru merge.

| Crew | Sisa kerja di FRD-06 | File | Done jika |
|------|----------------------|------|-----------|
| **D Platform** | Pastikan `backupService.ts` export semua tabel Dexie real + `crypto.ts` PBKDF2 100k salt 16B, `pinStore.ts` no plaintext | `src/features/backup/**`, `src/lib/crypto.ts`, `src/features/auth/**` | `bun test src/features/backup/*.test.ts` roundtrip + `grep AIza src/features/auth/pinStore.test.ts` 0 |

Branch: `feat/polish-backup-d` (sudah include `fix-gitleaks-allowlist`).

*FRD-06 self-contained. Verifikasi: `grep -q "FRD-06" docs/frd/frd-06-backup.md && grep -q "TASK-" docs/frd/frd-06-backup.md && grep -q "Wave 5 Polish" docs/frd/frd-06-backup.md`*
