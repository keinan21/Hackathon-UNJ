/**
 * TASK-05 [FRD-02]: Helper computeKode + backfill + regenerateKodesForKategori
 *
 * - buildKodePrefix(namaKategori): 3 huruf kapital pertama, fallback "SK"/"ASK"
 * - computeNextKode(existingKodes, prefix): max+1, bukan count (anti-tabrakan hapus)
 * - computeKode(kategoriNama, orgId, db): query existing max per prefix per org → next
 * - regenerateKodesForKategori(kategoriId, newNama, orgId, db): SATU transaksi Dexie
 *   update semua SKU se-kategori + kategori.nama, cek unik, konflik → rollback + pesan Indonesia
 *
 * Pure helpers (buildKodePrefix/computeNextKode) tidak import db agar bisa dipakai di db.ts upgrade tanpa circular.
 */

import type { InventoryDB } from "./db";

// ---------------------------------------------------------------------------
// Curated prefixes — 11 kategori kelontong terkunci 2026-09-03
// Nama persis → prefix. Seed-only untuk informasi; kode tidak disimpan di DB.
// Fallback ke buildKodePrefix derivasi untuk kategori buatan user.
// ---------------------------------------------------------------------------

export const CURATED_PREFIXES: Record<string, string> = {
  Sembako: "SEM",
  "Bumbu Dapur": "BUM",
  "Makanan Kering": "MKR",
  "Makanan Basah": "MBS",
  "Makanan Frozen": "MFZ",
  "Minuman Kaleng": "MKL",
  "Minuman Botol": "MBT",
  "Obat Bebas": "OBT",
  "Perawatan Diri": "PRW",
  Rokok: "RKK",
  Misc: "MSC",
};

export function getCuratedPrefix(namaKategori: string): string | undefined {
  const trimmed = namaKategori.trim();
  return CURATED_PREFIXES[trimmed];
}

export function getPrefixForKategori(namaKategori: string): string {
  const curated = getCuratedPrefix(namaKategori);
  if (curated) return curated;
  return buildKodePrefix(namaKategori);
}

// ---------------------------------------------------------------------------
// Pure helpers (no DB)
// ---------------------------------------------------------------------------

export function buildKodePrefix(namaKategori: string): string {
  const cleaned = namaKategori.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (cleaned.length >= 3) return cleaned.slice(0, 3);
  if (cleaned.length > 0) return (cleaned + "SK").slice(0, 3);
  return "SK";
}

export function computeNextKode(existingKodes: string[], prefix: string): string {
  let max = 0;
  for (const k of existingKodes) {
    const m = k.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// DB helpers (need InventoryDB instance)
// ---------------------------------------------------------------------------

/**
 * Hitung kode unik berikutnya untuk kategoriNama + orgId.
 * - prefix dari buildKodePrefix(kategoriNama)
 * - scan existing skus where org_id==orgId and kode startsWith prefix → max+1
 * - tahan race sederhana: caller seharusnya panggil di dalam transaksi jika butuh atomic
 */
export async function computeKode(
  kategoriNama: string,
  orgId: string,
  db: InventoryDB
): Promise<string> {
  const prefix = getPrefixForKategori(kategoriNama);
  const existing = await db.skus
    .where("org_id")
    .equals(orgId)
    .filter((s) => !!s.kode && (s.kode as string).startsWith(`${prefix}-`))
    .toArray();
  const existingKodes = existing.map((s) => s.kode as string);
  return computeNextKode(existingKodes, prefix);
}

/**
 * Regenerasi kode SKU se-kategori saat rename kategori.
 * - SATU transaksi Dexie (skus + kategoris) → rollback otomatis jika throw
 * - prefix baru dari newNama
 * - SKU se-kategori diurut id asc → assign ${prefix}-001..N
 * - cek unik global per org: kode baru tidak boleh sudah dipakai SKU kategori lain
 * - konflik → throw ValidationError "Kode SKU sudah dipakai"
 */
export async function regenerateKodesForKategori(
  kategoriId: number,
  newNama: string,
  orgId: string,
  db: InventoryDB
): Promise<void> {
  // import lazy to avoid circular at top-level (ValidationError defined in db.ts)
  const { ValidationError } = await import("./db");
  if (!newNama || newNama.trim().length === 0) throw new ValidationError("Nama kategori tidak boleh kosong");
  const prefix = getPrefixForKategori(newNama);

  await db.transaction("rw", db.skus, db.kategoris, async () => {
    const kategori = await db.kategoris.get(kategoriId);
    if (!kategori) throw new ValidationError(`Kategori ${kategoriId} tidak ditemukan`);
    if (kategori.org_id !== orgId) throw new ValidationError(`Kategori ${kategoriId} tidak ditemukan`);

    const skusInKategori = await db.skus
      .where("kategori_id")
      .equals(kategoriId)
      .and((s) => s.org_id === orgId)
      .toArray();
    skusInKategori.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    if (skusInKategori.length === 0) {
      // hanya update nama kategori
      await db.kategoris.update(kategoriId, { nama: newNama });
      return;
    }

    // kumpulkan kode yang sudah dipakai di luar kategori ini (per org)
    const otherSkus = await db.skus
      .where("org_id")
      .equals(orgId)
      .filter((s) => s.kategori_id !== kategoriId && !!s.kode)
      .toArray();
    const occupied = new Set(otherSkus.map((s) => s.kode as string));

    // generate kode baru sequential, skip jika occupied
    const newKodes: Array<{ id: number; kode: string }> = [];
    let seq = 1;
    for (const sku of skusInKategori) {
      let kode: string;
      // cari seq berikutnya yang tidak occupied
      do {
        kode = `${prefix}-${String(seq).padStart(3, "0")}`;
        seq++;
        // jika seq sudah melebihi 999 dan kode sudah dipakai, tetap lanjut (pad 4 digit otomatis)
        if (seq > 1000) {
          // tetap generate dengan padStart 3 → akan jadi 1000+ (4 digit)
        }
      } while (occupied.has(kode));
      // cek juga tidak duplikat di newKodes (tidak mungkin karena seq naik, tapi jaga)
      if (newKodes.some((x) => x.kode === kode)) {
        throw new ValidationError("Kode SKU sudah dipakai");
      }
      occupied.add(kode);
      newKodes.push({ id: sku.id as number, kode });
    }

    // update semua SKU dalam transaksi yang sama
    for (const { id, kode } of newKodes) {
      try {
        await db.skus.update(id, { kode });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("ConstraintError") || msg.toLowerCase().includes("kode")) {
          throw new ValidationError("Kode SKU sudah dipakai");
        }
        throw e;
      }
    }

    // update nama kategori terakhir (setelah SKU sukses)
    await db.kategoris.update(kategoriId, { nama: newNama });
  });
}
