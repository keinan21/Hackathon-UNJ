# Panduan Telegram untuk Owner Warung — Cara Buat Bot dan Tempel Token

> File ini mandiri. Ikuti dari atas sampai bawah tanpa perlu chat tambahan. Tidak ada token asli di file ini. Token kamu hanya disimpan di HP toko, terenkripsi, tidak pernah masuk git.

---

## Ringkasan cepat

Kamu akan buat bot Telegram sendiri, dapat 2 hal, lalu tempel di aplikasi saat worker Wave 5 ingatkan di chat.

1. **Token bot** — kunci rahasia bot kamu dari @BotFather
2. **Chat ID** — alamat chat Telegram kamu untuk terima rekap

Setelah ditempel di Setting aplikasi, token disimpan terenkripsi pakai PBKDF2 100 ribu iterasi plus AES-GCM lewat `src/lib/crypto.ts` ke tabel `settings`. Tidak pernah plaintext di code atau git.

Rekap masuk tiap **07.00 WIB** plus saat ada batch baru yang kritis. Isinya: list stok mau kadaluarsa (nama SKU, sisa qty, H-minus, warna urgency) dan cashflow 14 hari (omzet minus belanja). Kalau offline, antre di `telegramQueue` dedup `batchId+tanggal` dan retry 3 kali 5 detik, 30 detik, 5 menit. Badge dashboard tetap jalan sebagai fallback.

---

## Langkah 1 — Buat bot di @BotFather dan dapat token

Lakukan di HP yang ada Telegram:

1. Buka Telegram, di kolom cari ketik `@BotFather` (akun centang biru, username persis `@BotFather`). Tap **Start** kalau baru pertama kali.
2. Ketik `/newbot` dan kirim.
3. BotFather balas minta nama bot. Ketik nama yang ramah, contoh `Warung Kita Notif`. Ini nama yang dilihat orang.
4. BotFather minta username bot. Username harus huruf kecil, boleh angka dan underscore, dan harus berakhir `bot`. Contoh `warungkita_notif_bot`. Kalau sudah dipakai, coba tambah angka di belakang seperti `warungkita_notif_bot_01`.
5. BotFather balas dengan pesan berisi token. Token itu panjang, ada angka, titik dua, dan huruf acak. Di bawahnya ada link ke bot kamu `t.me/username_bot_kamu`.

**Simpan token sementara di catatan HP yang aman. Jangan share ke orang lain, jangan foto dan sebar di grup.**

Bentuk token asli mirip angka panjang, titik dua, lalu huruf dan angka acak. Di dokumen ini kita tulis sebagai `<TOKEN_BOT_KAMU>` saja. Jangan pernah tulis token asli di file ini, di git, atau di chat umum.

> Contoh placeholder di file ini: `<TOKEN_BOT_KAMU>`
> Ini bukan token betulan. Token betulan kamu dapat dari BotFather di langkah 5 di atas.

Kalau token terlanjur bocor, balik ke `@BotFather`, ketik `/revoke`, pilih bot kamu, dan BotFather akan kasih token baru. Ulangi simpan dan tempel ulang di Setting.

---

## Langkah 2 — Dapat Chat ID

Chat ID adalah alamat tujuan rekap. Paling mudah pakai 2 cara ini, pilih satu:

### Cara A — via @userinfobot (paling mudah)

1. Di Telegram cari `@userinfobot`, tap Start.
2. Bot langsung balas dengan info kamu, cari baris `Id:` atau `Chat ID`. Itulah Chat ID kamu. Catat angkanya.
3. Di dokumen ini kita tulis sebagai `<CHAT_ID_KAMU>`.

### Cara B — via getUpdates (kalau cara A tidak bisa)

1. Buka bot yang baru kamu buat tadi (username bot kamu), kirim satu pesan bebas, misal `halo`.
2. Buka browser di HP atau laptop, buka alamat ini dengan tempel token kamu di bagian `<TOKEN_BOT_KAMU>`:

   `https://api.telegram.org/bot<TOKEN_BOT_KAMU>/getUpdates`

   Ganti `<TOKEN_BOT_KAMU>` dengan token asli kamu, lalu Enter.
3. Di halaman itu cari bagian `chat`, lalu `id`. Itulah Chat ID kamu. Catat.

**Catatan:**
- Kalau mau rekap masuk ke grup, buat grup Telegram, masukkan bot kamu sebagai anggota, kirim satu pesan di grup, lalu buka `getUpdates` seperti di atas dan cari `chat` yang tipenya `group` atau `supergroup`, ambil `id` nya.
- Satu bot bisa kirim ke satu chat pribadi atau satu grup, pilih yang paling kamu cek tiap pagi.

---

## Langkah 3 — Tempel Token dan Chat ID ke aplikasi (saat Wave 5)

Worker Wave 5 akan ingatkan kamu di chat: "Owner, saatnya tempel token dan Chat ID Telegram."

Saat itu lakukan:

1. Buka aplikasi **Inventaris AI Tebus Murah** di HP toko.
2. Masuk ke menu **Setting** atau **Pengaturan**.
3. Cari bagian **Notifikasi Telegram**. Ada dua kolom:
   - **Token Bot** — tempel `<TOKEN_BOT_KAMU>` asli kamu
   - **Chat ID** — tempel `<CHAT_ID_KAMU>` asli kamu
4. Tap **Simpan**.

Apa yang terjadi setelah Simpan:

- Aplikasi langsung enkripsi token pakai `src/lib/crypto.ts` dengan PBKDF2 100 ribu iterasi dan AES-GCM 256, salt 16 byte dan iv 12 byte acak. Hasil enkripsi disimpan di tabel `settings` Dexie, bukan plaintext.
- Token tidak pernah disimpan di file, di localStorage tanpa enkripsi, atau di git. Hanya ciphertext yang ada di HP.
- Kalau kamu pakai fitur Backup terenkripsi `.json.enc`, token ikut terbackup dalam bentuk terenkripsi. Restore di HP baru butuh PIN yang sama untuk buka.

**Cara test:**
- Di Setting yang sama, kalau ada tombol **Kirim Test** atau **Test Telegram**, tap itu. Cek Telegram kamu, harus masuk pesan test dalam beberapa detik.
- Kalau tidak ada tombol test, tunggu rekap **07.00 WIB** besok pagi. Atau buat satu Batch baru dengan expiry dekat (misal H-2) agar trigger on-demand jalan.

Jika test tidak masuk:

- Cek token dan Chat ID tidak ada spasi di depan atau belakang.
- Cek HP ada internet.
- Cek bot sudah di-start (buka bot kamu, tap Start).
- Jika masih gagal, antre `telegramQueue` akan retry 3 kali 5 detik, 30 detik, 5 menit dengan dedup `batchId+tanggal`. Badge di dashboard tetap tampil, jadi kamu tidak kehilangan info.

---

## Langkah 4 — Jaga token tetap rahasia

Ini penting, tolong baca pelan:

- **JANGAN** pernah commit token ke git, jangan taruh di `HUMAN.md`, jangan taruh di file `.env` yang ikut ke repo.
- **JANGAN** share token di grup WA, Telegram umum, atau screenshot sebar.
- **JANGAN** kirim token ke orang yang mengaku admin. BotFather tidak pernah minta token balik.
- Token yang bocor bisa dipakai orang lain kirim pesan mengatasnamakan bot kamu. Kalau ragu bocor, revoke di `@BotFather` dengan `/revoke` dan ganti token, lalu tempel ulang di Setting.

File `HUMAN.md` ini memang sengaja tidak berisi token asli. Hanya langkah. Itu yang bikin `grep -E "[0-9]{8,10}:AA" HUMAN.md` harus 0.

---

## Jadwal dan isi rekap

- **Kapan kirim:** tiap hari **07.00 Asia/Jakarta** plus on-demand saat batch baru masuk kritis (days kurang sama dengan max threshold kategori, misal kategori Dairy `[7,3,1]` maka H-7 sudah kritis).
- **Isi pesan:** list stok kritis (nama SKU, qty, H-minus, warna urgency) dan cashflow 14 hari (omzet minus belanja). Angka dari DB, bukan karangan. Bahasa Indonesia.
- **Kalau offline:** pesan antre di `telegramQueue` Dexie dedup satu batch satu hari satu pesan. Retry 3 kali. Jika masih gagal, diam dan biarkan badge dan dashboard yang jadi sumber utama. Tidak ada data hilang, hanya telat notif.
- **Kalau offline berhari hari:** toko tetap jalan 100 persen, tambah SKU, Batch, buat promo manual, approve, semua offline. Telegram hanya tambahan.

---

## Kalau ada masalah

- **Token hilang:** balik ke `@BotFather`, ketik `/mybots`, pilih bot kamu, pilih **API Token**, copy lagi.
- **Chat ID lupa:** ulangi Langkah 2 Cara A atau B.
- **Ganti HP:** di HP lama tap **Backup** di Setting, masukkan PIN, file `.json.enc` terunduh. Pindah file ke HP baru, install PWA, tap **Restore**, masukkan PIN yang sama. Token terenkripsi ikut balik. Kalau tidak backup, tempel token dan Chat ID ulang di HP baru.
- **Mau ganti grup tujuan:** ganti Chat ID di Setting, Simpan. Rekap berikutnya ke tujuan baru.
- **Mau matikan Telegram:** kosongkan kolom Token dan Chat ID di Setting, Simpan. Rekap tetap ada di dashboard dan push browser 07.00.

---

## Checklist selesai

Centang kalau sudah:

- [ ] Bot dibuat via `@BotFather`, dapat token dan dicatat aman
- [ ] Chat ID didapat via `@userinfobot` atau `getUpdates`
- [ ] Token dan Chat ID ditempel di Setting aplikasi saat worker Wave 5 ingatkan, lalu Tap Simpan
- [ ] Test kirim berhasil, pesan masuk Telegram
- [ ] Token tidak pernah ditulis di file, di git, atau disebar
- [ ] Paham rekap 07.00 dan antre retry 3 kali sebagai fallback badge

---

## Referensi teknis untuk developer (owner boleh skip)

- ADR: `docs/adr/0003-telegram-notif.md` — Telegram direct-HTTPS tanpa backend, antre retry, allowlist `html5-qrcode` lazy di `/scan`
- Crypto: `src/lib/crypto.ts` — `deriveKey`, `generateSalt` 16 byte, `generateIv` 12 byte, `encryptString` dan `decryptString` AES-GCM, iterasi 100 ribu, hash SHA-256, key tidak extractable
- DB: `src/db/db.ts` — tabel `telegramQueue` indexed `dedupKey` dan `settings` untuk token terenkripsi, `org_id = toko-01`
- Arsitektur: `docs/architecture.md` bab Security PIN PBKDF2 AES-GCM dan C4 Container TelegramService
- FRD: `docs/frd/frd-03-expiry.md` trigger 07.00 dan on-demand, `docs/frd/frd-06-backup.md` backup terenkripsi

*Akhir HUMAN.md. Simpan file ini di repo root. Jangan tambah token asli.*
