/**
 * TASK-06 [FRD-02]: Helper HPP timpa + riwayat
 *
 * Aturan (EXPECTED OUTCOME):
 * - applyHargaBeli(skuId, hargaBeli, org?) validasi > 0 ("Harga beli harus lebih dari 0")
 * - arsip {sku_id, hpp_lama, hpp_baru, created_at} ke hpp_history
 * - timpa sku.hpp = harga_beli
 * - return {warning?: "Harga normal di bawah HPP baru"} jika harga_normal < harga_beli
 * - guardrail promo (validateHargaTebus) TETAP pakai hpp_snapshot per batch — jangan ubah validation.ts
 * - helper dipanggil dari createBatch saat harga_beli diisi;
 *   jika batch tanpa harga_beli → hpp_snapshot = sku.hpp lama, tidak timpa
 *
 * Local-first: akses via Dexie InventoryDB, org_id default toko-01 sync-ready sharding.
 */

import { db as singletonDb, ValidationError, DEFAULT_ORG_ID } from "./db";
import type { InventoryDB } from "./db";

export interface ApplyHargaBeliResult {
  sku_id: number;
  hpp_lama: number;
  hpp_baru: number;
  warning?: string;
}

/**
 * Timpa SKU.hpp dengan harga_beli terakhir + arsip ke hpp_history.
 * Validasi harga_beli > 0, reject dengan pesan Indonesia.
 * Return warning jika harga_normal < harga_beli (warning bukan reject, simpan tetap boleh).
 */
export async function applyHargaBeli(
  skuId: number,
  hargaBeli: number,
  orgId: string = DEFAULT_ORG_ID,
  dbInstance: InventoryDB = singletonDb,
): Promise<ApplyHargaBeliResult> {
  if (!Number.isFinite(hargaBeli) || !(hargaBeli > 0)) {
    throw new ValidationError("Harga beli harus lebih dari 0");
  }
  if (!Number.isInteger(skuId) || skuId <= 0) {
    throw new ValidationError(`SKU ${skuId} tidak ditemukan`);
  }

  return dbInstance.transaction("rw", dbInstance.skus, dbInstance.hpp_history, async () => {
    const sku = await dbInstance.skus.get(skuId);
    if (!sku) throw new ValidationError(`SKU ${skuId} tidak ditemukan`);
    if (sku.org_id !== orgId) throw new ValidationError(`SKU ${skuId} tidak ditemukan`);

    const hpp_lama = sku.hpp;
    const hpp_baru = hargaBeli;
    const now = new Date().toISOString();

    // arsip ke hpp_history
    await dbInstance.hpp_history.add({
      sku_id: skuId,
      hpp_lama,
      hpp_baru,
      created_at: now,
      org_id: orgId,
    });

    // timpa sku.hpp
    await dbInstance.skus.update(skuId, { hpp: hpp_baru });

    const warning =
      sku.harga_normal < hpp_baru ? "Harga normal di bawah HPP baru" : undefined;

    return { sku_id: skuId, hpp_lama, hpp_baru, warning };
  });
}
