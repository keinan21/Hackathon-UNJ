import { describe, expect, test } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

const Dexie = (await import("dexie")).default;
const { InventoryDB, DexieRepository, ValidationError } = await import("./db");

class LegacyDB extends Dexie {
  skus!: import("dexie").Table<unknown, number>;
  kategoris!: import("dexie").Table<unknown, number>;
  batches!: import("dexie").Table<unknown, number>;
  transaksis!: import("dexie").Table<unknown, number>;
  promos!: import("dexie").Table<unknown, number>;
  advisorCache!: import("dexie").Table<unknown, [string, string]>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      skus: "++id, nama, kategori_id, barcode, org_id",
      kategoris: "++id, nama, org_id",
      batches: "++id, sku_id, expiry_date, org_id, [org_id+sku_id]",
      transaksis: "++id, sku_id, sold_at, org_id",
      promos: "++id, status, batch_id, org_id",
      advisorCache: "[key+org_id], key, org_id",
    });
  }
}

function uniqueName() {
  return `test-migration-${crypto.randomUUID()}`;
}

describe("Dexie v1 → v2 migration", () => {
  test("seed v1 → migrate → backfill kode DAI-001/DAI-002/SNA-001 unik, transaksi lama tetap valid, duplikat reject Bahasa Indonesia", async () => {
    const dbName = uniqueName();

    // 1. Seed v1 via legacy DB
    const legacy = new LegacyDB(dbName);
    await legacy.open();
    const catDairyId = (await legacy.table("kategoris").add({ nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" })) as number;
    const catSnackId = (await legacy.table("kategoris").add({ nama: "Snack", threshold_h_minus: [7, 3, 1], org_id: "toko-01" })) as number;

    const sku1Id = (await legacy.table("skus").add({ nama: "Susu UHT 1L", kategori_id: catDairyId, hpp: 12000, harga_normal: 15000, org_id: "toko-01" })) as number;
    const sku2Id = (await legacy.table("skus").add({ nama: "Yogurt 200ml", kategori_id: catDairyId, hpp: 8000, harga_normal: 10000, org_id: "toko-01" })) as number;
    const sku3Id = (await legacy.table("skus").add({ nama: "Keripik Kentang", kategori_id: catSnackId, hpp: 5000, harga_normal: 7000, org_id: "toko-01" })) as number;

    await legacy.table("transaksis").add({ sku_id: sku1Id, qty_sold: 3, sold_at: "2026-09-01T07:00:00Z", org_id: "toko-01" });

    legacy.close();

    // 2. Open v2 (InventoryDB) — triggers upgrade backfill
    const v2 = new InventoryDB(dbName);
    await v2.open();

    // 3. Assert kode backfilled per kategori prefix 3 huruf kapital + nomor urut
    const skus = await v2.table("skus").toArray() as Array<{ id: number; nama: string; kategori_id: number; kode: string; org_id: string }>;
    expect(skus).toHaveLength(3);
    const sku1 = skus.find((s) => s.id === sku1Id)!;
    const sku2 = skus.find((s) => s.id === sku2Id)!;
    const sku3 = skus.find((s) => s.id === sku3Id)!;

    expect(sku1.kode).toBe("DAI-001");
    expect(sku2.kode).toBe("DAI-002");
    expect(sku3.kode).toBe("SNA-001");

    // unik per org: [org_id+kode] index — no duplicate
    const kodes = skus.map((s) => s.kode);
    expect(new Set(kodes).size).toBe(3);

    // 4. Transaksi lama tetap terbaca, kolom baru nullable/default
    const transaksis = await v2.table("transaksis").toArray() as Array<{ sku_id: number; qty_sold: number; jenis?: string; harga_jual_snapshot?: number }>;
    expect(transaksis).toHaveLength(1);
    expect(transaksis[0].sku_id).toBe(sku1Id);
    // data lama tidak punya kolom baru — harus tetap valid (undefined dianggap default)
    // keputusan: jenis default "keluar", harga_jual_snapshot 0 (evidence)
    const jenis = transaksis[0].jenis ?? "keluar";
    const harga = transaksis[0].harga_jual_snapshot ?? 0;
    expect(jenis).toBe("keluar");
    expect(harga).toBe(0);

    // 4b. Tabel baru ada dan kosong (tanpa hapus data)
    const tags = await v2.table("tags").toArray();
    expect(tags).toHaveLength(0);
    const skuTags = await v2.table("sku_tags").toArray();
    expect(skuTags).toHaveLength(0);
    const hppHist = await v2.table("hpp_history").toArray();
    expect(hppHist).toHaveLength(0);

    // batches & kategoris tetap ada (tidak terhapus)
    expect(await v2.table("kategoris").count()).toBe(2);
    expect(await v2.table("skus").count()).toBe(3);

    // 5. Duplikat kode per org reject pesan Indonesia
    const repo = new DexieRepository(v2 as unknown as import("./db").InventoryDB);
    await expect(
      repo.createSKU({ nama: "Susu Baru", kategori_id: catDairyId, hpp: 10000, harga_normal: 12000, kode: "DAI-001" } as unknown as Parameters<typeof repo.createSKU>[0])
    ).rejects.toThrow("Kode SKU sudah dipakai");

    // validasi tag duplikat juga Indonesia
    await repo.createTag({ nama: "Promo", org_id: "toko-01" });
    await expect(repo.createTag({ nama: "Promo", org_id: "toko-01" })).rejects.toThrow("Nama tag sudah dipakai");

    // hpp_history tercatat
    const hist = await repo.createHppHistory({ sku_id: sku1Id, hpp_lama: 12000, hpp_baru: 13000 });
    expect(hist.hpp_lama).toBe(12000);
    const histList = await repo.listHppHistoryBySKU(sku1Id);
    expect(histList).toHaveLength(1);

    // sku_tags many-to-many
    const tag = await v2.table("tags").where("[org_id+nama]").equals(["toko-01", "Promo"]).first() as { id: number };
    await repo.addTagToSKU(sku1Id, tag.id);
    const tagsForSku = await repo.listTagsBySKU(sku1Id);
    expect(tagsForSku).toHaveLength(1);
    expect(tagsForSku[0].nama).toBe("Promo");

    v2.close();
  });

  test("fallback prefix SK untuk kategori nama pendek / karakter aneh", async () => {
    const dbName = uniqueName();
    const legacy = new LegacyDB(dbName);
    await legacy.open();
    const catId = (await legacy.table("kategoris").add({ nama: "A", threshold_h_minus: [7, 3, 1], org_id: "toko-01" })) as number;
    await legacy.table("skus").add({ nama: "Item A1", kategori_id: catId, hpp: 1000, harga_normal: 2000, org_id: "toko-01" });
    legacy.close();

    const v2 = new InventoryDB(dbName);
    await v2.open();
    const skus = (await v2.table("skus").toArray()) as Array<{ kode: string }>;
    expect(skus[0].kode).toMatch(/^ASK-001$/);
    v2.close();
  });
});
