/**
 * TASK-05 [FRD-02] acceptance tests
 *
 * - seed creates 3 kategori each [7,3,1]
 * - edit to [14,7,3] succeeds
 * - edit to [3,3,1] rejects duplicate
 * - edit to [] rejects
 *
 * Pattern: fake-indexeddb inject ke globalThis SEBELUM dynamic import ./db
 * (dexie cache indexedDB saat load, sama seperti src/db/db.test.ts)
 *
 * Run: bun test src/db/seed.test.ts --reporter=verbose
 */

import { describe, expect, test, beforeEach } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

const { InventoryDB, DexieRepository, ValidationError } = await import("./db");
const { InventarisDexie, DexieInventoryRepository } = await import("./dexieRepository");
const { seedDefaultKategoris } = await import("./seed");

type Repo = import("./db").InventoryRepository;
type InventoryRepoCtor = new (d: import("./db").InventoryDB) => Repo;
const RepoCtor = DexieRepository as unknown as InventoryRepoCtor;

let repo: Repo;

beforeEach(async () => {
  const testDb = new InventoryDB(`test-seed-${crypto.randomUUID()}`);
  repo = new RepoCtor(testDb);
});

describe("seedDefaultKategoris", () => {
  test("seed creates 3 kategori each [7,3,1]", async () => {
    await seedDefaultKategoris(repo);
    const list = await repo.listKategoris();
    expect(list).toHaveLength(3);

    const names = list.map((k) => k.nama).sort();
    expect(names).toEqual(["Beras", "Dairy", "Snack"]);

    for (const k of list) {
      expect(k.threshold_h_minus).toEqual([7, 3, 1]);
      // org_id default sync-ready sharding
      expect(k.org_id).toBe("toko-01");
    }
  });

  test("idempotent: seed twice does not duplicate", async () => {
    await seedDefaultKategoris(repo);
    await seedDefaultKategoris(repo);
    const list = await repo.listKategoris();
    expect(list).toHaveLength(3);
  });

  test("seeds string-id real repository with default org", async () => {
    const realDb = new InventarisDexie(`test-real-seed-${crypto.randomUUID()}`);
    const realRepo = new DexieInventoryRepository(realDb);

    await seedDefaultKategoris(realRepo);
    const kategori = (await realRepo.listKategoris("toko-01"))[0];
    await realRepo.createSku({
      id: "sku-1",
      nama: "Susu",
      kategori_id: kategori.id,
      hpp: 1000,
      harga_normal: 1200,
      org_id: "toko-01",
    });
    await realRepo.createBatch({
      id: "batch-1",
      sku_id: "sku-1",
      qty: 1,
      expiry_date: "2026-09-05",
      received_at: "2026-09-03T00:00:00.000Z",
      hpp_snapshot: 1000,
      org_id: "toko-01",
    });

    expect(await realRepo.listBatchesBySku("sku-1", "toko-01")).toHaveLength(1);
    await realRepo.setAdvisorCache({
      id: "cache-1",
      org_id: "toko-01",
      batch_id: "batch-1",
      suggestion: {
        batch_id: "batch-1",
        aksi: "tebus_murah",
        alasan: "H-3",
        pasangan_tebus_murah: null,
        harga_tebus: 900,
        estimasi_margin: 0,
        confidence: "Tinggi",
        created_at: "2026-09-03T00:00:00.000Z",
      },
      created_at: "2026-09-03T00:00:00.000Z",
    });
    expect((await realRepo.getAdvisorCache("batch-1", "toko-01"))?.id).toBe("cache-1");
    await realRepo.clearAll();
    expect(await realRepo.listKategoris("toko-01")).toHaveLength(0);
    expect(await realRepo.listBatchesBySku("sku-1", "toko-01")).toHaveLength(0);
    await realDb.delete();
  });

  test("edit to [14,7,3] succeeds (editable threshold)", async () => {
    await seedDefaultKategoris(repo);
    const list = await repo.listKategoris();
    const dairy = list.find((k) => k.nama === "Dairy")!;
    expect(dairy).toBeDefined();

    const updated = await repo.updateKategoriThreshold(dairy.id!, [14, 7, 3]);
    expect(updated.threshold_h_minus).toEqual([14, 7, 3]);

    const got = await repo.getKategori(dairy.id!);
    expect(got?.threshold_h_minus).toEqual([14, 7, 3]);
  });

  test("edit to [3,3,1] rejects duplicate", async () => {
    await seedDefaultKategoris(repo);
    const list = await repo.listKategoris();
    const snack = list.find((k) => k.nama === "Snack")!;
    await expect(repo.updateKategoriThreshold(snack.id!, [3, 3, 1])).rejects.toThrow(ValidationError);
    await expect(repo.updateKategoriThreshold(snack.id!, [3, 3, 1])).rejects.toThrow("tidak boleh sama");
  });

  test("edit to [] rejects (tidak boleh kosong)", async () => {
    await seedDefaultKategoris(repo);
    const list = await repo.listKategoris();
    const beras = list.find((k) => k.nama === "Beras")!;
    await expect(repo.updateKategoriThreshold(beras.id!, [])).rejects.toThrow(ValidationError);
    await expect(repo.updateKategoriThreshold(beras.id!, [])).rejects.toThrow("tidak boleh kosong");
  });
});
