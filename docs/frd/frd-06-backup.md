# FRD-06 Feature F6: Backup dan Restore

> Jika HP hilang atau rusak, data tidak hilang. Supervisor bisa backup satu file terenkripsi dan restore di HP baru dengan PIN yang sama, termasuk profil toko dan kode SKU baru.

- **FRD ID:** FRD-06
- **Feature:** F6 Backup dan Restore
- **Versi:** 1.1 (2026-09-03: tambah profil toko, backup v2 kolom baru)
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
| **Threshold** | Config per Kategori: `H-7, H-3, H-1` default, editable. Trigger notifikasi push dan badge. Kritis = days <= max threshold. | Threshold di setting bawah |
| **Notifikasi** | Push PWA dan badge dashboard di H-threshold plus Telegram rekap 07:00. Eskalasi tidak ada v1. | Di-schedule via Service Worker dan daily batch 07:00 |
| **Kode SKU** | Kode unik per org format XXX-NNN, backfill dan regenerasi. | Untuk backup v2 |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-001](../adr/0001-local-first-dexie-backup-drive.md), [HUMAN.md](../../HUMAN.md).

---

## Vision

Jika HP hilang atau rusak, data tidak hilang. Supervisor bisa backup satu file terenkripsi, simpan di HP atau Drive, dan restore di HP baru dengan PIN yang sama. Profil toko (nama toko) ikut terbawa, kode SKU, tag, transaksi extended, dan riwayat HPP tidak hilang. Proses offline, aman, dan tidak butuh cloud wajib.

---

## Persona

**Supervisor yang takut HP jatuh ke air.** Dia mau tiap minggu tap Backup, file tersimpan, kalau ganti HP tinggal tap Restore, masukkan PIN, semua SKU dengan kodenya, Batch, promo, tag, transaksi, profil toko, dan threshold kembali. Dia tidak paham enkripsi, tapi mau rasa aman bahwa file tidak bisa dibuka orang lain tanpa PIN. Nama toko ia isi sekali di login dan bisa ubah di Setting.

---

## Requirements

- Profil toko: field `nama_toko` di `settings` (string tidak kosong, tampil di header dan backup). Diisi saat login pertama bersama PIN, bisa edit di Setting. Validasi tidak kosong, bahasa Indonesia. Ikut ter-backup dan ter-restore.
- Export: baca semua tabel Dexie (`skus` termasuk `kode`, `kategoris`, `batches`, `transaksis` extended dengan `jenis, harga_jual_snapshot, pengirim, penerima, catatan`, `promos`, `advisorCache`, `settings` termasuk `nama_toko` dan token Telegram terenkripsi, `tags`, `sku_tags`, `hpp_history`, `telegramQueue` opsional) jadi satu JSON, kompres opsional, enkripsi AES-GCM-256 dengan key = PBKDF2(PIN, salt 16 byte random, 100k iterasi), hasilkan file `.json.enc` dan trigger download. Versi file naik ke v2 karena kolom baru.
- Backup v2 kolom baru: `skus.kode`, `tags`, `sku_tags`, `transaksis.jenis`, `transaksis.harga_jual_snapshot`, `transaksis.pengirim`, `transaksis.penerima`, `transaksis.catatan`, `hpp_history`, `settings.nama_toko`. Restore v2 harus migrasi aman: jika file v1 tanpa kode, generate kode saat restore via `computeKode`. Jika file v2 lengkap, restore apa adanya dengan cek unik kode per org.
- Import Restore: pilih file, masukkan PIN, decrypt, validasi JSON dan versi, replace atau merge ke Dexie (v1 replace dengan konfirmasi "Hapus data lama dan ganti dengan backup"), tampilkan ringkasan jumlah SKU dan Batch yang dipulihkan termasuk kode dan tag.
- Token Telegram: cara isi token dan chat ID ada di [HUMAN.md](../../HUMAN.md), tidak di FRD ini. Token disimpan terenkripsi di `settings` via `src/lib/crypto.ts`, ikut ter-backup dalam bentuk terenkripsi, tidak pernah plaintext di file atau git. Referensi HUMAN.md untuk langkah buat bot via BotFather.
- Drive hook opsional: tombol `Backup ke Google Drive` jika `window.showPicker` tersedia, jika tidak tampil instruksi manual upload file ke Drive.
- Notifikasi backup mingguan: jika 7 hari tidak backup, tampilkan pengingat di dashboard (bukan push wajib).
- Keamanan: PIN tidak disimpan plaintext, hanya hash untuk verifikasi. File tanpa PIN tidak bisa decrypt. Salt disimpan di header file. Token Telegram juga tidak plaintext.
- Validasi: file corrupt tampil error bahasa Indonesia jelas, tidak crash. Versi file dicatat untuk migrasi nanti (v1 dan v2).
- Tidak ada sync otomatis, semua manual. Tidak ada backend.
- Tombol 48px, bahasa Indonesia, konfirmasi sebelum restore. Threshold edit tetap di Setting bawah.

---

## Acceptance Gherkin

```gherkin
Feature: Backup dan Restore

  Scenario: Export terenkripsi roundtrip v2
    Given ada 2 SKU dengan kode DAI-001 dan 3 Batch dan 1 Tag dan 2 transaksis extended dan nama_toko "Toko Sari" di Dexie
    And PIN supervisor 1234 sudah set
    When supervisor tap Backup dan pilih Export Terenkripsi
    Then file .json.enc v2 terunduh
    When supervisor hapus semua data lalu tap Restore pilih file dan masukkan PIN 1234
    Then data kembali 2 SKU dengan kode sama dan 3 Batch dan Tag dan nama_toko "Toko Sari"

  Scenario: Restore v1 tanpa kode auto backfill
    Given file backup v1 tanpa field kode
    When restore dengan PIN benar
    Then SKU ter-backfill kode otomatis tanpa duplikat

  Scenario: Profil toko edit di Setting
    Given nama_toko "Toko Sari" sudah ada
    When supervisor ubah jadi "Toko Baru" di Setting
    Then settings nama_toko berubah dan header tampil "Toko Baru"
    When kosongkan nama_toko
    Then ditolak pesan Indonesia

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

  Scenario: Header salt dan versi v2
    Given file backup baru dibuat
    When file diperiksa
    Then header berisi salt 16 byte dan version 2
```

---

## Trace ke TASK

Trace: TASK-03, TASK-18

- TASK-03 — Supervisor PIN auth dan crypto PBKDF2 AES-GCM untuk API key dan token Telegram, fondasi enkripsi yang dipakai ulang untuk backup, plus `nama_toko` di settings.
- TASK-18 — Backup Restore JSON terenkripsi v2 dan Drive hook, export import roundtrip dengan kode, tags, transaksis extended, profil toko.

---

## KPI

- Roundtrip backup restore v2 100 persen pulihkan jumlah SKU dengan kode, Batch, Tag, nama_toko di test.
- Restore v1 auto backfill kode 100 persen tanpa duplikat.
- Decrypt dengan PIN salah 100 persen gagal dengan pesan jelas, tidak ada data bocor.
- File corrupt 100 persen ditangani tanpa crash.
- Pengingat mingguan muncul tepat setelah 7 hari tanpa backup.

---

## Must NOT Have

- Tidak ada backup otomatis ke cloud tanpa tap supervisor.
- Tidak ada sync multi-HP atau conflict resolution v1.
- Tidak ada plaintext backup tanpa enkripsi sebagai default, harus terenkripsi, termasuk token Telegram.
- Tidak ada backend server untuk simpan backup v1.
- Tidak ada simpan PIN atau token plaintext di file backup.

---

## References

- [ADR-001](../adr/0001-local-first-dexie-backup-drive.md) — Local-first, backup Drive opsional, mitigasi data loss, Repository reversible.
- [CONTEXT.md](../../CONTEXT.md:19) — Supervisor single device PIN, Kode SKU.
- [HUMAN.md](../../HUMAN.md) — Langkah buat bot Telegram dan isi token/chat ID, token terenkripsi via `src/lib/crypto.ts`.
- [ADR-003](../adr/0003-telegram-notif.md) — Token enkripsi dan antre Telegram, reuse `crypto.ts`.
- Draft C5 Backup Restore [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).

---

---

## Polish Wave 5 — Biar Jadi (Real Data, Anti-Dummy)

**Gap sekarang:** backup sudah roundtrip tapi belum dipanggil dari UI real, belum v2, gitleaks fix baru merge.

| Crew | Sisa kerja di FRD-06 | File | Done jika |
|------|----------------------|------|-----------|
| **D Platform** | Pastikan `backupService.ts` export semua tabel Dexie real plus v2 (`kode`, `tags`, `sku_tags`, transaksis extended, `hpp_history`, `nama_toko`) plus `crypto.ts` PBKDF2 100k salt 16B, `pinStore.ts` no plaintext, profil toko di Setting | `src/features/backup/**`, `src/lib/crypto.ts`, `src/features/auth/**`, `src/features/settings/**` | `bun test src/features/backup/*.test.ts` roundtrip v2 plus `grep -r "bot[0-9]" src` 0 |

Branch: `feat/polish-backup-d` (sudah include `fix-gitleaks-allowlist`).

*FRD-06 self-contained. Verifikasi: `grep -q "FRD-06" docs/frd/frd-06-backup.md && grep -q "TASK-" docs/frd/frd-06-backup.md && grep -q "Wave 5 Polish" docs/frd/frd-06-backup.md`*
