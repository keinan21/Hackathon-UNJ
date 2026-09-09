import { dexieV2 } from "./dexieRepository";
import type { Batch } from "./types";

export type KeluarItem = {
  skuId: string;
  qty: number;
  penerima?: string | null;
  catatan?: string | null;
};

export type KeluarResult = {
  transaksiIds: string[];
};

function sortExpiryAsc(a: Batch, b: Batch): number {
  if (a.expiry_date === null && b.expiry_date === null) return 0;
  if (a.expiry_date === null) return 1;
  if (b.expiry_date === null) return -1;
  return (a.expiry_date as string).localeCompare(b.expiry_date as string);
}

/**
 * Keluar tercepat keluar bersama untuk 1..N barang dalam SATU transaksi Dexie.
 * Aturan sama persis dengan form keluar lama:
 * - batch expiry terdekat dulu; null dilewati kecuali tidak ada expiring sama sekali
 * - qty batch habis → set 0 (jangan hapus baris)
 * - tulis transaksis jenis keluar, harga_jual_snapshot = sku.harga_normal saat itu
 * - validasi: qty>0 integer ("Qty harus lebih dari 0"), stok kurang → "Stok tidak cukup"
 * All-or-nothing: 1 baris gagal → SELURUH transaksi abort, tidak ada yang tertulis.
 */
export async function consumeKeluarTercepat(items: KeluarItem[], orgId = "toko-01"): Promise<KeluarResult> {
  for (const it of items) {
    if (!it.skuId) throw new Error("Pilih SKU terlebih dahulu");
    if (!Number.isFinite(it.qty) || !(it.qty > 0) || !Number.isInteger(it.qty)) {
      throw new Error("Qty harus lebih dari 0");
    }
  }
  const nowIso = new Date().toISOString();
  const transaksiIds: string[] = [];

  await dexieV2.transaction("rw", dexieV2.skus, dexieV2.batches, dexieV2.transaksis, async () => {
    for (const it of items) {
      const sku = await dexieV2.skus.get(it.skuId);
      if (!sku || sku.org_id !== orgId) throw new Error("SKU tidak ditemukan");

      const all: Batch[] = await dexieV2.batches.where("[org_id+sku_id]").equals([orgId, it.skuId]).toArray();
      const expiring = all.filter((b) => b.expiry_date !== null && b.qty > 0).sort(sortExpiryAsc);
      const nonPerishable = all.filter((b) => b.expiry_date === null && b.qty > 0);

      let target: Batch[];
      let totalAvailable: number;
      if (expiring.length > 0) {
        target = expiring;
        totalAvailable = expiring.reduce((s, b) => s + b.qty, 0);
      } else {
        target = nonPerishable;
        totalAvailable = nonPerishable.reduce((s, b) => s + b.qty, 0);
      }

      if (totalAvailable < it.qty) throw new Error("Stok tidak cukup");

      let remaining = it.qty;
      for (const batch of target) {
        if (remaining <= 0) break;
        const take = Math.min(batch.qty, remaining);
        await dexieV2.batches.put({ ...batch, qty: batch.qty - take });
        remaining -= take;
      }

      const tid = crypto.randomUUID();
      await (dexieV2.transaksis as unknown as { put: (x: unknown) => Promise<unknown> }).put({
        id: tid,
        sku_id: it.skuId,
        qty_sold: it.qty,
        sold_at: nowIso,
        org_id: orgId,
        jenis: "keluar",
        harga_jual_snapshot: sku.harga_normal,
        pengirim: null,
        penerima: it.penerima?.trim() || null,
        catatan: it.catatan?.trim() || null,
      });
      transaksiIds.push(tid);
    }
  });

  return { transaksiIds };
}
