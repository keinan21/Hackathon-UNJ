import { describe, expect, test } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

const { InventoryDB, DexieRepository } = await import("./db");
const { seedDefaultKategoris } = await import("./seed");

function uniqueName() {
  return `test-seed-race-${crypto.randomUUID()}`;
}

describe("seedDefaultKategoris race deduplication", () => {
  test("3 parallel seed on empty → exactly 11 rows, no duplicates", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    await db.open();
    const repo = new DexieRepository(db);

    await Promise.all([
      seedDefaultKategoris(repo as unknown as Parameters<typeof seedDefaultKategoris>[0]),
      seedDefaultKategoris(repo as unknown as Parameters<typeof seedDefaultKategoris>[0]),
      seedDefaultKategoris(repo as unknown as Parameters<typeof seedDefaultKategoris>[0]),
    ]);

    const rows = await repo.listKategoris("toko-01");
    expect(rows).toHaveLength(11);
    const names = rows.map((r) => r.nama).sort();
    expect(names).toEqual(["Bumbu Dapur", "Makanan Basah", "Makanan Frozen", "Makanan Kering", "Minuman Botol", "Minuman Kaleng", "Misc", "Obat Bebas", "Perawatan Diri", "Rokok", "Sembako"]);
    expect(new Set(rows.map((r) => r.nama)).size).toBe(11);

    db.close();
  });

  test("sequential seed remains idempotent", async () => {
    const dbName = uniqueName();
    const db = new InventoryDB(dbName);
    await db.open();
    const repo = new DexieRepository(db);

    await seedDefaultKategoris(repo as unknown as Parameters<typeof seedDefaultKategoris>[0]);
    await seedDefaultKategoris(repo as unknown as Parameters<typeof seedDefaultKategoris>[0]);

    const rows = await repo.listKategoris("toko-01");
    expect(rows).toHaveLength(11);

    db.close();
  });
});
