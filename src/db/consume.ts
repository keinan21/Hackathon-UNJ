/**
 * TASK-05 [FRD-02]: Helper consumeFEFO — FEFO consume + transaksi keluar
 *
 * Aturan (EXPECTED OUTCOME + CONTEXT):
 * - consumeFEFO(sku_id, qty): potong batch expiry terdekat dulu
 * - batch expiry null = non-perishable dilewati FEFO, hanya dipakai jika tidak ada batch expiry sama sekali (fallback)
 * - qty batch habis → set 0 (jangan hapus baris agar histori utuh)
 * - tulis 1 transaksis {jenis keluar, harga_jual_snapshot = sku.harga_normal, sold_at now}
 * - validasi qty>0 ("Qty harus lebih dari 0"), stok total<qty → reject "Stok tidak cukup" TANPA ubah apapun
 * - return sisa + detail potongan per batch
 */

import { db as singletonDb, ValidationError, DEFAULT_ORG_ID } from "./db";
import type { InventoryDB } from "./db";
import type { Batch } from "./db";

export interface ConsumeDetail {
  batchId: number;
  taken: number;
  remaining: number;
}

export interface ConsumeResult {
  sku_id: number;
  qtyRequested: number;
  qtyConsumed: number;
  sisaStok: number;
  details: ConsumeDetail[];
  transaksiId: number;
}

function sortExpiryAsc(a: Batch, b: Batch): number {
  // expiry_date null tidak ada di sini (sudah dipartisi), tapi jaga
  if (a.expiry_date === null && b.expiry_date === null) return 0;
  if (a.expiry_date === null) return 1;
  if (b.expiry_date === null) return -1;
  return (a.expiry_date as string).localeCompare(b.expiry_date as string);
}

/**
 * FEFO consume helper.
 * @param skuId - sku_id numeric
 * @param qty - qty yang ingin dikeluarkan (>0)
 * @param orgId - org_id (default toko-01)
 * @param dbInstance - InventoryDB instance (default singleton db)
 */
export async function consumeFEFO(
  skuId: number,
  qty: number,
  orgId: string = DEFAULT_ORG_ID,
  dbInstance: InventoryDB = singletonDb
): Promise<ConsumeResult> {
  if (!(qty > 0)) throw new ValidationError("Qty harus lebih dari 0");
  if (!Number.isInteger(skuId) || skuId <= 0) throw new ValidationError("SKU tidak ditemukan");

  // transaksi atomic: cek stok + potong batch + tulis transaksis dalam 1 Dexie transaction
  return dbInstance.transaction("rw", dbInstance.batches, dbInstance.transaksis, dbInstance.skus, async () => {
    const sku = await dbInstance.skus.get(skuId);
    if (!sku) throw new ValidationError(`SKU ${skuId} tidak ditemukan`);
    if (sku.org_id !== orgId) throw new ValidationError(`SKU ${skuId} tidak ditemukan`);

    // ambil semua batch sku ini dengan org sama dan qty>0 (qty 0 tidak perlu dipotong)
    const allBatches: Batch[] = await dbInstance.batches
      .where("sku_id")
      .equals(skuId)
      .and((b) => b.org_id === orgId)
      .toArray();

    // partisi expiry vs null
    const expiring = allBatches.filter((b) => b.expiry_date !== null && b.qty > 0).sort(sortExpiryAsc);
    const nonPerishable = allBatches.filter((b) => b.expiry_date === null && b.qty > 0);

    let targetBatches: Batch[];
    let totalAvailable: number;

    if (expiring.length > 0) {
      // Ada batch expiry → hanya pakai yang expiry, null dilewati sepenuhnya (KEPUTUSAN FEFO)
      targetBatches = expiring;
      totalAvailable = expiring.reduce((s, b) => s + b.qty, 0);
    } else {
      // Tidak ada batch expiry sama sekali → fallback pakai null
      targetBatches = nonPerishable;
      totalAvailable = nonPerishable.reduce((s, b) => s + b.qty, 0);
    }

    if (totalAvailable < qty) {
      throw new ValidationError("Stok tidak cukup");
    }

    // potong berurutan FEFO
    let remaining = qty;
    const details: ConsumeDetail[] = [];

    for (const batch of targetBatches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.qty, remaining);
      const newQty = batch.qty - take;
      // set 0 jika habis, jangan hapus baris
      await dbInstance.batches.update(batch.id as number, { qty: newQty });
      details.push({ batchId: batch.id as number, taken: take, remaining: newQty });
      remaining -= take;
    }

    // tulis transaksi keluar
    const now = new Date().toISOString();
    const transaksiId = (await (dbInstance.transaksis as unknown as { add: (x: unknown) => Promise<number> }).add({
      sku_id: skuId,
      qty_sold: qty,
      sold_at: now,
      org_id: orgId,
      jenis: "keluar",
      harga_jual_snapshot: sku.harga_normal,
      pengirim: null,
      penerima: null,
      catatan: null,
    })) as number;

    const sisaStok = totalAvailable - qty;

    return {
      sku_id: skuId,
      qtyRequested: qty,
      qtyConsumed: qty,
      sisaStok,
      details,
      transaksiId,
    };
  });
}
