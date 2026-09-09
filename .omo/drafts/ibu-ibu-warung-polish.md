# ibu-ibu-warung-polish - Draft

intent: clear
review_required: false
classification: Standard
slug: ibu-ibu-warung-polish
status: plan-written
review_required: true
pending-action: dual review (momus + independent oracle) .omo/plans/ibu-ibu-warung-polish.md
answers_10: kasir=keranjang-multi; rugi=dialog-konfirmasi; preset=4; awet=checkbox; catat=FAB+header; saran-offline=aturan-lokal; backup=PIN-manual-jelas; lockout=samakan; data=backup+migrasi-aman; rollout=per-wave-berurutan
folded: todo1 fallback-lokal + todo8 backup-dulu-rollback (lockout-Settings sudah di todo18)
review_round_id: rr-ibu-01
review_launch_momus: li-momus-01
review_launch_oracle: li-oracle-01
review_round_1: momus=APPROVED (ses_f84be1c17ffeLELAbIslUyPxjy, sha 8268dd68), oracle=CHANGES_REQUESTED 6 gaps (ses_f84be1bf3ffe3ZkF5RaESjKgjq, sha sama)
fixes_applied: preset-kanonik-6ke4 + kasir-all-or-nothing + cite-dexieRepository + lockout-reuse-pinStore + seedgate-buildQA + 38strings-enumerated
review_round_id_2: rr-ibu-02
review_launch_momus_2: li-momus-02
review_launch_oracle_2: li-oracle-02
review_round_2: momus=APPROVED (ses_f84b74a78ffe7cKTcsBPbwX5aV) + oracle=APPROVED (ses_f84b74a5affeknH1azAhcCwjnz), sha 3051e9df6da5989c265a351811955c1d9a62fd5185de79fc3d444b7daa823acf (22437B/77L, both lanes identical, no plan change after)
status: executing-batch1-done-scope-change-S3
scope_change_S3: dashboard = hub navigasi 2x2 (Masuk/Kasir/SKU/Statistik) + kartu info-saja; Saran pindah /kritis; +/promo +/statistik routes; FAB dicabut
plan_rev: todos 1-3 [x]; todo5 rewritten hub; +20 SaranTebusButton/kritis; +21 promo-statistik-routes-info-mode; W2 order 20,21,5,6,7,8
review_stale_note: rr-ibu-02 approvals cover plan v1; v2 changes user-directed → fresh dual review required at handoff (F1-F4)
plan_path: .omo/plans/ibu-ibu-warung-polish.md
metis_receipt: ses_f853abe17ffee2bSuic4kMzxIY (2 critical + 3 high folded: FEFO-reuse, preset-6-nilai, FAB-tanpa-tab4, guardrail-before-create, seed-gate-DEV)
structure_check: 19 implementation rows `- [ ] N.` column-zero + 4 final rows `- [ ] Fn.` column-zero, headers template order OK, TL;DR leads

## Approval Gate
- brief_presented: 2026-09-07
- approach: 6-wave polish fixing critical dead button + guardrail + copy/tokens, crew-split per AGENTS.md, local-first Dexie tetap
- next: user explicit okay → scaffold plan + APPEND todos + fill TL;DR last, then optional high-accuracy review
- allow_scope_change: true

## Decisions
- Workflow: Prometheus planning consultant, no implementation until explicit approval; execution via separate worker ($start-work)
- Exploration: parallel read-only mapping of SKU/Inout/Promo/Scan/Settings/PWA surfaces completed
- Intent: CLEAR — outcome is making app ibu-ibu friendly fixing 12 findings from warung playtest; remaining forks are preferences/tradeoffs
- Topology lock: 6 components that can succeed/fail independently

## Topology Components
| id | outcome | status | evidence path |
|---|---|---|---|
| C1 | Tombol Saran Tebus mati → hidup: klik hasilkan promo proposed + scroll + toast + histori | pending | src/features/dashboard/UrgentList.tsx:219 dead scroll only; PromoAktifList.tsx wiring |
| C2 | Alur Masuk/Keluar & tanggal & guardrail beres: date picker, opsi tanpa kadaluarsa, cegatan harga rugi | pending | src/features/inout/InboundForm.tsx type=date, src/features/sku/SkuForm.tsx warning only, src/db/dexieRepository.ts no guard |
| C3 | Scan barcode: kamera timeout + manual fallback jelas, tidak mulet | pending | src/features/scan/ScanPage.tsx lazy html5-qrcode, sessionStorage flow |
| C4 | Katalog & Form SKU disederhanakan: istilah warung, 3 field wajib, Barcode/Tag disembunyikan | pending | src/features/sku/SkuForm.tsx + KatalogPage.tsx terminology audit 38 leaks |
| C5 | Pengaturan disembunyikan: Backup 2 tombol, Threshold 11 → Setelan Lanjut, jargon PBKDF2/AES-GCM dihapus | pending | src/features/settings/SettingsPage.tsx:294 Backup v2, threshold per kategori |
| C6 | Copy & token polish: font ≥16px, 48px konsisten, toast sukses seragam, empty jelas | pending | docs/design.md 48px/16px spec vs 26 elems <16px |

## Findings (grounded)
- Dead Saran Tebus: UrgentList L219 onViewSuggestion only scrolls; no advisor.suggestForBatch nor promoService.createSuggestedPromo call (explore 1 & 2)
- HPP > harga lolos: SkuForm warning only, dexieRepository.createSku no validateSKU (while legacy db.ts validateSKU would reject harga<hpp); Outbound Qty vs Jumlah inconsistency
- HPP ketimpa meneng-meneng via applyHargaBeli + helper "Akan timpa..." text-xs
- Scan Memuat kamera… no timeout; manual always visible but status hidden
- Auth ?seed prototype bypass in App.tsx:474 auto setLoggedIn
- Threshold 11 cards scroll dowu, Via updateKategoriThreshold leak, error Harus menurun already correct
- Backup tanpa PIN meneng ae, PIN salah ditolak correct, export .json.enc correct
- Font fails: Settings 13px labels, 12px helpers, Statistik 12px Omzet labels, ChartArus 12px legend
- All Dexie real via realRepo (toko-01 sharding), no FakeRepository in prod

## Open Forks (filtered)
- F1 terminology final mapping (owner-decision, product lives with)
- F2 guardrail rugi handling (owner-decision, safety/uang)
- F3 date picker flavor + tanpa-kadaluarsa toggle (owner-decision, flow fork)
- Test strategy (always asked)

## Scope Change (2026-09-07, user reply)
- S1 Keluar-Masuk diprioritaskan (paling sering dipencet): butuh menu/page Keluar-Masuk universal (satu pintu), halaman Masuk sendiri yang simpel, halaman Keluar sendiri ala kasir biar ibu senang
- S2 Settings Threshold: bahasa terlalu ribet; cari alternatif selain ketik angka "7,3,1" (ibu mana tau threshold itu bahasa apa)
- Adopted default S1: tambah tombol besar "Catat" (bottom-nav + header) → pilih Masuk (form 3 field: barang+jml+tanggal) atau Keluar ala kasir (cari barang → tap +/− qty per baris → total otomatis → Simpan Terjual; FEFO jalan diam-diam, Penerima/Catatan opsional tersembunyi)
- Adopted default S2: Threshold angka diganti preset visual per kategori: "Cepat basi (roti/susu): ingatkan H-7,3,1" / "Sedang: H-14,7,3" / "Awet (beras/mie): H-30,14,7" + opsi Lanjutan (angka manual, disembunyikan); label jadi "Ingatkan saya sebelum basi" + contoh konkret; hapus kata Threshold/updateKategoriThreshold dari UI
- Topology update: C2 pecah → C2a Masuk simpel + C2b Keluar kasir + C2c menu universal; C5 threshold editor → preset selector

## Pending Action
- re-present brief once with folded scope, wait for explicit okay, then scaffold plan via script and APPEND todos
