/**
 * TASK-06 [FRD-02]: SKU dan Kategori CRUD service thin over InventoryRepository
 *
 * Thin service di atas InventoryRepository (DexieRepository). Semua akses Dexie
 * lewat repository, tidak langsung dexie di UI/engine. org_id default "toko-01"
 * sync-ready sharding (tanpa cloud sync v1). Validasi di service sama dengan
 * db.ts: nama non-empty, kategori_id wajib, hpp>0, harga_normal>=hpp.
 * MUST NOT menerima/store field expiry_date di SKU — tolak jika payload
 * mengandung expiry_date (expiry milik Batch, bukan SKU).
 *
 * Trace: TASK-06 [FRD-02] — service tipis, validation guard, expiry guard.
 */

import { db, DexieRepository, ValidationError, DEFAULT_ORG_ID } from "../../db/db";
import type { Kategori, SKU } from "../../db/db";

// Singleton repo — local-first, single device, org_id toko-01.
// Fake-indexeddb injection di test harus terjadi SEBELUM dynamic import
// modul ini (Dexie cache indexedDB saat load) — pola sama dengan db.test.ts.
const defaultRepo = new DexieRepository(db);

// ---------------------------------------------------------------------------
// Validation helpers (mirror db.ts + expiry guard)
// ---------------------------------------------------------------------------

function assertNoExpiry(payload: Record<string, unknown>): void {
  if ("expiry_date" in payload) {
    throw new ValidationError(
      "SKU tidak boleh memiliki field expiry_date — expiry milik Batch"
    );
  }
}

function validateSKUPayload(p: {
  nama: string;
  kategori_id: number;
  hpp: number;
  harga_normal: number;
}): void {
  if (!p.nama || p.nama.trim().length === 0)
    throw new ValidationError("Nama SKU tidak boleh kosong");
  if (!Number.isInteger(p.kategori_id) || p.kategori_id <= 0)
    throw new ValidationError("kategori_id wajib dan harus angka valid");
  if (!(p.hpp > 0)) throw new ValidationError("HPP harus lebih dari 0");
  if (p.harga_normal < p.hpp)
    throw new ValidationError("harga_normal tidak boleh di bawah HPP");
}

// ---------------------------------------------------------------------------
// SKU
// ---------------------------------------------------------------------------

export async function createSKU(
  data: Omit<SKU, "id" | "org_id"> & { org_id?: string; expiry_date?: unknown }
): Promise<SKU> {
  assertNoExpiry(data as unknown as Record<string, unknown>);
  validateSKUPayload(data as unknown as { nama: string; kategori_id: number; hpp: number; harga_normal: number });
  // Forward org_id sync-ready sharding, tanpa cloud sync logic v1
  const payload = data as Omit<SKU, "id" | "org_id"> & { org_id?: string };
  // Hapus expiry_date jika ada (sudah ditolak di atas, tapi jaga-jaga)
  const { expiry_date: _ignored, ...clean } = payload as unknown as Record<string, unknown>;
  return defaultRepo.createSKU(clean as Omit<SKU, "id" | "org_id"> & { org_id?: string });
}

export async function getSKU(id: number): Promise<SKU | undefined> {
  return defaultRepo.getSKU(id);
}

export async function listSKUsByKategori(
  kategori_id: number,
  org_id?: string
): Promise<SKU[]> {
  return defaultRepo.listSKUsByKategori(kategori_id, org_id ?? DEFAULT_ORG_ID);
}

export async function updateSKU(
  id: number,
  patch: Partial<Omit<SKU, "id" | "org_id">> & { org_id?: string; expiry_date?: unknown }
): Promise<SKU> {
  assertNoExpiry(patch as unknown as Record<string, unknown>);
  const existing = await defaultRepo.getSKU(id);
  if (!existing) throw new ValidationError(`SKU ${id} tidak ditemukan`);

  // Merge dengan existing untuk validasi penuh
  const merged = { ...existing, ...patch } as SKU;
  // Hapus expiry_date dari merged jika ada (sudah ditolak)
  if ("expiry_date" in (patch as Record<string, unknown>)) {
    throw new ValidationError(
      "SKU tidak boleh memiliki field expiry_date — expiry milik Batch"
    );
  }
  validateSKUPayload({
    nama: merged.nama,
    kategori_id: merged.kategori_id,
    hpp: merged.hpp,
    harga_normal: merged.harga_normal,
  });

  // Update via Dexie langsung (repo belum punya updateSKU — thin service handle)
  // Hanya field yang ada di SKU schema, tanpa expiry_date
  const updateFields: Partial<SKU> = {};
  if (patch.nama !== undefined) updateFields.nama = patch.nama;
  if (patch.kategori_id !== undefined) updateFields.kategori_id = patch.kategori_id;
  if (patch.hpp !== undefined) updateFields.hpp = patch.hpp;
  if (patch.harga_normal !== undefined) updateFields.harga_normal = patch.harga_normal;
  if ((patch as { barcode?: string }).barcode !== undefined)
    updateFields.barcode = (patch as { barcode?: string }).barcode;

  // Jika tidak ada field yang di-update, kembalikan existing
  if (Object.keys(updateFields).length > 0) {
    await db.skus.update(id, updateFields);
  }

  const updated = await defaultRepo.getSKU(id);
  if (!updated) throw new ValidationError(`SKU ${id} tidak ditemukan setelah update`);
  return updated;
}

// ---------------------------------------------------------------------------
// Kategori
// ---------------------------------------------------------------------------

export async function createKategori(
  data: Omit<Kategori, "id" | "org_id"> & { org_id?: string }
): Promise<Kategori> {
  // Validasi nama sama dengan db.ts; threshold default [7,3,1] editable via updateKategoriThreshold
  return defaultRepo.createKategori(data);
}

export async function listKategoris(org_id?: string): Promise<Kategori[]> {
  return defaultRepo.listKategoris(org_id ?? DEFAULT_ORG_ID);
}

export async function updateKategoriThreshold(
  id: number,
  threshold_h_minus: number[]
): Promise<Kategori> {
  return defaultRepo.updateKategoriThreshold(id, threshold_h_minus);
}

// Re-export untuk konsumen & test
export { ValidationError, DEFAULT_ORG_ID };
export type { Kategori, SKU };
