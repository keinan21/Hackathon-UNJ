/**
 * TASK-18 + TASK-24 acceptance: backupService.test.ts v2
 * export -> import roundtrip restores SKU/Batch count + kode/tags/transaksis/hpp_history, wrong PIN decrypt fails, header v2
 * Run: bun test src/features/backup/backupService.test.ts
 * DUAL-RUNNER isolation-safe: fake-indexeddb inject TOP + fetch/onLine/timers save-restore + localStorage polyfill guarded
 */
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

// fake-indexeddb must be injected before Dexie loads
const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

if (typeof localStorage === "undefined") {
  const _store = new Map<string, string>();
  const _ls: Storage = {
    get length() { return _store.size; },
    clear() { _store.clear(); },
    getItem(key: string) { return _store.get(key) ?? null; },
    key(index: number) { const keys = Array.from(_store.keys()); return keys[index] ?? null; },
    removeItem(key: string) { _store.delete(key); },
    setItem(key: string, value: string) { _store.set(String(key), String(value)); },
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = _ls;
  if (typeof window !== "undefined") (window as unknown as { localStorage: Storage }).localStorage = _ls;
}

const __origFetch = (globalThis as unknown as { fetch?: typeof fetch }).fetch;
const __origOnLineVal: boolean | undefined =
  typeof navigator !== "undefined" ? (navigator as unknown as { onLine?: boolean }).onLine : (globalThis as unknown as { navigator?: { onLine?: boolean } }).navigator?.onLine;

const { exportEncryptedBackup, importEncryptedBackup, buildPlainPayload, shouldShowBackupReminder, backupToDriveHook, BACKUP_VERSION } = await import("./backupService");
const { DexieRepository } = await import("../../db/db");
const { realRepo, dexieV2 } = await import("../../db/dexieRepository");

let repo: InstanceType<typeof DexieRepository>;

beforeEach(async () => {
  const { db: singleton } = await import("../../db/db");
  await singleton.skus.clear().catch(() => {});
  await singleton.kategoris.clear().catch(() => {});
  await singleton.batches.clear().catch(() => {});
  await singleton.transaksis.clear().catch(() => {});
  await singleton.promos.clear().catch(() => {});
  await singleton.advisorCache.clear().catch(() => {});
  try { await (singleton as unknown as { tags: { clear():Promise<void> } }).tags.clear(); } catch {}
  try { await (singleton as unknown as { sku_tags: { clear():Promise<void> } }).sku_tags.clear(); } catch {}
  try { await (singleton as unknown as { hpp_history: { clear():Promise<void> } }).hpp_history.clear(); } catch {}
  // also clear dexieV2
  try { await dexieV2.skus.clear(); } catch {}
  try { await dexieV2.kategoris.clear(); } catch {}
  try { await dexieV2.batches.clear(); } catch {}
  try { await dexieV2.transaksis.clear(); } catch {}
  try { await dexieV2.promos.clear(); } catch {}
  try { await dexieV2.advisorCache.clear(); } catch {}
  try { await dexieV2.tags.clear(); } catch {}
  try { await dexieV2.sku_tags.clear(); } catch {}
  try { await dexieV2.hpp_history.clear(); } catch {}
  if (typeof window !== "undefined") window.localStorage.removeItem("lastBackupAt-v1");
  else (globalThis as unknown as { localStorage: Storage }).localStorage.removeItem("lastBackupAt-v1");
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (__origFetch as unknown as typeof fetch) ?? (async () => ({ ok: true } as Response));
  const navTarget = typeof navigator !== "undefined" ? (navigator as unknown as Record<string, unknown>) : ((globalThis as unknown as { navigator?: Record<string, unknown> }).navigator ?? ((globalThis as unknown as Record<string, unknown>).navigator = {}));
  try { Object.defineProperty(navTarget, "onLine", { value: true, configurable: true, writable: true }); } catch { (navTarget as Record<string, unknown>).onLine = true; }
  repo = new DexieRepository(singleton);
  if (typeof window !== "undefined") window.localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Backup Test", updated_at: new Date().toISOString() }));
  else (globalThis as unknown as { localStorage: Storage }).localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Backup Test", updated_at: new Date().toISOString() }));
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (__origFetch) (globalThis as unknown as { fetch: typeof fetch }).fetch = __origFetch;
  else { try { delete (globalThis as unknown as { fetch?: unknown }).fetch; } catch {} }
  const navTarget = typeof navigator !== "undefined" ? (navigator as unknown as Record<string, unknown>) : (globalThis as unknown as { navigator?: Record<string, unknown> }).navigator;
  if (navTarget) {
    const restoreVal = __origOnLineVal ?? true;
    try { Object.defineProperty(navTarget, "onLine", { value: restoreVal, configurable: true, writable: true }); } catch { (navTarget as Record<string, unknown>).onLine = restoreVal; }
  }
});

describe("TASK-18+24 Backup/Restore v2", () => {
  test("export -> import roundtrip restores SKU/Batch count v2", async () => {
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
    expect(parsed.header.version).toBe(2);
    expect(parsed.ciphertext).toBeDefined();
    expect(BACKUP_VERSION).toBe(2);

    const { db: singleton } = await import("../../db/db");
    await singleton.skus.clear();
    await singleton.batches.clear();
    expect(await singleton.skus.count()).toBe(0);

    const payload = await importEncryptedBackup(file, "1234");
    expect(payload.version).toBe(2);
    expect(payload.tables.skus.length).toBe(2);
    expect(payload.tables.batches.length).toBe(3);
    expect(payload.tables.tags).toBeDefined();
    expect(payload.tables.hpp_history).toBeDefined();
    expect(payload.meta.profil_toko).toBe("Toko Backup Test");

    const afterSkus = await singleton.skus.count();
    const afterBatches = await singleton.batches.count();
    expect(afterSkus).toBe(2);
    expect(afterBatches).toBe(3);
  });

  test("v2 includes kode/tags/transaksis/hpp_history", async () => {
    const k = await repo.createKategori({ nama: "Snack", threshold_h_minus: [14, 7, 3] });
    const sku = await repo.createSKU({ nama: "Keripik", kategori_id: k.id!, hpp: 5000, harga_normal: 8000 });
    // sku has kode generated
    expect(sku.kode).toBeDefined();
    await realRepo.createSku({ id: "sku-kode-1", nama: "SKU Kode", kategori_id: k.id!.toString(), hpp: 6000, harga_normal: 9000, kode: "KOD-001", org_id: "toko-01" }).catch(() => {});
    await dexieV2.tags.put({ id: "tag-1", nama: "Promo", org_id: "toko-01" }).catch(() => {});
    await dexieV2.hpp_history.put({ id: "hpp-1", sku_id: "sku-kode-1", hpp_lama: 5000, hpp_baru: 6000, created_at: new Date().toISOString(), org_id: "toko-01" }).catch(() => {});
    await dexieV2.transaksis.put({ id: "trx-1", sku_id: "sku-kode-1", qty_sold: 2, sold_at: new Date().toISOString(), org_id: "toko-01", jenis: "keluar", harga_jual_snapshot: 9000 }).catch(() => {});

    const payload = await buildPlainPayload("toko-01");
    expect(payload.version).toBe(2);
    expect(payload.tables.skus.some((s) => (s as { kode?: string }).kode === "KOD-001")).toBe(true);
    expect(payload.tables.tags.length).toBeGreaterThan(0);
    expect(payload.tables.hpp_history.length).toBeGreaterThan(0);
    expect(payload.tables.transaksis.length).toBeGreaterThan(0);
    // transaksis includes jenis field
    const trx = payload.tables.transaksis[0] as { jenis?: string };
    expect(trx.jenis).toBeDefined();
  });

  test("threshold valid [14,7,3] tersimpan via updateKategoriThreshold in backup roundtrip", async () => {
    const k = await repo.createKategori({ nama: "Makanan Basah", threshold_h_minus: [7, 3, 1] });
    await repo.updateKategoriThreshold(k.id!, [14, 7, 3]);
    const file = await exportEncryptedBackup("1234");
    await repo.updateKategoriThreshold(k.id!, [7, 3, 1]); // mutate
    const payload = await importEncryptedBackup(file, "1234");
    const restoredKat = (payload.tables.kategoris as { id: number; threshold_h_minus: number[] }[]).find((x) => x.id === k.id);
    expect(restoredKat?.threshold_h_minus).toEqual([14, 7, 3]);
  });

  test("threshold invalid [3,3,1] → Angka tidak boleh sama", async () => {
    const k = await repo.createKategori({ nama: "Rokok", threshold_h_minus: [7, 3, 1] });
    await expect(repo.updateKategoriThreshold(k.id!, [3, 3, 1])).rejects.toThrow("Angka tidak boleh sama");
  });

  test("threshold invalid naik [1,3,7] → Harus menurun", async () => {
    const k = await repo.createKategori({ nama: "Misc", threshold_h_minus: [7, 3, 1] });
    await expect(repo.updateKategoriThreshold(k.id!, [1, 3, 7])).rejects.toThrow("Harus menurun");
  });

  test("wrong PIN decrypt fails with PIN salah", async () => {
    const k = await repo.createKategori({ nama: "Snack2", threshold_h_minus: [7, 3, 1] });
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

  test("header v2 contains salt 16b and version 2", async () => {
    const file = await exportEncryptedBackup("1234");
    const { header } = JSON.parse(file);
    expect(header.version).toBe(2);
    expect(header.salt).toBeDefined();
    expect(header.iv).toBeDefined();
    expect(header.salt.length).toBeGreaterThan(10);
    expect(header.iv.length).toBeGreaterThan(10);
    expect(header.org_id).toBe("toko-01");
  });

  test("shouldShowBackupReminder >7 days", async () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("lastBackupAt-v1");
    else (globalThis as unknown as { localStorage: Storage }).localStorage.removeItem("lastBackupAt-v1");
    expect(shouldShowBackupReminder()).toBe(true);
  });
});
