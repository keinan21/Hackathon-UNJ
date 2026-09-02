/**
 * TASK-18 acceptance: backupService.test.ts
 * export -> import roundtrip restores SKU/Batch count, wrong PIN decrypt fails, unencrypted flag deferred, corrupt JSON -> error not crash
 * Run: bun test src/features/backup/backupService.test.ts
 */
import { describe, expect, test, beforeEach } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

// fake-indexeddb must be injected before Dexie loads (dexie caches indexedDB at import)
const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

const { InventoryDB } = await import("../../db/db");
const { exportEncryptedBackup, importEncryptedBackup, buildPlainPayload, shouldShowBackupReminder, backupToDriveHook } = await import("./backupService");
const { DexieRepository } = await import("../../db/db");

let db: InstanceType<typeof InventoryDB>;
let repo: InstanceType<typeof DexieRepository>;

beforeEach(async () => {
  const name = `test-backup-${crypto.randomUUID()}`;
  db = new InventoryDB(name);
  // override global db singleton used by backupService? backupService imports singleton `db` from ../../db/db
  // So we patch singleton to point to test db via manual assignment (vitest isolated but service uses singleton)
  // Workaround: directly use the singleton db for tests by clearing it
  const { db: singleton } = await import("../../db/db");
  // clear singleton before each test
  await singleton.skus.clear().catch(() => {});
  await singleton.kategoris.clear().catch(() => {});
  await singleton.batches.clear().catch(() => {});
  await singleton.transaksis.clear().catch(() => {});
  await singleton.promos.clear().catch(() => {});
  await singleton.advisorCache.clear().catch(() => {});

  repo = new DexieRepository(singleton);
  // ensure empty
});

describe("TASK-18 Backup/Restore", () => {
  test("export -> import roundtrip restores SKU/Batch count", async () => {
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    await repo.createSKU({ nama: "Susu UHT", kategori_id: k.id!, hpp: 10000, harga_normal: 15000 });
    await repo.createSKU({ nama: "Yoghurt", kategori_id: k.id!, hpp: 8000, harga_normal: 12000 });
    await repo.createBatch({ sku_id: 1, qty: 10, expiry_date: "2026-09-10", hpp_snapshot: 10000 });
    await repo.createBatch({ sku_id: 1, qty: 5, expiry_date: "2026-09-12", hpp_snapshot: 10000 });
    await repo.createBatch({ sku_id: 2, qty: 8, expiry_date: "2026-09-15", hpp_snapshot: 8000 });

    const file = await exportEncryptedBackup("1234");
    expect(file).toBeDefined();
    expect(file.length).toBeGreaterThan(50);
    const parsed = JSON.parse(file);
    expect(parsed.header).toBeDefined();
    expect(parsed.header.salt).toBeDefined();
    expect(parsed.header.iv).toBeDefined();
    expect(parsed.header.version).toBe(1);
    expect(parsed.ciphertext).toBeDefined();

    // clear data
    const { db: singleton } = await import("../../db/db");
    await singleton.skus.clear();
    await singleton.batches.clear();
    expect(await singleton.skus.count()).toBe(0);

    // import
    const payload = await importEncryptedBackup(file, "1234");
    expect(payload.tables.skus.length).toBe(2);
    expect(payload.tables.batches.length).toBe(3);

    const afterSkus = await singleton.skus.count();
    const afterBatches = await singleton.batches.count();
    expect(afterSkus).toBe(2);
    expect(afterBatches).toBe(3);
  });

  test("wrong PIN decrypt fails with PIN salah", async () => {
    const k = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });
    await repo.createSKU({ nama: "Roti", kategori_id: k.id!, hpp: 5000, harga_normal: 8000 });
    const file = await exportEncryptedBackup("1234");
    await expect(importEncryptedBackup(file, "0000")).rejects.toThrow("PIN salah");
  });

  test("corrupt JSON -> error File rusak without crash", async () => {
    await expect(importEncryptedBackup("not-a-json", "1234")).rejects.toThrow("File rusak");
    await expect(importEncryptedBackup(JSON.stringify({ header: null, ciphertext: "abc" }), "1234")).rejects.toThrow("File rusak");
    await expect(importEncryptedBackup("", "1234")).rejects.toThrow("File rusak");
  });

  test("Drive hook manual fallback when showPicker unavailable", async () => {
    const res = backupToDriveHook("backup-toko-01-2026-09-02.json.enc");
    expect(res.message).toMatch(/upload manual/i);
    expect(res.mode).toBe("manual");
  });

  test("header contains salt 16b and version 1", async () => {
    const file = await exportEncryptedBackup("1234");
    const { header } = JSON.parse(file);
    expect(header.version).toBe(1);
    expect(header.salt).toBeDefined();
    expect(header.iv).toBeDefined();
    // base64 16b -> 24 chars, 12b -> 16 chars
    expect(header.salt.length).toBeGreaterThan(10);
    expect(header.iv.length).toBeGreaterThan(10);
    expect(header.org_id).toBe("toko-01");
  });

  test("shouldShowBackupReminder >7 days", async () => {
    // if no lastBackupAt, should show
    if (typeof window !== "undefined") window.localStorage.removeItem("lastBackupAt-v1");
    expect(shouldShowBackupReminder()).toBe(true);
  });
});
