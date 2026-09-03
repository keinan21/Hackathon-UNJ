import { describe, expect, test, beforeEach } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

const { InventoryDB } = await import("./db");
const { applyHargaBeli } = await import("./hpp");

function uniqueName() {
  return `test-hpp-${crypto.randomUUID()}`;
}

describe("applyHargaBeli — HPP timpa + riwayat + validasi", () => {
  test("timpa 10000→12000 + arsip benar", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    const { DexieRepository } = await import("./db");
    const repo = new DexieRepository(db as unknown as import("./db").InventoryDB);
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Susu UHT", kategori_id: k.id!, hpp: 10000, harga_normal: 15000 });

    const res = await applyHargaBeli(sku.id!, 12000, "toko-01", db as unknown as import("./db").InventoryDB);
    expect(res.hpp_lama).toBe(10000);
    expect(res.hpp_baru).toBe(12000);
    expect(res.warning).toBeUndefined();

    const updated = await db.skus.get(sku.id!);
    expect(updated?.hpp).toBe(12000);

    const history = await db.hpp_history.where("sku_id").equals(sku.id!).toArray() as Array<{ hpp_lama: number; hpp_baru: number; sku_id: number }>;
    expect(history).toHaveLength(1);
    expect(history[0].hpp_lama).toBe(10000);
    expect(history[0].hpp_baru).toBe(12000);
    expect(history[0].sku_id).toBe(sku.id);

    db.close();
  });

  test("warning saat harga_normal < hpp baru", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    const { DexieRepository } = await import("./db");
    const repo = new DexieRepository(db as unknown as import("./db").InventoryDB);
    const k = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Keripik", kategori_id: k.id!, hpp: 10000, harga_normal: 11000 });

    const res = await applyHargaBeli(sku.id!, 12000, "toko-01", db as unknown as import("./db").InventoryDB);
    expect(res.warning).toBe("Harga normal di bawah HPP baru");

    // simpan tetap boleh — hpp sudah tertimpa walau warning
    const updated = await db.skus.get(sku.id!);
    expect(updated?.hpp).toBe(12000);

    // arsip tetap ada
    const history = await repo.listHppHistoryBySKU(sku.id!);
    expect(history).toHaveLength(1);

    db.close();
  });

  test("tidak warning jika harga_normal >= hpp baru", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    const { DexieRepository } = await import("./db");
    const repo = new DexieRepository(db as unknown as import("./db").InventoryDB);
    const k = await repo.createKategori({ nama: "Minuman", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Teh Botol", kategori_id: k.id!, hpp: 8000, harga_normal: 15000 });
    const res = await applyHargaBeli(sku.id!, 9000, "toko-01", db as unknown as import("./db").InventoryDB);
    expect(res.warning).toBeUndefined();
    db.close();
  });

  test("harga_beli 0 reject Harga beli harus lebih dari 0", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    const { DexieRepository } = await import("./db");
    const repo = new DexieRepository(db as unknown as import("./db").InventoryDB);
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Susu", kategori_id: k.id!, hpp: 10000, harga_normal: 15000 });
    await expect(applyHargaBeli(sku.id!, 0, "toko-01", db as unknown as import("./db").InventoryDB)).rejects.toThrow("Harga beli harus lebih dari 0");
    // hpp tidak berubah, tidak ada history
    expect((await db.skus.get(sku.id!))?.hpp).toBe(10000);
    expect(await db.hpp_history.count()).toBe(0);
    db.close();
  });

  test("harga_beli negatif reject", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    const { DexieRepository } = await import("./db");
    const repo = new DexieRepository(db as unknown as import("./db").InventoryDB);
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Susu", kategori_id: k.id!, hpp: 10000, harga_normal: 15000 });
    await expect(applyHargaBeli(sku.id!, -500, "toko-01", db as unknown as import("./db").InventoryDB)).rejects.toThrow("Harga beli harus lebih dari 0");
    expect((await db.skus.get(sku.id!))?.hpp).toBe(10000);
    db.close();
  });

  test("hpp_snapshot batch = harga_beli yang dipakai", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    const { DexieRepository } = await import("./db");
    const repo = new DexieRepository(db as unknown as import("./db").InventoryDB);
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Susu UHT", kategori_id: k.id!, hpp: 10000, harga_normal: 15000 });

    // simulasi batch masuk dengan harga_beli = 12000
    const hargaBeli = 12000;
    await applyHargaBeli(sku.id!, hargaBeli, "toko-01", db as unknown as import("./db").InventoryDB);
    const batch = await repo.createBatch({ sku_id: sku.id!, qty: 10, expiry_date: "2026-09-10", hpp_snapshot: hargaBeli });
    expect(batch.hpp_snapshot).toBe(12000);
    // sku.hpp sudah tertimpa
    expect((await db.skus.get(sku.id!))?.hpp).toBe(12000);
    db.close();
  });

  test("batch tanpa harga_beli → hpp_snapshot = sku.hpp lama, tidak timpa", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    const { DexieRepository } = await import("./db");
    const repo = new DexieRepository(db as unknown as import("./db").InventoryDB);
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Susu", kategori_id: k.id!, hpp: 10000, harga_normal: 15000 });

    // batch tanpa harga_beli: hpp_snapshot default = sku.hpp (10000)
    const batch = await repo.createBatch({ sku_id: sku.id!, qty: 5, expiry_date: "2026-09-10", hpp_snapshot: sku.hpp });
    expect(batch.hpp_snapshot).toBe(10000);
    expect((await db.skus.get(sku.id!))?.hpp).toBe(10000);
    expect(await db.hpp_history.count()).toBe(0);
    db.close();
  });

  test("guardrail promo tetap pakai hpp_snapshot batch bukan sku.hpp", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    const { DexieRepository } = await import("./db");
    const repo = new DexieRepository(db as unknown as import("./db").InventoryDB);
    const { validateHargaTebus } = await import("../lib/validation");
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Susu UHT", kategori_id: k.id!, hpp: 10000, harga_normal: 15000 });
    // batch lama snapshot 10000
    const batchLama = await repo.createBatch({ sku_id: sku.id!, qty: 5, expiry_date: "2026-09-10", hpp_snapshot: 10000 });
    // timpa sku.hpp ke 12000
    await applyHargaBeli(sku.id!, 12000, "toko-01", db as unknown as import("./db").InventoryDB);
    const skuBaru = await db.skus.get(sku.id!);
    expect(skuBaru?.hpp).toBe(12000);
    // guardrail untuk batch lama harus pakai hpp_snapshot 10000, bukan 12000
    // floor lama = 8500, floor baru = 10200
    // harga 9000 valid terhadap 10000 tapi tidak terhadap 12000
    const rLama = validateHargaTebus(batchLama.hpp_snapshot, 9000);
    expect(rLama.valid).toBe(true);
    const rBaru = validateHargaTebus(skuBaru!.hpp, 9000);
    expect(rBaru.valid).toBe(false);
    db.close();
  });
});
