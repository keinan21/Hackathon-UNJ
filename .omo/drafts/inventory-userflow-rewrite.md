# inventory-userflow-rewrite - Draft (resume point)

- intent: clear
- review_required: false
- classify: Architecture (system-wide user-flow rewrite, 5+ modules, docs + schema + UI + notif + advisor)
- status: review-round-active
- plan_path: .omo/plans/inventory-userflow-rewrite.md
- review_required: true
- review_round_id: rr-20260903-02
- round_status: active
- pending-action: review .omo/plans/inventory-userflow-rewrite.md
- review:
  - momus: { status: launching, workspace_root: /home/yusuf/dev/2026/UNEJ, target: .omo/plans/inventory-userflow-rewrite.md, round_id: rr-20260903-02, launch_id: momus-launch-02 }
  - independent: { status: launching, workspace_root: /home/yusuf/dev/2026/UNEJ, target: .omo/plans/inventory-userflow-rewrite.md, round_id: rr-20260903-02, launch_id: oracle-launch-02 }
- round-1 receipts: momus=approved (2 non-blocking notes, folded), oracle=changes_requested (16 issues, all patched per fix list in plan)
- round-2 receipts (rr-20260903-02, both unconditional approval, plan unchanged since review):
  - momus: approved/OKAY (16/16 patches hold, refs verified, session momus-spark-1.2-1788447092-14370)
  - independent oracle: approved (16/16 verified at cited lines, 2 non-blocking worker notes, session oracle-reviewer-session-rr-20260903-01)
- status: review-passed, ready-for-start-work

## Decisions (user-owned, interviewed in Indonesian, no defaults invented)
1. Login: PIN + nama toko, offline-first, single Supervisor. Sync multi-toko ditunda.
2. Dashboard: stat SKU + kritis + mini-stat + tombol navigasi ikon jelas.
3. Setting: backup + PIN + profil toko; threshold kategori di bawah.
4. SKU baru: nama, kategori, HPP, harga jual + barcode (manual ketik + scan kamera).
5. Kategori (threshold-bound) vs Tag (label bebas untuk cari) dipisah.
6. Kode SKU auto: prefix kategori (mis. DAI-001), unik per org.
7. Detail SKU: 1 SKU = 1 halaman lengkap + grafik mini arus keluar-masuk (sinyal BEP).
8. In-out form: SKU, jumlah, expired (tanggal/durasi), pengirim, penerima, harga beli, catatan. Semua barang = barang jualan warung. FEFO otomatis. HPP timpa langsung dari harga beli terakhir.
9. Statistik (sub-tab Dashboard): rank masuk/keluar, kecepatan per SKU/kategori, histori, omzet/margin.
10. Expiry warning: ikut threshold per kategori (editable); input dua mode tanggal kemasan / X hari dari masuk.
11. Notif: Telegram ke owner/manajer, rekap jam 07:00 + cashflow ala manajer otomatis. Token bot + chat ID via HUMAN.md oleh worker (diingatkan di chat saat implementasi).
12. AI: bebas jenis promo (tebus murah/bundling/BOGO/diskon/cashback), guardrail margin aman tetap; user pilih jenis dulu + tombol AI bantu.
13. Kritis: dashboard hanya yang benar-benar kritis + halaman khusus list kritis → tap ke halaman SKU.
14. Navigasi: 3 tab utama (Dashboard, SKU, Setting); Statistik sub-tab Dashboard; In-Out sub-tab SKU.
15. Rewrite sekaligus besar (big-bang), docs lama direvisi ikut flow baru.
16. Barcode manual + kamera (breaking Must NOT v1 → butuh revisi docs + dep scan baru).
17. Tests-after (QA agent-eksekusi selalu ada).
18. Git: setiap task = 1 branch feat/* + PR GitHub + 1 reviewer + CI hijau + squash merge (AGENTS.md GitHub Flow tetap berlaku).
19. Token Telegram: enkripsi + antre ulang saat offline.
20. HPP: timpa + simpan riwayat (hpp_history untuk grafik BEP).
21. Kritis: ikut threshold tiap kategori.
22. Migrasi kode: backfill otomatis, prefix ikut nama kategori baru.
23. Statistik: jendela 14 hari; omzet = harga jual x qty; margin = omzet − HPP.
24. Metis directives dilipat: ADR-003 + Must-NOT amendments dulu (Wave 0), Dexie v2 dulu (Wave 1), 6 feat-PR berurutan A→C→D→E→B→F, guardrail per-jenis promo, omzet engine deterministik.

## Components (topology lock, disetujui user)
- A. Auth/Login gate (PIN + nama toko)
- B. Dashboard + navigasi + sub-tab Statistik
- C. SKU katalog + auto-kode + tag/kategori + 1 halaman detail + grafik mini
- D. Keluar-masuk barang (sub-tab SKU, form kasir, FEFO, HPP timpa)
- E. Tracking kedaluwarsa per batch + Telegram 07:00 + saran AI + halaman kritis
- F. Setting (backup + PIN + profil + threshold bawah) + docs revision + scan-camera dep

## Approval gate
- status: approved (user: "Setuju, tulis rencana")
- next: write .omo/plans/inventory-userflow-rewrite.md, run Metis, append todos, fill TL;DR last, handoff.
