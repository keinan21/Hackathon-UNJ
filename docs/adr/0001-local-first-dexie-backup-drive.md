# ADR-001: Local-First Dexie + Backup Drive Opsional (PWA Offline)

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
