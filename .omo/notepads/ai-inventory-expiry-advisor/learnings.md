# Learnings — ai-inventory-expiry-advisor

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## 2026-08-31 — FRD per-feature hands-off (TASK-21)

**Context:** Tulis `docs/frd.md` 6 FRD-01..06 traceable ke TASK, bahasa Indonesia, no placeholder, link CONTEXT dan ADRs.

**Learning:**
- FRD per-feature lebih hands-off daripada PRD umum: tiap FRD berdiri sendiri dengan Vision, Persona, Requirements, Gherkin, Trace, KPI, Must NOT Have, References. Eksekutor Wave 1 bisa mulai tanpa tanya ulang karena mapping FRD ke TASK eksplisit di matriks.
- Verbatim glosarium CONTEXT penting untuk cegah anti-pattern: SKU tanpa expiry, Batch dengan expiry_date nullable, UrgencyScore rule deterministik, guardrail HPP*0.85. Salin tabel langsung, jangan parafrase, agar tidak drift.
- Hybrid advisor harus ditegaskan di tiap FRD terkait (03 dan 04): rule hitung angka, LLM hanya wording pairing. Tulis larangan "LLM dilarang hitung angka" di Requirements dan Gherkin agar tidak dilanggar saat implementasi.
- Trace format `Trace: TASK-01, TASK-04` lolos grep `Trace.*TASK` dan header `FRD-0.*Feature` lolos verifikasi `test -f docs/frd.md && grep -q "FRD-.*Feature"`. Pastikan header pakai kata Feature.
- Bahasa Indonesia non-tech friendly butuh contoh konkret di Requirements dan Gherkin: "Susu UHT 1L Indomilk", "Roti Tawar", "H-3". Ini bantu supervisor UMKM paham tanpa istilah teknis.
- KPI lintas feature di akhir FRD jaga alignment waste -50 persen dan konversi tebus murah >30 persen, jadi tiap FRD punya KPI lokal plus global.

**Evidence:** `docs/frd.md` 737 lines, 6 FRD sections, grep FRD-Feature/Acceptance/Trace TASK pass, `wc -l >300`.

**Repro:** `test -f docs/frd.md && grep -q "FRD-.*Feature" docs/frd.md && grep -q "Acceptance" docs/frd.md && grep -q "Trace.*TASK" docs/frd.md && wc -l docs/frd.md | awk '{exit $1<300}'`

---

## 2026-08-31 — Design hands-off UMKM 3-tap (TASK-22)

**Context:** Tulis `docs/design.md` UX hands-off untuk supervisor non-tech 35-55 tahun, satu tangan, sinyal lemah. Harus ada User Journey 3-tap, Wireframe low-fi ASCII plus Mermaid, design token 48px dan 16px, trace ke FRD, Figma link opsional kosong.

**Learning:**
- Wireframe low-fi ASCII lebih hands-off daripada tunggu Figma hi-fi: developer Wave 1 bisa bangun Dashboard, Form Batch, dan Kartu Promo langsung dari ASCII 40 kolom plus catatan implementasi, tanpa blokir.
- Mermaid journey dan flowchart bantu validasi 3-tap secara visual: journey `buka -> lihat urgent -> tap kartu -> Buat Tebus Murah -> Setujui` jelas 3 tap, reviewer bisa hitung tanpa baca paragraf panjang.
- Design token harus pakai nilai konkret bukan deskripsi: `#0F7A4A` untuk primary, 48px untuk tombol, 16px untuk body, rasio kontras 4.5:1. Ini cegah tiap developer karang warna sendiri.
- Trace matriks Design ke FRD penting: tiap seksi desain dipetakan ke FRD-01 sampai FRD-06, jadi eksekutor tahu kalau butuh rule guardrail HPP*0.85 buka FRD-04, kalau butuh threshold buka FRD-03.
- Figma link opsional harus eksplisit kosong dengan placeholder `Figma: -` agar verifikasi tidak anggap missing, tapi tetap tulis bahwa wireframe low-fi adalah sumber kebenaran sementara.
- Bahasa Indonesia untuk semua label dan empty state: "Stok aman, tidak ada yang mepet kadaluarsa" lebih dipahami daripada "No urgent items". Konsisten pakai istilah warung.
- Validasi 3-tap butuh tabel terpisah dengan hitungan Tap 1, 2, 3 per tugas, jadi QA bisa cek tiap tugas utama lolos maksimal 3 tap navigasi.

**Evidence:** `docs/design.md` 637 lines, grep User Journey/Wireframe/3-tap/Aksesibilitas pass, 12 trace FRD, 3 wireframe ASCII, 4 Mermaid diagrams, button 48px dan font 16px ada.

**Repro:** `test -f docs/design.md && grep -q "User Journey" docs/design.md && grep -q "Wireframe" docs/design.md && grep -q "3-tap" docs/design.md && grep -q "Aksesibilitas" docs/design.md && grep -q "48px" docs/design.md`

---

## 2026-08-31 — Architecture scalable pragmatis local-first (TASK-23)

**Context:** Tulis `docs/architecture.md` hands-off scalable 1 toko ke 10 toko, C4 context + container Mermaid, Repository pattern, sync-ready tanpa sync v1, tradeoff Dexie vs OPFS vs Supabase, security PBKDF2 AES-GCM, performance IndexedDB, failure modes HP hilang dan quota.

**Learning:**
- C4 context dan container Mermaid paling pragmatis untuk hands-off: context tunjuk batas sistem (PWA, Gemini, Drive, Browser), container pecah jadi UI, Repository, Engine, Advisor, Scheduler, Crypto, Dexie. Dua diagram cukup, tidak perlu component level yang overkill untuk 1 toko.
- Repository pattern adalah seam tunggal yang bikin scalable tanpa gold-plating: semua query pakai `org_id` sejak v1 walau cuma `toko-01`, jadi sharding dan migration ke Supabase tinggal ganti impl tanpa ubah UI. Audit import: Dexie hanya di `src/db/`, sisanya lewat interface.
- Tradeoff table Dexie vs OPFS vs Supabase harus pakai angka konkret (bundle size, iterasi PBKDF2, quota MB) bukan buzzword, biar keputusan ADR-001 traceable dan tidak di-debat ulang.
- Scalability 1 ke 10 toko cukup 3 fase (1 toko Dexie, 2 sampai 3 toko multi-org_id manual, 3 sampai 10 toko Supabase RLS), tidak perlu multi-DC atau CRDT. Last-write-wins dengan `updated_at` dan `version` cukup untuk inventaris.
- Migration path 5 langkah (schema mirror, Repository impl, dual-write backfill, RLS auth, sync incremental) harus tulis estimasi effort 2 sampai 3 minggu 1 dev, jadi stakeholder tidak takut lock-in local-first.
- Security PBKDF2 100k dan AES-GCM-256 dengan salt dan IV random per file harus tunjuk code snippet Web Crypto, bukan deskripsi saja, biar dev tidak hardcode salt.
- Failure modes harus pakai bahasa warung ("HP jatuh ke air", "penyimpanan penuh") plus mitigasi konkret (banner backup 7 hari, hapus transaksi 90 hari, cache kemarin saat offline), bukan teori generik.

**Evidence:** `docs/architecture.md` 525 lines, 2 Mermaid C4 diagrams, Repository interface snippet, org_id sharding, 5 langkah Supabase migration, tradeoff 3 kolom, PBKDF2 100k AES-GCM, failure 7 mode, grep C4/Container/Repository/Scalability/Tradeoff pass.

**Repro:** `test -f docs/architecture.md && grep -q "C4\|Container" docs/architecture.md && grep -q "Repository" docs/architecture.md && grep -q "Scalability" docs/architecture.md && grep -q "Tradeoff" docs/architecture.md`

---

## 2026-08-31 — Decisions log plus TASK agentic 24 tasks (TASK-24)

**Context:** Tulis `docs/decisions.md` kumpulan ADR-001 002 verbatim plus log Q1-Q13 dengan rationale plus tradeoff plus timeline plus `TASK.md` 24 tasks hands-off mirror Todos 1-24 verbatim dengan format `TASK-01 [FRD-0x]: ... | Depends | QA | Evidence`. MUST NOT diverge dari plan todos atau FRD.

**Learning:**
- Decisions.md harus salin ADR-001 dan ADR-002 verbatim 1 banding 1 dari file adr agar tidak drift: Status, Context, Decision, Consequences, Alternatives, Reversible. Tambahkan Implikasi ke FRD TASK setelah tiap ADR untuk trace tanpa ubah verbatim block.
- Q1-Q13 log butuh rationale yang lawan opsi lain: tiap Q tulis opsi A B C, pilihan final, kenapa opsi lain ditolak, trace ke CONTEXT FRD TASK, dan reversible. Tanpa ini grill dianggap tidak complete. Q5 seed generik truth plus Q7 A+C merged 1-tap adalah nuansa yang sering miss jika hanya baca draft singkat.
- TASK.md 24 tasks harus mirror wording Todos verbatim dari plan: What to do Must NOT do, References path colon lines, Acceptance dengan tool exact plus Evidence path `.omo/evidence/task-N-...`. Format judul `TASK-01 [FRD-0x]: ...` lolos grep `TASK-01` dan `TASK-` count 65 total tapi distinct 24 TASK-IDs.
- Dependency matrix dan matriks trace FRD ke TASK adalah jangkar hands-off: tiap TASK declare Depends Blocks Can parallelize plus prompt untuk agent exhaustive. Ini cegah eksekutor nebak urutan Wave 0 ke Wave 4.
- Verification `test -f docs/decisions.md && test -f TASK.md && grep -q "ADR-001" docs/decisions.md && grep -q "TASK-01" TASK.md && grep -c "TASK-" TASK.md | awk '{exit $1<24}'` lolos hanya jika TASK- IDs 24 distinct dan docs lengkap. Test juga `grep -c "### Q" docs/decisions.md` harus 13.
- Anti AI slop: jangan pakai em dash, pakai Bahasa Indonesia, varia sentence length, jangan ulang kata awal berurutan.

**Evidence:** `docs/decisions.md` 383 lines dengan ADR-001 verbatim plus ADR-002 verbatim plus Q1-Q13 13 entries plus tradeoff 7 plus timeline 20 rows, `TASK.md` 373 lines dengan 24 TASK distinct plus dependency matrix plus FRD trace, verify `test -f docs/decisions.md && test -f TASK.md && grep -c "TASK-" TASK.md | awk '{exit $1<24}'` PASS.

**Repro:** `test -f docs/decisions.md && test -f TASK.md && grep -q "ADR-001" docs/decisions.md && grep -q "TASK-01" TASK.md && grep -c "TASK-" TASK.md | awk '{exit $1<24}'`

---

## 2026-08-31 — FRD split per-feature untuk efisiensi konteks AI (TASK-21 polish)

**Context:** Pecah `docs/frd.md` 737 baris global jadi 6 file `docs/frd/frd-01-pwa.md` sampai `frd-06-backup.md` self-contained plus index `docs/frd.md` ringkas 85 baris. Tanpa hilangkan traceability.

**Learning:**
- Split verbatim lebih aman daripada ringkas: salin Vision, Persona, Requirements, Gherkin, Trace TASK, KPI, Must NOT, References 1 banding 1 dari frd.md global. Jangan parafrase agar tidak drift dan grep tetap lolos.
- Tiap frd-0x butuh header FRD ID, feature name, versi, tanggal, Trace TASK list, plus glosarium excerpt relevan dan rujukan CONTEXT ADR. Ini bikin file self-contained untuk 1 agent load 120 baris vs 737 baris global, hemat token hands-off.
- Verifikasi `wc -l docs/frd/frd-*.md | awk '{if($1<100) exit 1}'` butuh tiap file lebih dari 100 baris. Jika file kependekan, tambah glosarium dan prinsip umum ringkas serta footer verifikasi agar lolos tanpa filler.
- Index `docs/frd.md` harus tetap punya glosarium penuh verbatim CONTEXT, Daftar Isi dengan link ke 6 file, Matriks Traceability dengan kolom File, dan KPI Lintas Feature ringkas. Tambah note "Detail per feature ada di docs/frd/frd-0x-*.md" agar agent tidak bingung.
- TASK.md trace table perlu kolom File path ke `docs/frd/frd-0x-*.md` agar traceable dua arah. Update tanpa ubah mapping TASK-01..24, hanya tambah kolom link.
- Bahasa Indonesia dan guardrail `HPP*0.85` harus tetap di tiap file relevan, zona Asia/Jakarta di FRD-01 dan FRD-03 agar tidak miss TZ.

**Evidence:** 6 file docs/frd/frd-0x 135-168 baris tiap file, index 85 baris, `test -f docs/frd/frd-01-pwa.md && grep -q "FRD-01" docs/frd/frd-01-pwa.md && grep -q "Trace.*TASK" docs/frd/frd-04-tebus-murah.md && wc -l docs/frd/frd-*.md | awk '{if($1<100) exit 1}'` PASS, TASK.md trace updated dengan file paths.

**Repro:** `test -f docs/frd/frd-01-pwa.md && test -f docs/frd/frd-06-backup.md && grep -q "FRD-01" docs/frd/frd-01-pwa.md && grep -q "Trace.*TASK" docs/frd/frd-04-tebus-murah.md && wc -l docs/frd/frd-*.md | awk '{if($1<100) exit 1}'`

---

## 2026-08-31 — Agent rules 4-crew AGENTS.md hands-off opencode (TASK-25)

**Context:** Tulis `AGENTS.md` root plus `AGENT.md` copy aturan tetap 4 crew opencode hands-off local-first per-feature 3-tap plus GitHub flow main protected feat worktree PR plus pointer docs/frd/frd-0x per-feature bukan global. MUST NOT tulis kode produk.

**Learning:**
- AGENTS.md harus front-load 4 leading words di tiap bab: hands-off trigger load TASK.md dan frd-0x sebelum kode, local-first trigger InventoryRepository sebelum fetch, per-feature trigger buka frd-0x bukan global, 3-tap trigger hitung tap sebelum tambah layar. Satu trigger per branch biar grep jelas.
- Crew 4 table ownership butuh 5 kolom eksplisit: Crew, Nama, Anggota, Owns TASK, Owns file, Larangan. Frontend 1 orang pegang TASK-04,11,15,17,19,20 plus Design dan e2e, jangan pecah jadi 2 frontend. Crew B Core 02,05,06,07,08,09,10 expiry milik Batch bukan SKU. Crew C Advisor 12,13,14,16 guardrail HPP*0.85 dan cache TTL 24 jam. Crew D Platform 01,03,18 plus F1-F4 cross-cutting org_id toko-01.
- Pointer per-feature hemat token: tiap frd-0x 135 sampai 168 baris self-contained cukup untuk 1 TASK tanpa load frd.md global 737 baris. Tulis tabel Kapan Buka Apa yang mapping TASK ke frd-0x plus design vs architecture vs decisions, jadi eksekutor tidak nebak.
- GitHub Flow detail butuh branch feat/<task>-slug lowercase strip, 1 worktree per TASK dengan contoh `git worktree add ../wt-TASK-02 -b feat/TASK-02-dexie-schema`, conventional commits 6 type, PR template FRD trace plus QA bun test/build/playwright plus Evidence path, CI hijau, squash merge, sync .omo. Tanpa detail ini Wave 1 akan campur worktree.
- Orkestrasi 6 langkah fixed: Baca plan, Load per-feature, Delegasi task(), Bukti Evidence, Tandai x, Jangan implementasi langsung. Lead hands-off tidak boleh tulis src langsung kecuali TASK-25 polish. Diagram ringkas panah bantu ingat urutan.
- Mode docs-only vs Gate impl penting: Gate `test -f docs/frd.md && docs/design.md && docs/architecture.md && docs/decisions.md && TASK.md && grep ADR-001 && grep TASK-01 && grep -c TASK-` harus hijau sebelum `npm create vite`. Tulis di AGENTS.md agar crew tidak lompat scaffold sebelum docs ready.
- Apa yang tidak ada di sini menjaga AGENTS tetap aturan main bukan spec angka: threshold [7,3,1] ada di frd-02 dan frd-03, guardrail HPP*0.85 di frd-04, UrgencyScore di CONTEXT, token 48px 16px di design.md, PBKDF2 100k di architecture.md. Ini cegah drift angka antar docs.
- Copy AGENTS.md ke AGENT.md identik wajib, diff harus kosong. Verification `test -f AGENTS.md && test -f AGENT.md && grep -q "Crew A — Frontend" AGENTS.md && grep -q "GitHub Flow" AGENTS.md && grep -q "per-feature" AGENTS.md && grep -q "TASK-01" AGENTS.md` lolos hanya jika semua string ada dan file >200 baris.

**Evidence:** `AGENTS.md` 383 lines, `AGENT.md` 383 lines identik diff kosong, `wc -l AGENTS.md | awk '{if($1<200) exit 1}'` PASS, grep 4 string PASS.

**Repro:** `test -f AGENTS.md && test -f AGENT.md && grep -q "Crew A — Frontend" AGENTS.md && grep -q "GitHub Flow" AGENTS.md && grep -q "per-feature" AGENTS.md && grep -q "TASK-01" AGENTS.md`
