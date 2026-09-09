import { describe, expect, test, beforeEach } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

const { InventarisDexie, DexieInventoryRepository } = await import("./dexieRepository");

function uniqueName() {
  return `test-sku-guard-${crypto.randomUUID()}`;
}

describe("createSku guard — HPP wajib > 0", () => {
  let repo: InstanceType<typeof DexieInventoryRepository>;
  let db: InstanceType<typeof InventarisDexie>;

  beforeEach(async () => {
    db = new InventarisDexie(uniqueName());
    repo = new DexieInventoryRepository(db);
    await repo.createKategori({ id: "k1", nama: "Sembako", threshold_h_minus: [30, 14, 7], org_id: "toko-01" });
  });

  test("tolak hpp 0 dengan pesan Indonesia", async () => {
    await expect(
      repo.createSku({ id: "s1", nama: "Beras", kategori_id: "k1", hpp: 0, harga_normal: 10000, org_id: "toko-01" }),
    ).rejects.toThrow("HPP harus lebih dari 0");
  });

  test("tolak hpp negatif", async () => {
    await expect(
      repo.createSku({ id: "s2", nama: "Beras", kategori_id: "k1", hpp: -500, harga_normal: 10000, org_id: "toko-01" }),
    ).rejects.toThrow("HPP harus lebih dari 0");
  });

  test("tolak nama kosong", async () => {
    await expect(
      repo.createSku({ id: "s3", nama: "   ", kategori_id: "k1", hpp: 5000, harga_normal: 10000, org_id: "toko-01" }),
    ).rejects.toThrow("Nama SKU tidak boleh kosong");
  });

  test("terima harga == hpp (impas boleh)", async () => {
    await repo.createSku({ id: "s4", nama: "Gula", kategori_id: "k1", hpp: 10000, harga_normal: 10000, org_id: "toko-01" });
    const saved = await repo.getSku("s4");
    expect(saved?.harga_normal).toBe(10000);
  });

  test("terima harga normal di atas hpp", async () => {
    await repo.createSku({ id: "s5", nama: "Minyak", kategori_id: "k1", hpp: 20000, harga_normal: 25000, org_id: "toko-01" });
    const saved = await repo.getSku("s5");
    expect(saved?.hpp).toBe(20000);
  });
});
