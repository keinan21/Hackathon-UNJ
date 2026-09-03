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
  test("3 parallel seed on empty → exactly 3 rows, no duplicates", async () => {
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
    expect(rows).toHaveLength(3);
    const names = rows.map((r) => r.nama).sort();
    expect(names).toEqual(["Beras", "Dairy", "Snack"]);
    expect(new Set(rows.map((r) => r.nama)).size).toBe(3);

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
    expect(rows).toHaveLength(3);

    db.close();
  });
});
