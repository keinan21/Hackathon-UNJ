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
