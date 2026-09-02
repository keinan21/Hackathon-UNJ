# AGENTS.md — Aturan Tetap 4 Crew Opencode

> Hands-off, local-first, per-feature, 3-tap. Satu aturan untuk 4 crew, 1 worktree per TASK, 1 reviewer per PR.

- **Versi:** 1.0
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu:** Asia/Jakarta (WIB)
- **Repo:** Inventaris AI Tebus Murah
- **Stack v1:** Vite + React + TypeScript + Dexie + vite-plugin-pwa + LangChain + Gemini 2.5 Flash
- **Mode default:** docs-only sampai Gate Wave 0 hijau, baru impl Wave 1 ke atas

---

## Daftar Isi

1. [Pointer: Kapan Buka Apa](#1-pointer-kapan-buka-apa)
2. [Prinsip 4 Kata Kunci](#2-prinsip-4-kata-kunci)
3. [Mode: Docs-Only vs Impl Gate](#3-mode-docs-only-vs-impl-gate)
4. [Crew 4 Table Ownership](#4-crew-4-table-ownership)
5. [Orkestrasi 6 Langkah](#5-orkestrasi-6-langkah)
6. [GitHub Flow](#6-github-flow)
7. [Guardrails Must dan Must NOT](#7-guardrails-must-dan-must-not)
8. [Perintah Cepat](#8-perintah-cepat)
9. [Apa Yang Tidak Ada Di Sini](#9-apa-yang-tidak-ada-di-sini)
10. [Referensi](#10-referensi)

---

## 1. Pointer: Kapan Buka Apa

> Jangan buka semua docs sekaligus. Buka satu file per-feature sesuai TASK yang kamu kerjakan.

| Kamu kerjakan | Buka ini dulu | Jangan buka dulu |
|---|---|---|
| **TASK-01** scaffold Vite PWA | `docs/frd/frd-01-pwa.md` + `docs/architecture.md` bab 1-3 | FRD-02 sampai FRD-06 |
| **TASK-02,05,06,07,08** inventaris SKU Batch Kategori | `docs/frd/frd-02-inventaris.md` + `CONTEXT.md` glosarium SKU Batch | `docs/frd/frd-04-tebus-murah.md` |
| **TASK-09,10,11** expiry engine dan notifikasi | `docs/frd/frd-03-expiry.md` + `CONTEXT.md` Days to Expiry dan UrgencyScore | `docs/frd/frd-04-tebus-murah.md` |
| **TASK-12,13,14,15,16** advisor dan tebus murah | `docs/frd/frd-04-tebus-murah.md` + `docs/adr/0002-langchain-gemini-hybrid-advisor.md` | `docs/frd/frd-06-backup.md` |
| **TASK-04,11,15,17,19,20** UI dashboard settings E2E | `docs/frd/frd-05-dashboard.md` + `docs/design.md` wireframe dan token 48px 16px | `docs/architecture.md` detail tradeoff |
| **TASK-03,18** PIN auth backup restore | `docs/frd/frd-06-backup.md` + `docs/adr/0001-local-first-dexie-backup-drive.md` | `docs/frd/frd-03-expiry.md` |
| **Butuh warna, tombol, journey, 3-tap** | `docs/design.md` bab Prinsip, Token, Journey, Wireframe | `docs/architecture.md` |
| **Butuh C4, Repository, org_id, tradeoff, security** | `docs/architecture.md` | `docs/design.md` |
| **Butuh alasan keputusan Q1-Q13, ADR verbatim** | `docs/decisions.md` | `docs/frd/frd-0x-*.md` detail |
| **Butuh breakdown 24 tasks, depends, QA, evidence** | `TASK.md` | `docs/frd.md` index global |
| **Butuh glosarium SKU vs Batch vs UrgencyScore** | `CONTEXT.md` | Jangan karang definisi sendiri |

Aturan pointer:

- **per-feature dulu, global belakangan.** Tiap `docs/frd/frd-0x-*.md` self-contained 135 sampai 168 baris. Cukup untuk 1 TASK tanpa buka `docs/frd.md` global 737 baris.
- **Index `docs/frd.md` hanya untuk navigasi.** Buka jika mau lihat matriks trace 6 FRD ke 24 TASK, bukan untuk baca requirements lengkap.
- **design vs architecture jangan campur.** UI tanya `docs/design.md`, struktur data dan Dexie tanya `docs/architecture.md`.
- **decisions untuk rationale.** Jika ragu kenapa local-first atau kenapa HPP kali 0.85, buka `docs/decisions.md` Q1-Q13, bukan tanya ulang.
- **TASK.md adalah sumber kebenaran eksekusi.** Tiap TASK punya References baris 1 sampai 65 yang eksplisit, ikuti itu.

---

## 2. Prinsip 4 Kata Kunci

Empat kata ini jadi leading word tiap keputusan. Hafal urutannya.

### hands-off — Jangan tanya ulang, baca docs lalu jalan

- **Trigger tiap branch:** sebelum tulis kode, cek apakah `TASK.md` dan `docs/frd/frd-0x-*.md` sudah di-load. Jika belum, load dulu.
- Artinya eksekutor tidak perlu interview. Semua ada di `TASK.md` prompt untuk agent, References, Acceptance, QA, Evidence, Commit.
- Jika docs lengkap, langsung delegasi. Jangan panggil manusia untuk klarifikasi yang sudah ada di FRD.

### local-first — Dexie dulu, cloud nanti

- **Trigger tiap branch:** sebelum pakai fetch atau API eksternal, tanya apakah bisa selesai dengan Dexie via `InventoryRepository`.
- Data di IndexedDB via Dexie, `org_id` default `toko-01` sejak v1 untuk sharding siap 1 ke 10 toko.
- Tidak ada backend wajib v1. Tidak ada Supabase, Firebase, OCR, QR di Wave 0 sampai Wave 4.
- Angka dari DB, bukan dari LLM. LLM hanya wording dan pairing.

### per-feature — Satu TASK satu FRD, jangan global

- **Trigger tiap branch:** sebelum buka `docs/frd.md` global, buka `docs/frd/frd-0x-*.md` yang trace ke TASK kamu.
- Tiap FRD self-contained: Vision, Persona, Requirements, Gherkin, Trace TASK, KPI, Must NOT, References.
- Contoh: kerjakan TASK-09 expiry engine, buka `docs/frd/frd-03-expiry.md` saja. Jangan load FRD-04 atau FRD-06.
- Hemat token, hemat waktu, cegah drift definisi antar feature.

### 3-tap — Maksimal 3 tap untuk tugas utama

- **Trigger tiap branch:** sebelum tambah layar atau tombol baru, hitung tap dari buka sampai selesai. Jika lebih dari 3, sederhanakan.
- Flow inti: buka, lihat urgent, tap approve. Tidak lebih dari 3 tap navigasi.
- Token: tombol min 48px, font min 16px, bahasa Indonesia, kontras AA.
- Validasi ada di `docs/design.md` bab Validasi 3-tap. Ikuti itu untuk semua UI.

---

## 3. Mode: Docs-Only vs Impl Gate

### Mode docs-only (sekarang, Wave 0)

- Yang boleh diubah: `docs/**`, `TASK.md`, `CONTEXT.md`, `.omo/**`, `AGENTS.md`, `AGENT.md`.
- Yang tidak boleh diubah: `src/**`, `package.json`, `vite.config.ts`, `public/**`.
- Tujuan: polish docs sampai Gate hijau, tanpa tulis kode produk.
- Aturan: tulis AGENTS.md ini, copy ke AGENT.md, append learnings. Selesai. Jangan sentuh src.

### Gate Impl (syarat masuk Wave 1)

Gate harus hijau sebelum TASK-01 scaffold boleh jalan:

```bash
test -f docs/frd.md && test -f docs/design.md && test -f docs/architecture.md && test -f docs/decisions.md && test -f TASK.md \
&& grep -q "ADR-001" docs/decisions.md && grep -q "TASK-01" TASK.md && grep -c "TASK-" TASK.md | awk '{exit $1<24}' \
&& test -f docs/frd/frd-01-pwa.md && test -f docs/frd/frd-06-backup.md && wc -l docs/frd/frd-*.md | awk '{if($1<100) exit 1}' \
&& test -f AGENTS.md && test -f AGENT.md && grep -q "Crew A — Frontend" AGENTS.md && grep -q "GitHub Flow" AGENTS.md
```

- Jika Gate gagal, jangan jalan `npm create vite` atau `bun install`. Perbaiki docs dulu.
- Setelah Gate hijau, Wave 1 baru boleh init scaffold, lalu Wave 2 Core, Wave 3 Advisor, Wave 4 Polish sesuai `TASK.md` dependency matrix.

---

## 4. Crew 4 Table Ownership

> 4 orang tetap, tidak tambah orang tanpa ubah AGENTS.md ini. Tiap crew punya Owns TASK, Owns file, dan Larangan yang tidak boleh dilanggar.

| Crew | Nama | Anggota | Owns TASK | Owns file dan folder | Larangan |
|---|---|---|---|---|---|
| **Crew A — Frontend** | Frontend | 1 orang | TASK-04, TASK-11, TASK-15, TASK-17, TASK-19, TASK-20 + Design | `src/features/dashboard/**`, `src/features/promo/**`, `src/features/settings/**`, `src/components/**`, `e2e/**`, `docs/design.md`, `public/icons/**`, `vite.config.ts` PWA manifest | Dilarang ubah `src/db/**`, `src/engine/**`, `src/advisor/**` tanpa pair dengan Crew B atau C. Dilarang hitung UrgencyScore atau harga_tebus di komponen, angka harus dari DB atau engine. |
| **Crew B — Core** | Core Inventaris dan Engine | 1 orang | TASK-02, TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10 | `src/db/**`, `src/engine/**`, `src/features/sku/**`, `src/features/batch/**`, `src/sw/notif.ts`, `TASK.md` inventaris | Dilarang simpan expiry di SKU. Dilarang biarkan LLM hitung days_to_expiry atau urgencyScore. Dilarang hardcode threshold non-editable, harus via `seed.ts` editable. |
| **Crew C — Advisor** | Advisor Tebus Murah | 1 orang | TASK-12, TASK-13, TASK-14, TASK-16 | `src/advisor/**`, `src/features/promo/**` logic pairing dan guardrail, `src/lib/validation.ts` | Dilarang biarkan LLM ngarang angka harga atau HPP. Dilarang lewati guardrail `harga_tebus >= HPP * 0.85`. Dilarang auto-activate promo, harus proposed dulu. |
| **Crew D — Platform** | Platform PWA dan Security | 1 orang | TASK-01, TASK-03, TASK-18 + F1 sampai F4 cross-cutting | `src/features/auth/**`, `src/features/backup/**`, `src/lib/crypto.ts`, `vite.config.ts` scaffold, `package.json` deps, `public/**`, `docs/architecture.md`, `docs/decisions.md` | Dilarang tambah backend server, Supabase, OCR, QR, WA send v1. Dilarang simpan PIN atau API key plain text. Dilarang multi-role, hanya single Supervisor. |

Catatan pembagian:

- **Frontend 1 orang itu Crew A.** Jangan pecah jadi 2 orang frontend. Jika butuh bantuan UI, minta review ke Crew A, bukan ambil alih file `src/components/**`.
- **Crew B pegang expiry milik Batch.** Ingat CONTEXT: expiry ada di Batch, bukan di SKU. Batch dengan `expiry_date = null` adalah non-perishable dan tidak masuk engine notifikasi.
- **Crew C pegang angka dari DB.** Advisor hanya pairing dan wording. Harga dari `hpp_snapshot` Batch dan `harga_normal` SKU, bukan dari output LLM. Cache di `advisorCache` Dexie TTL 24 jam.
- **Crew D pegang org_id.** Sejak v1 semua tabel Dexie punya `org_id` default `toko-01` indexed, comment `sync-ready sharding`. Jangan tambah cloud sync logic v1, cukup siapkan kolom.

Matriks trace FRD ke Crew:

| FRD | Feature | Crew utama | Crew pendukung |
|---|---|---|---|
| FRD-01 | F1 PWA Shell Offline | D Platform + A Frontend | B Core untuk Dexie shell |
| FRD-02 | F2 Inventaris SKU Batch Kategori | B Core | A Frontend untuk CRUD UI |
| FRD-03 | F3 Expiry Engine Notifikasi | B Core | A Frontend untuk badge urgent |
| FRD-04 | F4 Advisor Hybrid Tebus Murah | C Advisor | A Frontend untuk approve 1-tap |
| FRD-05 | F5 Dashboard Badge Histori | A Frontend | B Core untuk data, C Advisor untuk histori |
| FRD-06 | F6 Backup Restore | D Platform | B Core untuk export tabel |

---

## 4b. Wave 5 Polish — Biar Jadi (Real Data, Anti-Dummy)

> Teman-teman tidak pakai `.omo`, jadi pembagian polish tulis di sini dan di `docs/frd/frd-0x-*.md`, bukan di `.omo/plans`. Satu FRD = satu file polish, satu crew kerjakan tanpa tabrakan.

**Kenapa produk masih dummy:** `main` masih pakai `FakeRepository` + `?seed=many` + `src/App.tsx` mock SKU. Dexie + engine + advisor sudah ada tapi belum dicolok ke UI real. Wave 5 ini colok real data + hilangkan dummy + hijau kan CI.

| Crew | Polish TASK (1 TASK = 1 branch `feat/polish-*`) | File yang disentuh | Acceptance (cek manual) |
|---|---|---|---|
| **A — Frontend** | **A1 Real Data Switch**: ganti `UrgentList`/`PromoAktifList`/`HistoriList` dari `fake*` ke `InventoryRepository` Dexie real, hapus `seedMode` di `src/App.tsx`, empty state `Belum ada SKU → Tambah SKU`. **A2 SKU/Batch CRUD real UI**: form `src/features/sku/**` & `batch/**` 48px, bahasa Indonesia, validasi HPP. **A3 Runner fix**: `vitest.config.ts` exclude `e2e/**`, `bun test` 54 pass, `npx playwright test` 37/37 hijau. | `src/App.tsx`, `src/features/dashboard/**`, `src/features/sku/**`, `src/features/batch/**`, `src/components/**`, `e2e/**`, `vitest.config.ts` | `bun test` tanpa error Playwright, `npx playwright test` 37 pass, buka `?offline=1` tetap shell, dashboard 3 seksi real |
| **B — Core** | **B1 Dexie final**: `src/db/db.ts` `org_id=toko-01` indexed + `seed.ts [7,3,1]` editable, migrasi aman. **B2 Notif real**: `engine/notifScheduler.ts` + `sw/notif.ts` baca `daysToExpiry` Asia/Jakarta startOfDay ceil + threshold per kategori, trigger `07:00 + on open + on batch insert`. **B3 Urgency deterministik**: `expiry.ts` + `avgUsage.ts` skip `expiry_date=null`. | `src/db/**`, `src/engine/**`, `src/sw/notif.ts` | `bun test src/engine/*.test.ts` 27 pass, batch null tidak masuk badge |
| **C — Advisor** | **C1 Hybrid real**: `LangChainGeminiAdvisor.ts` prompt pakai angka DB (`hpp_snapshot`/`harga_normal`/`qty`/`days`), guardrail `harga_tebus >= HPP*0.85` before LLM, cache `advisorCache` TTL 24h `07:05 + on-demand`. **C2 Pairing real**: `pairing.ts` co-occurrence `transaksis` + fallback kategori. **C3 Guardrail**: `validation.ts` + `guardrail.test.ts` 4 case. | `src/advisor/**`, `src/lib/validation.ts` | `bun test src/advisor/*.test.ts` pass, harga ngarang ditolak |
| **D — Platform** | **D1 Gate Polish**: update `docs/frd/frd-0x-*.md` pasal Polish + `AGENTS.md` ini, `bun run build` `dist/manifest.webmanifest`+`sw.js` ada, sync `docs/**` ke git. **D2 CI hijau**: push `main`, hapus branch `feat/polish-*`, `grep -r supabase|firebase|ocr|qrcode src` 0. | `docs/**`, `vite.config.ts`, `src/features/auth/**`, `src/features/backup/**`, `src/lib/crypto.ts`, `package.json` | `test -f docs/frd/frd-01-pwa.md && grep -q "Wave 5 Polish" docs/frd/frd-*.md` PASS, `bun run build` 0 |

**Cara kerja tanpa `.omo`:** tiap crew baca `docs/frd/frd-0x-*.md` bab **Polish Wave 5** di FRD-nya, buat branch `feat/polish-<frd>-<crew>`, PR 1 reviewer, CI hijau, squash merge. Tidak perlu buka `.omo/plans`.

---

## 5. Orkestrasi 6 Langkah

> Urutan tetap untuk tiap TASK. Jangan lompat, jangan implementasi langsung tanpa delegasi jika kamu adalah lead 4-crew.

### Langkah 1 — Baca plan

- Buka `.omo/plans/ai-inventory-expiry-advisor.md` dan `TASK.md` untuk TASK yang mau dikerjakan.
- Cek Wave, Depends, Blocks, Can parallelize with. Pastikan depends sudah x (done).
- Contoh: TASK-09 depends 7 dan 8, jadi pastikan TASK-07 dan TASK-08 sudah hijau.

### Langkah 2 — Load per-feature

- Buka `docs/frd/frd-0x-*.md` yang trace ke TASK kamu, bukan global.
- Jika TASK butuh UI, tambah `docs/design.md`. Jika butuh struktur data, tambah `docs/architecture.md`. Jika butuh rationale, tambah `docs/decisions.md`.
- Jangan buka semua FRD sekaligus. Hemat konteks, per-feature saja.

### Langkah 3 — Delegasi task()

- Jika kamu lead 4-crew, delegasi via `task()` ke crew yang Owns TASK tersebut.
- Satu TASK satu worktree, satu crew. Jangan kerjakan 2 TASK di 1 worktree.
- Crew yang menerima harus baca Acceptance dan QA scenarios di `TASK.md` sebelum tulis kode.

### Langkah 4 — Bukti Evidence

- Tiap TASK punya Evidence path di `TASK.md`, contoh `.omo/evidence/task-9-ai-inventory-expiry-advisor.json`.
- Setelah kode jadi, jalankan QA scenarios pakai tool exact yang tertulis: `bun test`, `npx playwright test`, `bun run build`.
- Simpan output ke Evidence path. Tanpa evidence, TASK dianggap belum selesai.

### Langkah 5 — Tandai x

- Jika Acceptance plus QA hijau dan Evidence ada file, tandai x di `.omo/plans/ai-inventory-expiry-advisor.md` Todos dan di `TASK.md` checklist.
- Commit pakai conventional commits, lihat bab GitHub Flow.
- Sync `.omo` agar plan dan evidence ikut ter-commit.

### Langkah 6 — Jangan implementasi langsung

- Lead 4-crew tidak boleh tulis `src/**` langsung tanpa delegasi, kecuali TASK-25 docs polish ini.
- Jika kamu adalah crew yang di-delegasi, kamu yang tulis kode, bukan lead.
- Jika ragu ownership, cek tabel Crew 4 di atas. Jangan ambil file crew lain tanpa pair.

Diagram ringkas:

```
Baca plan (TASK.md + plan) -> Load per-feature (frd-0x) -> Delegasi task() ke crew
  -> Bukti Evidence (bun test / playwright) -> Tandai x di plan -> Jangan impl langsung (lead hands-off)
```

---

## 6. GitHub Flow

> main protected, feat per TASK, 1 worktree per TASK, 1 reviewer, CI hijau, squash merge, sync .omo.

### Branch dan worktree

- **Main protected.** Tidak boleh push langsung ke `main`. Semua via PR.
- **Branch per TASK:** `feat/<task>-slug` contoh `feat/TASK-02-dexie-schema`, `feat/TASK-04-pwa-shell`, `feat/TASK-13-gemini-advisor`.
- **Slug pakai huruf kecil dan strip.** Jangan pakai spasi atau camelCase.
- **1 worktree per TASK.** Buat worktree terpisah untuk tiap TASK agar tidak campur:

```bash
git worktree add ../wt-TASK-02 -b feat/TASK-02-dexie-schema
git worktree add ../wt-TASK-04 -b feat/TASK-04-pwa-shell
```

- Jangan kerjakan 2 TASK di worktree yang sama. Satu TASK selesai dan merge, baru hapus worktree.

### Conventional commits

Format: `type(scope): subject`

| Type | Pakai kapan | Contoh |
|---|---|---|
| `feat` | Fitur baru | `feat(db): Dexie schema + InventoryRepository` |
| `fix` | Perbaikan bug | `fix(engine): daysToExpiry pakai Asia/Jakarta` |
| `docs` | Docs saja | `docs(frd): FRD per feature` |
| `test` | Test saja | `test(guardrail): tebus murah bounds` |
| `chore` | Scaffold, deps, config | `chore(scaffold): init Vite React Dexie PWA` |
| `refactor` | Rapi tanpa ubah behavior | `refactor(repo): extract InventoryRepository` |

- Commit message tiap TASK sudah ada di `TASK.md` baris Commit, ikuti itu.
- Jangan pakai commit kosong atau `wip` tanpa scope.

### PR template

Tiap PR harus isi:

```markdown
## FRD Trace
FRD-0x: [link ke docs/frd/frd-0x-*.md]
TASK: TASK-yy

## Apa yang diubah
- ...

## QA
- [ ] `bun test` hijau
- [ ] `bun run build` exit 0
- [ ] `npx playwright test e2e/...` hijau (jika TASK ada e2e)

## Evidence
- Path: `.omo/evidence/task-yy-....json/png/log`
- File ada dan bisa dibuka

## Checklist Crew
- [ ] Owns file sesuai tabel Crew 4
- [ ] Tidak langgar Larangan crew
- [ ] Bahasa Indonesia untuk label UI (jika Frontend)
```

- **1 reviewer wajib.** Tidak boleh merge tanpa approve 1 orang crew lain.
- Reviewer cek: FRD trace benar, QA hijau, Evidence ada, Larangan tidak dilanggar.

### CI

CI harus hijau sebelum merge:

- `bun run build` — exit 0, hasilkan `dist/manifest.webmanifest` dan `dist/sw.js` untuk FRD-01.
- `bun test` — semua unit test hijau, termasuk guardrail `HPP*0.85`.
- `npx playwright test` — untuk TASK dengan e2e (TASK-04,11,15,17,19,20).

Jika CI merah, jangan merge. Perbaiki di branch feat, push lagi, tunggu CI hijau.

### Merge dan sync

- **Merge pakai squash.** Satu TASK satu commit di main, history rapi.
- Setelah merge, hapus branch feat dan worktree:

```bash
git worktree remove ../wt-TASK-02
git branch -d feat/TASK-02-dexie-schema
```

- **Sync .omo.** Pastikan `.omo/plans/**`, `.omo/evidence/**`, `.omo/notepads/**` ikut ter-commit di PR yang sama. Jangan biarkan evidence hanya lokal.

---

## 7. Guardrails Must dan Must NOT

### Must

- Must baca `CONTEXT.md` sebelum pakai istilah SKU, Batch, Kategori, UrgencyScore. Jangan sebut barang tanpa klarifikasi SKU vs Batch.
- Must pakai `InventoryRepository` untuk akses Dexie. Dexie hanya di `src/db/**`, sisanya lewat interface.
- Must pakai `org_id` default `toko-01` di semua tabel Dexie sejak v1, comment `sync-ready sharding`.
- Must hitung `daysToExpiry` pakai `Asia/Jakarta` startOfDay dan `ceil`, bukan UTC.
- Must hitung `urgencyScore = qty * days_to_expiry / max(avg_daily_usage, 1)` rule deterministik, bukan LLM.
- Must enforce `harga_tebus >= HPP * 0.85` sebelum LLM call, angka dari DB.
- Must tulis tombol min 48px, font min 16px, bahasa Indonesia di semua UI.
- Must cache advisor di `advisorCache` Dexie TTL 24 jam, trigger daily 07:05 plus on-demand after batch insert urgent.
- Must 1 worktree per TASK, 1 reviewer per PR, conventional commits.
- Must simpan Evidence di `.omo/evidence/task-yy-*` dan sync ke git.

### Must NOT

- Must NOT simpan expiry di SKU. Expiry milik Batch. `expiry_date = null` untuk non-perishable, skip engine.
- Must NOT biarkan LLM hitung angka harga, HPP, urgency, atau days_to_expiry. LLM hanya wording dan pairing.
- Must NOT hardcode threshold non-editable. Seed default `[7,3,1]` editable via `updateKategoriThreshold`.
- Must NOT tambah backend, Supabase, Firebase, OCR, QR, WA send, POS cart, multi-role di v1.
- Must NOT push langsung ke main. Must NOT merge tanpa CI hijau dan 1 reviewer.
- Must NOT kerjakan 2 TASK di 1 worktree.
- Must NOT tulis kode `src/**` di mode docs-only sebelum Gate hijau.
- Must NOT buat file di luar yang di-assign crew tanpa pair.
- Must NOT tambah placeholder TODO di docs. Tulis lengkap atau kosongkan dengan alasan jelas.

---

## 8. Perintah Cepat

Gate Wave 0 (wajib hijau sebelum TASK-01):

```bash
test -f AGENTS.md && test -f AGENT.md && grep -q "Crew A — Frontend" AGENTS.md && grep -q "GitHub Flow" AGENTS.md && grep -q "per-feature" AGENTS.md && grep -q "TASK-01" AGENTS.md && echo "AGENTS gate PASS" || echo "AGENTS gate FAIL"
```

Gate docs lengkap:

```bash
test -f docs/frd.md && test -f docs/design.md && test -f docs/architecture.md && test -f docs/decisions.md && test -f TASK.md && echo "docs gate PASS" || echo "docs gate FAIL"
```

Cek FRD per-feature:

```bash
wc -l docs/frd/frd-*.md && grep -q "FRD-01" docs/frd/frd-01-pwa.md && grep -q "Trace.*TASK" docs/frd/frd-04-tebus-murah.md && echo "frd per-feature PASS"
```

Cek line count AGENTS:

```bash
wc -l AGENTS.md | awk '{if($1<200) print "FAIL kurang dari 200:", $1; else print "PASS:", $1, "lines"}'
```

Cek no backend leak:

```bash
grep -r "supabase\|firebase\|ocr\|qrcode" src 2>/dev/null | wc -l | awk '{if($1>0) print "FAIL ada leak:", $1; else print "PASS no leak"}'
```

---

## 9. Apa Yang Tidak Ada Di Sini

> Angka ada di `docs/frd/frd-0x-*.md`, bukan di sini. AGENTS.md hanya aturan main, bukan spec angka.

- **Threshold angka:** `[7,3,1]` ada di `docs/frd/frd-02-inventaris.md` dan `docs/frd/frd-03-expiry.md`, bukan di sini. Editable per Kategori.
- **Guardrail angka:** `HPP * 0.85` ada di `docs/frd/frd-04-tebus-murah.md` dan `CONTEXT.md`, bukan di sini.
- **UrgencyScore rumus:** `qty * days / max(avg,1)` ada di `CONTEXT.md` dan `docs/frd/frd-03-expiry.md`, bukan di sini.
- **HPP dan harga:** validasi `hpp > 0` dan `harga_normal >= hpp` ada di `docs/frd/frd-02-inventaris.md`, bukan di sini.
- **Design token angka:** 48px, 16px, kontras AA ada di `docs/design.md`, bukan di sini.
- **Security angka:** PBKDF2 100k iter, AES-GCM-256, salt 16 byte ada di `docs/architecture.md` dan `docs/frd/frd-06-backup.md`, bukan di sini.
- **Jadwal:** daily 07:00 notifikasi dan 07:05 advisor ada di `docs/frd/frd-03-expiry.md` dan `docs/frd/frd-04-tebus-murah.md`, bukan di sini.

Jika butuh angka, buka frd-0x per-feature. Jika butuh rationale, buka `docs/decisions.md`. Jika butuh langkah, buka `TASK.md`.

---

## 10. Referensi

- `CONTEXT.md` — Glosarium SKU Batch Kategori UrgencyScore guardrail
- `docs/frd.md` — Index 6 FRD plus matriks trace ke TASK
- `docs/frd/frd-01-pwa.md` — F1 PWA Shell Offline, trace TASK-01, TASK-04
- `docs/frd/frd-02-inventaris.md` — F2 Inventaris SKU Batch Kategori, trace TASK-02,05,06,07,08
- `docs/frd/frd-03-expiry.md` — F3 Expiry Engine Notifikasi, trace TASK-08,09,10,11
- `docs/frd/frd-04-tebus-murah.md` — F4 Advisor Hybrid Tebus Murah, trace TASK-12,13,14,15,16
- `docs/frd/frd-05-dashboard.md` — F5 Dashboard Badge Histori, trace TASK-11,17,19
- `docs/frd/frd-06-backup.md` — F6 Backup Restore, trace TASK-03,18
- `docs/design.md` — UX UMKM 3-tap, journey, wireframe, token 48px 16px
- `docs/architecture.md` — C4, Repository, org_id sharding, tradeoff, security
- `docs/decisions.md` — ADR-001, ADR-002, Q1-Q13
- `TASK.md` — 24 tasks hands-off, dependency, QA, Evidence, commit
- `.omo/plans/ai-inventory-expiry-advisor.md` — Plan 24 Todos verbatim
- `docs/adr/0001-local-first-dexie-backup-drive.md` — ADR local-first
- `docs/adr/0002-langchain-gemini-hybrid-advisor.md` — ADR hybrid advisor

---

*Akhir AGENTS.md. 4 crew hands-off, Frontend 1 orang, per-feature, 3-tap, local-first. Ikuti pointer, jaga guardrail, sync .omo.*
