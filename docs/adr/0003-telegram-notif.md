# ADR-003: Telegram Direct-HTTPS Notifikasi + Barcode Camera Scan Allowlist

- **Status:** Accepted (2026-09-03, amandemen Wave 0 , allowlist Telegram real-send + barcode scan)
- **Context:** Supervisor minta rekap stok kritis tiap 07:00 WIB dan cashflow 14 hari (omzet minus belanja) masuk Telegram, bukan cuma badge di HP. Sebelumnya FRD-03 cuma stub `waHook.log` dan AGENTS guardrail larang semua kamera/scan. Opsi yang dipertimbangkan: WA Business API via backend, Firebase Cloud Messaging, polling backend cron, dan Telegram direct-HTTPS tanpa backend. Constraint tetap local-first 100 persen offline jalan, single Supervisor, tanpa server wajib v1.
- **Decision:** Pakai **Telegram Bot API direct-HTTPS via `fetch` ke `api.telegram.org`** tanpa backend, plus **barcode camera scan allowlist** terbatas:
  1. **Direct HTTPS, tanpa backend:** `fetch POST https://api.telegram.org/bot<token>/sendMessage` dari browser. Tidak ada server, tidak ada Supabase, tidak ada Firebase. Token Bot simpan terenkripsi via `src/lib/crypto.ts` (PBKDF2 100k + AES-GCM-256, salt 16 byte, iv 12 byte, key tidak extractable, sama seperti PIN dan API key Gemini). Token tidak pernah plaintext di code, env, atau git.
  2. **Antre offline IndexedDB:** Jika offline atau `fetch` gagal, masukkan ke tabel `telegramQueue` (Dexie) dengan dedup key `batchId+tanggal` (satu batch satu hari satu pesan). Retry 3 kali dengan jeda 5 detik, 30 detik, 5 menit. Jika masih gagal, diam dan biarkan badge/dashboard yang jadi fallback. Queue di-retry saat `navigator.onLine` atau app dibuka berikutnya.
  3. **Trigger:** rekap harian 07:00 Asia/Jakarta (sama dengan scheduler notifikasi 07:00), plus on-demand saat batch kritis baru (days kurang sama dengan max threshold kategori). Isi pesan: list stok kritis (nama SKU, qty, H-minus, warna urgency) dan cashflow 14 hari. Bahasa Indonesia.
  4. **Kamera allowlist HANYA untuk barcode scan:** `html5-qrcode` lazy-load hanya di route `/scan`, tidak preload di dashboard. Dipakai untuk isi `barcode` SKU dan cari SKU saat terima barang. OCR (baca nota foto) dan QR code generation tetap dilarang v1. Kamera tidak dipakai untuk fitur lain.
- **Consequences:**
  - (+) Zero backend cost, tetap local-first. Semua operasional harian (SKU, Batch, promo, approve, badge) 100 persen offline tanpa Telegram. Internet hanya untuk kirim notif, gagal pun tidak block apapun.
  - (+) Supervisor dapat rekap di Telegram tanpa buka HP toko. Retry 3x dengan dedup cegah spam dan jaga kuota.
  - (+) Barcode scan percepat input tanpa ubah model data. Lazy-load jaga bundle tetap kecil.
  - (-) Butuh internet saat kirim. Offline lama berarti Telegram tidak kekirim, tapi badge dan dashboard tetap tampilkan yang sama, jadi tidak ada data loss, hanya delay notif.
  - (-) Token Telegram adalah secret tambahan yang harus dienkripsi. Mitigasi: reuse `crypto.ts` yang sudah ada, tidak bikin sistem crypto baru.
  - (-) Izin kamera perlu permission. Mitigasi: hanya minta saat buka `/scan`, fallback ke input manual jika denied, tidak throw.
- **Alternatives considered:**
  - WA Business API via backend: ditolak, butuh server, cost per pesan, setup verifikasi bisnis, langgar no-backend v1.
  - Firebase Cloud Messaging + backend cron: ditolak, butuh Firebase project, service account, dan server untuk trigger 07:00, overkill untuk 1 toko.
  - Polling backend cron + Supabase: ditolak, butuh Supabase dan RLS sejak hari pertama, tidak penuhi tidak depends cloud.
  - Telegram via backend proxy: ditolak untuk v1, proxy butuh server. Direct-HTTPS lebih sederhana dan cukup aman karena token terenkripsi di device, bukan di server.
  - OCR nota otomatis (foto struk jadi Batch): ditolak v1, akurasi rendah untuk tulisan tangan supplier, butuh tesseract 2MB plus. Tetap Must NOT.
- **Reversible?** Ya. Ganti `fetch` Telegram ke backend proxy tanpa ubah trigger atau queue interface. Ganti `html5-qrcode` ke library scan lain tanpa ubah field `barcode` SKU. Hapus Telegram pun tidak ubah engine expiry karena notif hanya consumer dari ranking urgent.
- **Tidak langgar local-first (rationale):** Local-first artinya operasional inti jalan tanpa internet (ADR-001). Telegram adalah channel notifikasi outbound tambahan, bukan storage. Data tetap di Dexie, hitungan expiry tetap lokal. Jika internet mati berhari-hari, toko tetap jalan, badge tetap muncul, transaksi tetap catat. Telegram hanya memperluas jangkauan notif yang sebelumnya cuma push browser 07:00, sekarang tambah chat yang bisa dibaca dari HP lain. Jadi ini allowlist pengecualian yang konsisten, bukan pengkhianatan prinsip.
