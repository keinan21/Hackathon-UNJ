/**
 * TASK-07 [FRD-02]: Batch/Lot CRUD (qty, expiry_date, HPP snapshot)
 *
 * CRUD batch per SKU. Batch = stok fisik spesifik dari satu SKU: qty +
 * expiry_date + received_at + hpp_snapshot. Satu SKU bisa punya N batch
 * dengan tanggal beda. List per SKU diurutkan expiry paling dekat dulu.
 *
 * - sku_id wajib, FK ke skus.id
 * - qty > 0
 * - expiry_date nullable (null = non-perishable, TIDAK masuk engine expiry)
 * - received_at auto now (ISO)
 * - hpp_snapshot copy dari SKU.hpp saat terima jika tidak dikirim explicit
 * - org_id default "toko-01" sync-ready sharding (tanpa cloud sync v1)
 *
 * MUST NOT store expiry di SKU (expiry milik Batch — CONTEXT.md:12).
 * MUST handle null correctly: listBatchesExpiring exclude null (Dexie index
 * expiry_date tidak index null → skip engine otomatis).
 *
 * Thin service di atas InventoryRepository (DexieRepository). Semua akses
 * Dexie lewat repository, tidak langsung dexie di UI/engine.
 *
 * Trace: TASK-07 [FRD-02] — Batch Lot CRUD dengan hpp_snapshot dan expiry null handling.
 */

import { db, DexieRepository, ValidationError, DEFAULT_ORG_ID } from "../../db/db";
import type { Batch } from "../../db/db";
import { applyHargaBeli } from "../../db/hpp";

// Singleton repo — local-first, single device, org_id toko-01.
// Fake-indexeddb injection di test harus terjadi SEBELUM dynamic import
// modul ini (Dexie cache indexedDB saat load) — pola sama dengan db.test.ts.
const defaultRepo = new DexieRepository(db);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBatchInput {
  sku_id: number;
  qty: number;
  /** nullable: null = non-perishable, skip engine (CONTEXT.md:12) */
  expiry_date?: string | null;
  /** copy dari SKU.hpp jika tidak dikirim */
  hpp_snapshot?: number;
  /** harga beli terakhir — jika diisi, timpa SKU.hpp via applyHargaBeli + hpp_snapshot = harga_beli */
  harga_beli?: number;
  org_id?: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateBatchInput(data: CreateBatchInput): void {
  if (!Number.isInteger(data.sku_id) || data.sku_id <= 0) {
    throw new ValidationError("sku_id wajib dan harus angka valid");
  }
  if (!(data.qty > 0)) {
    throw new ValidationError("Qty harus lebih dari 0");
  }
  // expiry_date boleh string atau null atau undefined (undefined → null)
  if (
    data.expiry_date !== undefined &&
    data.expiry_date !== null &&
    typeof data.expiry_date !== "string"
  ) {
    throw new ValidationError("expiry_date harus string atau null");
  }
  if (data.hpp_snapshot !== undefined && !(data.hpp_snapshot > 0)) {
    throw new ValidationError("hpp_snapshot harus lebih dari 0 jika diisi");
  }
  if (data.harga_beli !== undefined && !(data.harga_beli > 0)) {
    throw new ValidationError("Harga beli harus lebih dari 0");
  }
}

// ---------------------------------------------------------------------------
// Batch CRUD
// ---------------------------------------------------------------------------

/**
 * Buat Batch per SKU.
 * - qty > 0, sku_id wajib
 * - expiry_date nullable (null = non-perishable, skip engine)
 * - received_at auto now ISO (via repository)
 * - hpp_snapshot: jika tidak dikirim, copy dari SKU.hpp via getSKU
 * - org_id forward toko-01 sync-ready sharding
 */
export async function createBatch(data: CreateBatchInput): Promise<Batch> {
  validateBatchInput(data);

  const expiry_date: string | null = data.expiry_date ?? null;
  const org_id = data.org_id ?? DEFAULT_ORG_ID;

  let hpp_snapshot: number | undefined = data.hpp_snapshot;

  if (data.harga_beli !== undefined) {
    const hargaBeli = data.harga_beli;
    await applyHargaBeli(data.sku_id, hargaBeli, org_id);
    hpp_snapshot = hargaBeli;
  }

  if (hpp_snapshot === undefined) {
    const sku = await defaultRepo.getSKU(data.sku_id);
    if (!sku) {
      throw new ValidationError(`SKU ${data.sku_id} tidak ditemukan`);
    }
    hpp_snapshot = sku.hpp;
  }

  return defaultRepo.createBatch({
    sku_id: data.sku_id,
    qty: data.qty,
    expiry_date,
    hpp_snapshot: hpp_snapshot!,
    org_id,
  });
}

/**
 * List batches per SKU, diurutkan expiry paling dekat dulu (FRD-02).
 * null expiry (non-perishable) tetap dikembalikan di list per SKU,
 * tapi tidak masuk engine expiry (lihat listBatchesExpiring).
 */
export async function listBatchesBySKU(
  sku_id: number,
  org_id?: string
): Promise<Batch[]> {
  return defaultRepo.listBatchesBySKU(sku_id, org_id ?? DEFAULT_ORG_ID);
}

/**
 * List batches yang punya expiry (expiry_date != null), urut expiry asc.
 * Batch non-perishable (expiry null) TIDAK muncul di sini — skip engine.
 */
export async function listBatchesExpiring(org_id?: string): Promise<Batch[]> {
  return defaultRepo.listBatchesExpiring(org_id ?? DEFAULT_ORG_ID);
}

/**
 * Update qty batch. Validasi qty > 0.
 */
export async function updateBatchQty(
  id: number,
  qty: number
): Promise<Batch> {
  return defaultRepo.updateBatchQty(id, qty);
}

/**
 * Get batch by id (helper untuk UI/engine, via Dexie langsung).
 */
export async function getBatch(id: number): Promise<Batch | undefined> {
  return db.batches.get(id);
}

// Re-export untuk konsumen & test
export { ValidationError, DEFAULT_ORG_ID };
export type { Batch };
