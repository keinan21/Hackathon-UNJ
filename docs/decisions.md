# Decisions , Inventaris AI Tebus Murah

> Kumpulan keputusan arsitektur dan log grill Q1-Q15 yang mengunci scope, stack, dan perilaku sistem. Dokumen ini adalah sumber kebenaran untuk kenapa tiap trade off dipilih, bukan cuma apa yang dipilih. Eksekutor baca ini sebelum ubah satu baris kode.

- **Versi:** 1.1
- **Tanggal:** 2026-09-03
- **Status:** Accepted (ADR-003 amandemen Wave 0)
- **Rujukan:** [CONTEXT.md](../CONTEXT.md), [FRD](../frd.md), [Design](../design.md), [Architecture](../architecture.md), [Plan](../.omo/plans/ai-inventory-expiry-advisor.md), [Draft](../.omo/drafts/ai-inventory-expiry-advisor.md)

---

## Daftar Isi

1. [ADR-001 Local-First Dexie + Backup Drive Opsional](#adr-001-local-first-dexie--backup-drive-opsional-pwa-offline)
2. [ADR-002 LangChain + Gemini Hybrid Advisor](#adr-002-langchain--gemini-hybrid-advisor-untuk-tebus-murah)
3. [ADR-003 Telegram Direct-HTTPS + Barcode Scan Allowlist](#adr-003-telegram-direct-https--barcode-camera-scan-allowlist)
4. [Grill Log Q1-Q15 dengan Rationale](#grill-log-q1-q15-dengan-rationale)
4. [Tradeoffs Komprehensif](#tradeoffs-komprehensif)
5. [Timeline Keputusan](#timeline-keputusan)
6. [Matriks Trace Keputusan ke FRD dan TASK](#matriks-trace-keputusan-ke-frd-dan-task)
7. [Referensi](#referensi)

---

## ADR-001 Local-First Dexie + Backup Drive Opsional (PWA Offline)

> Disalin verbatim dari [docs/adr/0001-local-first-dexie-backup-drive.md](./adr/0001-local-first-dexie-backup-drive.md) agar tidak drift.

- **Status:** Accepted (2026-08-31, grill round Q8)
- **Context:** User minta PWA offline, DB tidak depends cloud, HP supervisor saja. Repo greenfield, single toko UMKM. Kebutuhan: tetap jalan tanpa internet, tapi tidak hilang kalau HP rusak. Opsi: pure IndexedDB, local-first+Drive, local-first+Supabase sync.
- **Decision:** Pakai **Vite + React + Dexie (IndexedDB) pure local v1**, bungkus semua akses via `InventoryRepository` interface. Backup/Restore via export JSON terenkripsi + tombol "Backup ke Google Drive" (opsional, manual). Tidak ada sync multi-HP v1. Siapkan interface untuk upgrade ke Supabase sync tanpa ubah UI/AI di fase 2.
- **Consequences:**
  - (+) Zero cloud cost, privasi, 100% offline, cocok single device
  - (+) Simple, tidak butuh backend, vite-plugin-pwa matang
  - (-) Risiko data loss kalau tidak backup → mitigasi: notifikasi backup mingguan + export otomatis ke file
  - (-) Tidak ada multi-HP staff v1 → sesuai Q11 A (supervisor pegang HP)
- **Alternatives considered:**
  - OPFS SQLite (wa-sqlite): powerfull tapi kompleks, overkill untuk 1 toko
  - Supabase sync langsung: butuh internet, cost, tidak penuhi "tidak depends cloud"
- **Reversible?** Ya, via Repository pattern. Ganti impl Dexie → Dexie+Sync tanpa ubah caller.

**Implikasi ke FRD dan TASK:**

- Mengunci FRD-01 PWA Shell offline, FRD-02 Inventaris SKU/Batch/Kategori via Dexie, FRD-06 Backup Restore file `.json.enc`.
- Mengunci TASK-01 scaffold Vite React Dexie PWA, TASK-02 Dexie schema plus InventoryRepository, TASK-03 PIN crypto untuk backup, TASK-04 Service Worker, TASK-18 Backup Restore.

---

## ADR-002 LangChain + Gemini Hybrid Advisor untuk Tebus Murah

> Disalin verbatim dari [docs/adr/0002-langchain-gemini-hybrid-advisor.md](./adr/0002-langchain-gemini-hybrid-advisor.md) agar tidak drift.

- **Status:** Accepted (2026-08-31, grill round Q4/Q6/Q10)
- **Context:** Butuh saran "agar bahan bisa terpakai" + ide tebus murah Indomaret-style. Opsi: ADK vs LangChain, rule vs LLM, on-device vs API. Constraint: DB offline, AI online saja (batch harian + on-demand, cache di Dexie). User pilih LangChain + API (Q6 A).
- **Decision:** Pakai **LangChain + Gemini 2.5 Flash (via API)** dengan pola **hybrid**:
  1. Rule deterministik hitung `days_to_expiry`, `UrgencyScore` per Batch, ranking top-N urgent (tanpa LLM)
  2. LLM hanya dipanggil untuk top-N untuk generate: pairing SKU laku + copy promo + alasan, dengan guardrail `harga_tebus >= hpp*0.85` dan angka dari DB (LLM dilarang ngarang angka)
  3. Hasil `AdvisorSuggestion` di-cache di Dexie, jadi offline tetap bisa lihat saran kemarin. Trigger: 1x daily 07:00 + on-demand saat input batch baru dengan urgency tinggi.
  4. API key simpan encrypted di localStorage device (v1 pure local), nanti bisa pindah ke backend proxy kalau ada sync.
- **Consequences:**
  - (+) Hemat token (tidak panggil LLM untuk semua batch), anti-hallucinate harga
  - (+) Kualitas pairing dan wording LLM tetap tinggi, rule jaga akurasi
  - (-) Butuh internet untuk refresh saran → offline lihat cache saja (sesuai Q10)
  - (-) Vendor lock ke Google → mitigasi: bungkus `AdvisorPort` interface (walau Q6 pilih A, tetap siapkan port untuk swap)
- **Alternatives considered:**
  - ADK (Google Agent Dev Kit): agent-native tapi ekosistem inventaris minim vs LangChain
  - Pure rule: murah tapi saran kaku, tidak kreatif untuk tebus murah
  - On-device WebLLM: offline penuh tapi kualitas pairing turun drastis
- **Reversible?** Ya, ganti adapter LangChain → ADK tanpa ubah engine urgency.

**Implikasi ke FRD dan TASK:**

- Mengunci FRD-03 Expiry Engine rule deterministik, FRD-04 Advisor Hybrid dan Tebus Murah.
- Mengunci TASK-08 avgDailyUsage untuk urgency, TASK-09 expiry engine deterministik, TASK-12 pairing rule engine, TASK-13 LangChain Gemini hybrid plus cache guardrail, TASK-14 tebus manual plus AI assist, TASK-15 approve lifecycle, TASK-16 guardrail tests.

---

## ADR-003 Telegram Direct-HTTPS + Barcode Camera Scan Allowlist

> Disalin verbatim dari [docs/adr/0003-telegram-notif.md](./adr/0003-telegram-notif.md) agar tidak drift.

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

**Implikasi ke FRD dan TASK:**

- Mengunci FRD-03 notifikasi dari stub `waHook.log` menjadi allowlist Telegram real-send direct-HTTPS, dan FRD-02 barcode scan dari Must NOT menjadi allowlist `html5-qrcode` lazy di `/scan`.
- Mengunci TASK-10 scheduler tambah `telegramQueue` dan retry 3x, TASK-06 SKU tambah scan barcode, TASK-11 badge tetap fallback utama saat Telegram gagal. Tidak ada TASK baru, hanya amandemen scope dalam Wave 0 docs-only.

---

## Grill Log Q1-Q15 dengan Rationale

Grill 2026-08-31 menghasilkan 13 keputusan terkunci, ditambah Q14-Q15 amandemen 2026-09-03 untuk Telegram dan barcode scan. Tiap Q punya opsi, pilihan final, dan rationale kenapa opsi lain ditolak. Log ini jadi jangkar kalau ada yang usulkan scope creep.

### Q1 Perishable fokus , mana yang dikelola dulu

- **Pertanyaan:** Fokus ke barang perishable dengan expiry atau semua barang termasuk non-perishable.
- **Pilihan:**
  - A Perishable dulu, non-perishable ikut tapi tanpa expiry
  - B Semua barang sama, expiry opsional di SKU
  - C Hanya perishable, non-perishable tidak masuk v1
- **Keputusan:** **A**
- **Rationale:** Perishable adalah sumber waste dan butuh urgency. Non-perishable tidak boleh dikecualikan total karena toko UMKM jual beras dan snack juga, tapi v1 jangan paksa expiry di semua SKU. Solusi Batch `expiry_date = null` skip engine adalah kompromi yang jaga engine tetap bersih tanpa bikin dua sistem inventaris. Opsi B ditolak karena expiry di SKU langgar CONTEXT anti-pattern. Opsi C ditolak karena bikin toko tidak bisa catat beras karung.
- **Trace:** CONTEXT Expiry dan Days to Expiry, FRD-02 Requirements Batch nullable, TASK-07 Batch CRUD.
- **Reversible:** Ya, non-perishable bisa ditambah expiry nanti tanpa migrasi skema.

### Q2 Single toko , scope toko

- **Pertanyaan:** Satu toko atau langsung multi-toko multi-gudang.
- **Pilihan:**
  - A Single toko, single gudang, satu `org_id`
  - B Multi-toko v1 dengan `org_id` aktif
  - C Single toko tapi siap multi-toko via config
- **Keputusan:** **A**
- **Rationale:** UMKM target adalah satu toko dengan satu HP supervisor. Multi-toko v1 bikin auth, shard, dan sync yang belum ada urgensi, sementara zero cloud adalah permintaan eksplisit. Opsi B ditolak karena butuh Supabase RLS sejak hari pertama. Opsi C diterima separuh: single toko operasional, tapi `org_id = toko-01` tetap ada di semua tabel sebagai kolom sharding untuk jaga migration path, itu yang ada di plan sekarang.
- **Trace:** Architecture org_id sharding, FRD Prinsip Umum single device, TASK-02 org_id indexed.
- **Reversible:** Ya, tambah `org_id` baru tanpa rewrite karena kolom sudah ada.

### Q3 Threshold notifikasi , generik atau per kategori

- **Pertanyaan:** Threshold H- untuk notifikasi expiry diset generik atau beda per kategori.
- **Pilihan:**
  - A Per kategori, editable, default generik `[7,3,1]`
  - B Generik satu array untuk semua kategori
  - C Per SKU threshold custom
- **Keputusan:** **A**
- **Rationale:** Dairy butuh H-7 H-3 H-1 karena cepat basi, Beras bisa H-30 H-14 H-7 karena tahan lama. Generik murni bikin Dairy telat diingatkan atau Beras spam. Per SKU terlalu granular untuk UMKM non-tech, bikin setting melelahkan. Default generik `[7,3,1]` resolve C-02 plan: truth generik, seed contoh Dairy Snack Beras boleh override tapi tetap editable.
- **Trace:** CONTEXT Kategori threshold_h_minus dan Threshold, FRD-02 Kategori model, FRD-03 notifikasi scheduler per kategori, TASK-05 seed threshold editable, TASK-10 scheduler.
- **Reversible:** Ya, ubah array threshold kapan saja via Settings tanpa migrasi.

### Q4 Hybrid plus tebus murah , gaya saran AI

- **Pertanyaan:** Mau saran biasa atau saran tebus murah bundling ala Indomaret.
- **Pilihan:**
  - A Saran biasa tidak bundling
  - B Tebus murah manual tanpa AI
  - C Hybrid rule plus LLM untuk tebus murah bundling
- **Keputusan:** **C**
- **Rationale:** User eksplisit minta tebus murah Indomaret-style dan saran agar bahan bisa terpakai. Tebus murah bundling adalah mekanisme yang terbukti kurangi waste karena stok pelan dipasangkan dengan SKU laku. Pure rule kaku untuk wording promo, pure LLM boros token dan hallucinate harga. Hybrid adalah yang ada di ADR-002: rule ranking urgent, LLM untuk pairing dan alasan dengan angka dari DB.
- **Trace:** ADR-002, CONTEXT Tebus Murah dan Promo Aktif, FRD-04 Requirements pairing dan advisor, TASK-12 pairing rule, TASK-13 hybrid advisor.
- **Reversible:** Ya, AdvisorPort bisa ganti strategi tanpa ubah Batch model.

### Q5 Kategori threshold awal , nilai seed

- **Pertanyaan:** Nilai awal threshold untuk seeding kategori.
- **Pilihan:**
  - A Generik `[7,3,1]` untuk semua
  - B Per kategori beda: Dairy `[7,3,1]`, Snack `[14,7,3]`, Beras `[30,14,7]`
  - C Kosong, supervisor isi sendiri saat onboarding
- **Keputusan:** **A sebagai truth, B sebagai contoh editable di seed**
- **Rationale:** Hasil grill dan plan C-02: generik `[7,3,1]` adalah source of truth agar test deterministik, tapi seed boleh isi contoh beda per kategori yang tetap editable. Ini jaga konsistensi test `seed creates 3 kategori each threshold [7,3,1]` di TASK-05 sambil tunjukkan kemampuan per kategori. Opsi C ditolak karena bikin onboarding kosong dan supervisor bingung.
- **Trace:** Draft assumptions kategori threshold awal, plan TASK-05, FRD-02 seed.
- **Reversible:** Ya, supervisor edit threshold kapan saja di Settings.

### Q6 LangChain vs ADK , stack AI

- **Pertanyaan:** Pakai LangChain atau Agent Dev Kit untuk advisor.
- **Pilihan:**
  - A LangChain plus Gemini API
  - B ADK Google
  - C On-device WebLLM tanpa API
- **Keputusan:** **A**
- **Rationale:** LangChain ekosistem inventaris dan tool pairing lebih matang, contoh pairing rule dan cache pattern mudah di-plug. ADK agent-native tapi minim contoh inventaris dan butuh setup agent runtime yang berlebihan untuk tugas pairing sederhana. On-device kualitas pairing turun drastis dan bundle besar. Constraint DB offline AI online cache di Q10 juga cocok dengan API on-demand plus cache Dexie. Walau pilih A, tetap bungkus `AdvisorPort` untuk swap ke ADK tanpa ubah engine.
- **Trace:** ADR-002 alternatives, FRD-04 LangChain Gemini, TASK-13 AdvisorPort.
- **Reversible:** Ya, ganti adapter LangChain ke ADK.

### Q7 Tebus murah guardrail dan flow , 1-tap atau multi-step

- **Pertanyaan:** Guardrail harga dan flow approve promo.
- **Pilihan:**
  - A Guardrail `HPP*0.85` floor wajib
  - B Tebus murah tanpa floor, percaya supervisor
  - C Multi-step approve dengan konfirmasi berlapis
  - A plus C merged: guardrail plus 1-tap approve
- **Keputusan:** **A plus C merged: guardrail wajib plus 1-tap approve**
- **Rationale:** Guardrail `harga_tebus >= HPP*0.85` adalah anti-rugi yang tidak boleh di-bypass, harus jalan di code bukan di prompt. 1-tap approve adalah janji UX untuk UMKM non-tech: buka lihat approve dalam 3 tap max. Multi-step dengan dialog konfirmasi ganda ditolak karena tambah tap dan bikin supervisor malas pakai promo. Merge ini yang ada di draft Q7 A+C merged 1-tap.
- **Trace:** CONTEXT Tebus Murah guardrail, FRD-04 Requirements guardrail dan approve, plan C-03 M-09, TASK-14 proposed, TASK-15 approve lifecycle, TASK-16 guardrail tests.
- **Reversible:** Guardrail floor bisa jadi configurable ceiling `harga_normal*0.5` nanti, tapi floor tetap wajib.

### Q8 Backup strategi , local only atau plus Drive

- **Pertanyaan:** Backup data local saja atau plus cloud opsional.
- **Pilihan:**
  - A Pure local tanpa backup
  - B Local plus Drive backup manual opsional
  - C Sync Supabase realtime
- **Keputusan:** **B**
- **Rationale:** ADR-001 consequences jelas: pure local risiko data loss kalau HP rusak, sync cloud langgar tidak depends cloud dan butuh cost. B adalah tengah yang pragmatis: semua tetap di Dexie, tapi ada export JSON terenkripsi AES-GCM PBKDF2 plus tombol Backup ke Drive manual. Notifikasi backup mingguan sebagai pengingat. C ditolak v1 karena butuh internet stabil dan backend.
- **Trace:** ADR-001 Decision Backup Restore via JSON plus Drive opsional, FRD-06 Backup Restore, plan M-06, TASK-18 backupService.
- **Reversible:** Ya, tambah Supabase sync via Repository tanpa ubah data lokal.

### Q9 Batch plus avg , sumber Avg Daily Usage

- **Pertanyaan:** Hitung Avg Daily Usage dari mana.
- **Pilihan:**
  - A Input manual saja
  - B Auto dari histori saja, tanpa fallback
  - C Batch plus avg: auto dari histori transaksis, fallback manual jika histori kurang dari 14 hari
- **Keputusan:** **C**
- **Rationale:** Avg Daily Usage dibutuhkan untuk urgencyScore. Toko baru tidak punya 14 hari histori, jadi auto murni akan NaN atau 0 dan bikin urgency salah. Input manual murni bikin supervisor capek input tiap SKU. C adalah yang ada di draft assumptions dan CONTEXT: auto dari histori penjualan, fallback manual jika kurang dari 14 hari. Ini jaga akurasi tanpa blokir onboarding.
- **Trace:** CONTEXT Avg Daily Usage, FRD-02 avg model, FRD-03 urgencyScore, plan TASK-08, Architecture performance last 14 days.
- **Reversible:** Ya, window 14 hari bisa jadi 30 hari via config nanti.

### Q10 DB offline AI online cache , mode konektivitas

- **Pertanyaan:** DB dan AI harus offline atau online.
- **Pilihan:**
  - A Semua offline termasuk AI
  - B DB offline, AI online on-demand plus cache
  - C Semua online butuh internet
- **Keputusan:** **B (via ADR-002)**
- **Rationale:** DB offline adalah permintaan non-negotiable untuk gudang sinyal lemah. AI offline via WebLLM kualitas pairing jelek dan bundle berat. AI online murni akan gagal total saat offline. B adalah hybrid yang ada di ADR-002: operasional harian 100 persen offline dari Dexie, AI refresh saran 1x daily 07:05 plus on-demand saat batch baru urgent, hasil di-cache 24 jam di Dexie. Saat offline supervisor tetap lihat saran kemarin tanpa error.
- **Trace:** ADR-002 trigger daily plus on-demand cache Dexie, FRD-04 cache TTL 24 jam, TASK-13 hybrid advisor.
- **Reversible:** Bisa pindah ke model on-device jika quality naik, via AdvisorPort.

### Q11 Single device , auth model

- **Pertanyaan:** Berapa HP dan role yang didukung v1.
- **Pilihan:**
  - A Single device, single supervisor, PIN 4 digit
  - B Multi-HP supervisor plus staff dengan role
  - C Single device tapi pakai login email
- **Keputusan:** **A**
- **Rationale:** UMKM target satu HP pegang supervisor, tidak ada staff terpisah v1. Multi-role bikin permission dan sync yang belum perlu. Login email ribet untuk non-tech dan butuh internet. PIN 4 digit plus hash PBKDF2 cukup untuk single device, plus key turunan PIN untuk enkripsi backup dan API key. Ini konsisten dengan ADR-001 single device dan FRD Prinsip 1.
- **Trace:** CONTEXT Supervisor single device PIN, FRD-01 single device single supervisor, FRD-06 PIN hash, TASK-03 pinStore.
- **Reversible:** Bisa tambah Supabase Auth email nanti tanpa hapus PIN lokal, dua layer.

### Q12 Promo list , bentuk tampil promo

- **Pertanyaan:** Promo tebus murah tampil sebagai apa.
- **Pilihan:**
  - A Promo list v1: proposed ke active ke expired atau consumed, tampil di Dashboard dan badge SKU
  - B POS add-to-cart auto suggest di keranjang
  - C Cetak label atau QR untuk promo
- **Keputusan:** **A**
- **Rationale:** Promo list adalah inti tebus murah: supervisor buat promo dari batch urgent, approve 1-tap jadi Promo Aktif, lifecycle ke expired jika lewat expiry atau consumed jika qty 0. POS add-to-cart butuh integrasi kasir yang belum ada. Cetak label butuh printer dan QR generation yang out of scope v1. A paling hands-off dan traceable tanpa hardware tambahan.
- **Trace:** CONTEXT Tebus Murah dan Promo Aktif, FRD-04 lifecycle, FRD-05 dashboard promo aktif, plan scope OUT POS dan QR, TASK-14, TASK-15, TASK-17.
- **Reversible:** POS dan QR bisa tambah fase 2 tanpa ubah promo model.

### Q13 Stack , Vite plus Dexie TDD

- **Pertanyaan:** Stack tooling untuk PWA local-first.
- **Pilihan:**
  - A Vite plus React plus Dexie plus vite-plugin-pwa plus TDD Vitest Playwright bun
  - B Next.js plus Supabase
  - C CRA plus OPFS SQLite
- **Keputusan:** **A**
- **Rationale:** Vite React Dexie adalah kombinasi yang paling ringan, paling matang untuk PWA offline, zero cost, dan sesuai ADR-001. Next.js butuh backend dan tidak pure local. OPFS SQLite bundle besar dan overkill untuk 500 SKU. TDD dengan Vitest plus Playwright plus bun adalah yang ada di plan verification strategy: Vitest untuk engine, Playwright untuk PWA offline, bun untuk install dan build. Husky dan lint opsional v1 biar tidak lambat.
- **Trace:** Plan verification strategy, Architecture stack v1, TASK-01 scaffold.
- **Reversible:** Bisa migrasi ke Next atau OPFS nanti, tapi Repository jaga agar tidak lock ke Vite.

### Q14 Telegram notifikasi , WA stub vs Telegram direct-HTTPS

- **Pertanyaan:** Rekap 07:00 dan cashflow 14 hari dikirim via apa.
- **Pilihan:**
  - A Tetap stub `waHook.log`, kirim beneran butuh backend
  - B WA Business API via backend (server + cost per pesan)
  - C Telegram Bot direct-HTTPS tanpa backend, token enkripsi, antre retry 3x
- **Keputusan:** **C (ADR-003)**
- **Rationale:** Supervisor sudah pakai Telegram dan minta rekap 07:00 plus cashflow. WA Business butuh server, verifikasi bisnis, dan cost, langgar no-backend v1. Telegram Bot cukup `fetch` ke `api.telegram.org` dari browser, zero server. Token dienkripsi PBKDF2+AES-GCM via `src/lib/crypto.ts` yang sudah ada, antre offline di `telegramQueue` dedup `batchId+tanggal` retry 5 detik, 30 detik, 5 menit. Tidak langgar local-first karena semua operasional tetap 100 persen offline, Telegram hanya channel outbound, gagal pun fallback ke badge. Opsi A ditolak karena tidak kirim beneran. Opsi B ditolak karena butuh backend.
- **Trace:** ADR-003, FRD-03 notifikasi scheduler allowlist Telegram, TASK-10 telegramQueue.
- **Reversible:** Ya, ganti ke backend proxy tanpa ubah trigger atau queue. Hapus Telegram tidak ubah engine.

### Q15 Barcode scan , kamera untuk apa

- **Pertanyaan:** Kamera HP dipakai untuk scan apa.
- **Pilihan:**
  - A Tidak ada kamera v1 (Must NOT total)
  - B Kamera untuk OCR baca nota foto jadi Batch
  - C Kamera allowlist hanya untuk barcode scan SKU via `html5-qrcode` lazy di `/scan`
- **Keputusan:** **C (ADR-003)**
- **Rationale:** Input barcode manual lambat saat terima barang. Scan barcode percepat tanpa ubah model, field `barcode` sudah ada di SKU. `html5-qrcode` lazy hanya di route `/scan` jaga bundle, permission hanya diminta di sana, fallback manual jika denied. OCR ditolak v1 karena akurasi rendah untuk tulisan tangan supplier dan butuh tesseract 2MB plus. QR generation juga tetap dilarang. Opsi A terlalu keras, opsi B overkill.
- **Trace:** ADR-003, FRD-02 Must NOT amandemen allowlist scan, `src/features/scan/**` (future).
- **Reversible:** Ya, ganti library scan lain tanpa ubah field `barcode`. Hapus scan kembali ke input manual.

---

## Tradeoffs Komprehensif

Keputusan di atas melibatkan tradeoff yang harus jujur dicatat, biar tidak di-debat ulang tanpa data.

### 1. Dexie vs OPFS SQLite vs Supabase

| Aspek | Dexie IndexedDB | OPFS SQLite wa-sqlite | Supabase Postgres cloud |
|-------|-----------------|------------------------|-------------------------|
| Offline | 100 persen, zero config | 100 persen, butuh WASM worker | Butuh internet, offline cuma cache |
| Setup complexity | Rendah, 1 hari | Sedang tinggi, 3 hari WASM VFS | Sedang, 1 minggu RLS auth |
| Query power | Cukup, index filter | Kuat, SQL JOIN | Paling kuat, realtime |
| Cost v1 | 0 | 0 tapi bundle 300kb plus | 0 sampai 25 dolar per bulan saat scale |
| Bundle size | Dexie 30kb gz | WASM 300kb plus | Kecil client, cost server |
| Backup | JSON manual mudah | File SQLite agak ribet | Dump Postgres butuh akses cloud |
| Multi-toko sync | Tidak ada, build sendiri | Tidak ada, build sendiri | Ada, RLS per org_id |
| Risiko | HP hilang hilang data kalau tidak backup | Sama plus HP kentang lambat | Vendor lock plus butuh internet |
| Keputusan v1 | **Dipilih** | Ditolak overkill | Ditolak v1, siap v2 via Repository |

Pemenang untuk 1 toko sinyal lemah adalah Dexie telak. Supabase menang di 3 toko ke atas saat butuh HP kedua.

### 2. Rule vs LLM vs Hybrid untuk advisor

| Pola | Kelebihan | Kekurangan | Keputusan |
|------|-----------|------------|-----------|
| Pure rule | Murah, deterministik, tidak hallucinate | Saran kaku, wording promo jelek | Ditolak |
| Pure LLM | Wording kreatif, pairing fleksibel | Boros token, hallucinate harga HPP | Ditolak |
| On-device LLM | Offline penuh | Kualitas turun drastis, bundle besar | Ditolak |
| **Hybrid rule plus LLM** | Rule hitung angka hemat token, LLM hanya pairing wording | Butuh cache dan guardrail | **Dipilih** |

Hybrid hemat panggil LLM hanya untuk top-N urgent, angka dari DB, guardrail `HPP*0.85` di code. Cache 24 jam bikin hit rate 70 persen.

### 3. Threshold generik vs per kategori vs per SKU

| Pola | Kelebihan | Kekurangan | Keputusan |
|------|-----------|------------|-----------|
| Generik satu array | Simple, test deterministik | Dairy telat atau Beras spam | Truth untuk test, bukan untuk UX |
| Per kategori editable | Tepat per perishable, fleksibel | Butuh seed dan validasi | **Dipilih** |
| Per SKU custom | Paling presisi | Granular berlebih, melelahkan non-tech | Ditolak |

Resolve C-02: generik `[7,3,1]` truth, seed contoh Dairy Snack Beras editable.

### 4. Guardrail floor plus 1-tap vs multi-step

| Pola | Kelebihan | Kekurangan | Keputusan |
|------|-----------|------------|-----------|
| Tanpa guardrail | Bebas, cepat | Risiko rugi di bawah HPP | Ditolak |
| Guardrail plus multi-step confirm | Aman berlapis | 4 tap plus, bikin malas | Ditolak |
| **Guardrail plus 1-tap** | Anti-rugi plus cepat 3-tap | Butuh validasi dua kali | **Dipilih** |

Guardrail `harga_tebus >= HPP*0.85` wajib, optional ceiling `harga_normal*0.5` jika config aktif. 1-tap jaga KPI 3-tap max.

### 5. Backup local vs Drive manual vs Sync realtime

| Pola | Kelebihan | Kekurangan | Keputusan |
|------|-----------|------------|-----------|
| Local only tanpa backup | Simple | HP hilang data hilang total | Ditolak |
| **Local plus Drive manual** | Zero cloud wajib, aman jika rajin backup | Butuh disiplin supervisor | **Dipilih** |
| Sync realtime Supabase | Aman otomatis, multi-HP | Butuh internet stabil, cost, RLS | Ditolak v1 |

Mitigasi disiplin: banner reminder 7 hari belum backup plus export otomatis ke file.

### 6. Single device PIN vs multi-role vs email login

| Pola | Kelebihan | Kekurangan | Keputusan |
|------|-----------|------------|-----------|
| **Single PIN 4 digit** | Simple, offline, non-tech friendly | Tidak ada staff terpisah | **Dipilih** |
| Multi-role staff supervisor | Kolaborasi | Butuh auth, sync, permission v1 | Ditolak v1 |
| Email magic link | Familiar untuk tech | Butuh internet, ribet untuk UMKM | Ditolak, bisa tambah nanti dua layer |

PIN di-hash PBKDF2 100k, tidak plaintext, key turunan untuk AES-GCM backup dan API key.

### 7. Build cost dan bundle tradeoff

- Dexie 30kb vs WASM 300kb: untuk 500 SKU 2000 Batch, Dexie cukup dan cepat `<50ms` hitung urgency di HP mid-range. WASM tidak beri manfaat untuk query simple.
- LangChain plus Gemini via API vs WebLLM: WebLLM tambah 500MB model download, tidak realistis untuk kuota terbatas. API on-demand plus cache 24 jam hemat kuota.
- PWA Workbox via vite-plugin-pwa matang dan teruji, tidak perlu custom SW.

### 8. WA Business via backend vs Telegram direct-HTTPS vs OCR vs Barcode scan

| Pola | Kelebihan | Kekurangan | Keputusan |
|------|-----------|------------|-----------|
| WA Business via backend | Familiar WA | Butuh server, cost per pesan, verifikasi bisnis, langgar no-backend | Ditolak |
| Telegram via backend proxy | Aman token di server | Butuh server untuk proxy | Ditolak v1, opsi future |
| **Telegram direct-HTTPS (allowlist)** | Zero backend, token enkripsi lokal, retry antre, dedup | Butuh internet saat kirim, offline delay | **Dipilih (ADR-003)** |
| OCR foto nota jadi Batch | Auto input | Akurasi rendah tulisan tangan, bundle 2MB tesseract | Tetap Must NOT |
| **Barcode scan `html5-qrcode` lazy di `/scan`** | Cepat input barcode, lazy jaga bundle | Perlu permission kamera | **Allowlist (ADR-003)** |

Telegram direct-HTTPS adalah satu-satunya allowlist yang tidak butuh backend dan tetap local-first. Barcode scan adalah satu-satunya kamera yang diizinkan, OCR dan QR tetap dilarang.

---

## Timeline Keputusan

| Tanggal | Keputusan | Status | Evidence path |
|---------|-----------|--------|---------------|
| 2026-08-31 | CONTEXT glossary locked: SKU, Batch, Kategori, Expiry, Days to Expiry, Avg Daily Usage, UrgencyScore, AdvisorSuggestion, Tebus Murah, Promo Aktif, Supervisor, Threshold, Notifikasi | Accepted | `CONTEXT.md:1-30` |
| 2026-08-31 | Grill Q1 A perishable fokus dengan Batch nullable | Accepted | `docs/decisions.md#q1` |
| 2026-08-31 | Grill Q2 A single toko single gudang org_id toko-01 | Accepted | `docs/decisions.md#q2` |
| 2026-08-31 | Grill Q3 A threshold per kategori editable default generik [7,3,1] | Accepted | `docs/decisions.md#q3` |
| 2026-08-31 | Grill Q4 C hybrid plus tebus murah bundling | Accepted | `docs/decisions.md#q4` |
| 2026-08-31 | Grill Q5 seed generik truth plus contoh per kategori editable | Accepted | `docs/decisions.md#q5` |
| 2026-08-31 | ADR-002 Q6 A LangChain plus Gemini Flash hybrid | Accepted | `docs/adr/0002-langchain-gemini-hybrid-advisor.md` |
| 2026-08-31 | Grill Q7 A+C merged guardrail HPP*0.85 plus 1-tap approve | Accepted | `docs/decisions.md#q7` |
| 2026-08-31 | ADR-001 Q8 B local-first Dexie plus Drive backup opsional | Accepted | `docs/adr/0001-local-first-dexie-backup-drive.md` |
| 2026-08-31 | Grill Q9 C batch plus avg auto 14 hari fallback manual | Accepted | `docs/decisions.md#q9` |
| 2026-08-31 | Grill Q10 B DB offline AI online cache 24 jam 07:05 trigger | Accepted | `docs/decisions.md#q10` |
| 2026-08-31 | Grill Q11 A single device PIN 4 digit | Accepted | `docs/decisions.md#q11` |
| 2026-08-31 | Grill Q12 A promo list proposed active expired consumed | Accepted | `docs/decisions.md#q12` |
| 2026-08-31 | Grill Q13 A Vite React Dexie plus TDD Vitest Playwright | Accepted | `docs/decisions.md#q13` |
| 2026-08-31 | ADR-001 Accepted final | Accepted | `docs/adr/0001-local-first-dexie-backup-drive.md:3` |
| 2026-08-31 | ADR-002 Accepted final | Accepted | `docs/adr/0002-langchain-gemini-hybrid-advisor.md:3` |
| 2026-08-31 | FRD per-feature FRD-01..06 Accepted 737 lines | Accepted | `docs/frd.md:1-737` |
| 2026-08-31 | Design UMKM 3-tap Accepted 637 lines | Accepted | `docs/design.md:1-637` |
| 2026-08-31 | Architecture scalable pragmatis Accepted 525 lines | Accepted | `docs/architecture.md:1-525` |
| 2026-08-31 | Decisions log plus TASK agentic 24 tasks Accepted | Accepted | `docs/decisions.md` plus `TASK.md` |
| 2026-09-03 | ADR-003 Telegram direct-HTTPS + barcode scan allowlist Accepted | Accepted | `docs/adr/0003-telegram-notif.md` |
| 2026-09-03 | Grill Q14 Telegram C direct-HTTPS retry 3x dedup | Accepted | `docs/decisions.md#q14` |
| 2026-09-03 | Grill Q15 Barcode C allowlist html5-qrcode lazy /scan | Accepted | `docs/decisions.md#q15` |
| 2026-09-03 | Amandemen FRD-02 Must NOT allowlist scan, FRD-03 WA→Telegram, AGENTS guardrails | Accepted | `docs/frd/frd-02-inventaris.md:130` `docs/frd/frd-03-expiry.md` `AGENTS.md` |

**Urutan grill round:** Q1 Q2 Q3 Q4 Q6 Q8 Q10 Q11 Q13 adalah round grill utama, Q5 Q7 Q9 Q12 adalah artikulasi plan workshop iterasi lanjutan, Q14 Q15 adalah amandemen Wave 0 2026-09-03. Semua terkunci sebelum Wave 0 docs ditulis.

---

## Matriks Trace Keputusan ke FRD dan TASK

| Keputusan | FRD trace | TASK trace | Guardrail |
|-----------|-----------|------------|-----------|
| ADR-001 Dexie local-first | FRD-01, FRD-02, FRD-06 | TASK-01, TASK-02, TASK-03, TASK-04, TASK-18 | No backend cloud, no Supabase v1 |
| ADR-002 Hybrid Gemini Flash | FRD-03, FRD-04 | TASK-08, TASK-09, TASK-12, TASK-13, TASK-14, TASK-15, TASK-16 | LLM dilarang hitung angka, cache 24 jam |
| Q1 Perishable fokus Batch nullable | FRD-02 | TASK-07 | Expiry di Batch bukan SKU |
| Q2 Single toko org_id | Semua FRD Prinsip 1 | TASK-02 org_id sharding | Single supervisor v1 |
| Q3 Threshold per kategori [7,3,1] | FRD-02, FRD-03 | TASK-05, TASK-10 | Validasi descending no dup |
| Q4 Tebus murah bundling | FRD-04 | TASK-12, TASK-13, TASK-14 | Pairing co-occurrence fallback |
| Q5 Seed generik truth | FRD-02 | TASK-05 | Editable threshold |
| Q6 LangChain | FRD-04 | TASK-13 | AdvisorPort interface |
| Q7 Guardrail HPP*0.85 plus 1-tap | FRD-04 | TASK-14, TASK-15, TASK-16 | Floor wajib, 3-tap max |
| Q8 Drive backup manual | FRD-06 | TASK-18 | AES-GCM PBKDF2 100k |
| Q9 Avg auto 14 hari fallback manual | FRD-02, FRD-03 | TASK-08, TASK-09 | max avg 1 |
| Q10 DB offline AI online cache | FRD-04 | TASK-13 | Offline lihat cache kemarin |
| Q11 Single device PIN | FRD-01, FRD-06 | TASK-03 | PIN hash bukan plaintext |
| Q12 Promo list lifecycle | FRD-04, FRD-05 | TASK-11, TASK-14, TASK-15, TASK-17 | proposed active expired consumed |
| Q13 Vite Dexie TDD | Semua FRD | TASK-01, TASK-20 | bun Vitest Playwright |
| Q14 Telegram direct-HTTPS allowlist | FRD-03 | TASK-10 scheduler telegramQueue | fetch api.telegram.org, retry 3x 5s/30s/5m, dedup batchId+tanggal |
| Q15 Barcode scan allowlist | FRD-02 | TASK-06 SKU barcode scan | html5-qrcode lazy /scan, OCR tetap Must NOT |

---

## Referensi

- [CONTEXT.md](../CONTEXT.md) , Glosarium SKU, Batch, Kategori, Expiry, UrgencyScore, Tebus Murah, guardrail HPP*0.85.
- [ADR-001 local-first Dexie](./adr/0001-local-first-dexie-backup-drive.md) , Vite React Dexie pure local, Repository reversible, backup Drive.
- [ADR-002 hybrid advisor](./adr/0002-langchain-gemini-hybrid-advisor.md) , Hybrid rule plus LLM, cache Dexie, AdvisorPort.
- [ADR-003 Telegram + barcode scan](./adr/0003-telegram-notif.md) , Telegram direct-HTTPS tanpa backend, token PBKDF2+AES-GCM, queue retry 3x dedup, html5-qrcode lazy /scan, OCR tetap Must NOT.
- [FRD 6 feature](../frd.md) , FRD-01 PWA Shell, FRD-02 Inventaris, FRD-03 Expiry Engine, FRD-04 Advisor Tebus Murah, FRD-05 Dashboard, FRD-06 Backup.
- [Design UMKM 3-tap](../design.md) , User journey, wireframe low-fi, token 48px 16px, aksesibilitas AA.
- [Architecture scalable pragmatis](../architecture.md) , C4 context container, Repository, sync-ready org_id, tradeoff table, security PBKDF2 AES-GCM, failure modes.
- [Draft ai-inventory-expiry-advisor](../.omo/drafts/ai-inventory-expiry-advisor.md) , Topology C1-C6, grill Q1-Q15 locked (Q14 Q15 amandemen 2026-09-03).
- [Plan ai-inventory-expiry-advisor](../.omo/plans/ai-inventory-expiry-advisor.md) , 24 todos Wave 0-4, dependency matrix, verification strategy.

---

*Akhir decisions. Semua ADR plus Q1-Q15 terkunci Accepted 2026-09-03 (Q14 Q15 amandemen ADR-003). Kalau mau ubah satu keputusan, tulis ADR baru, jangan ubah log ini.*
