/**
 * TASK-18 QA — bun test src/engine/omzet.test.ts
 * - omzet = jual×qty exact Rp, margin = omzet−HPP, cashflow = omzet−belanja
 * - tanpa transaksi → nol semua, window 14d memotong data lama
 * - pure deterministik, tanpa Dexie/LLM/fetch diPath hitung
 * - isolation-safe untuk dual-runner: fake-indexeddb inject, fetch/onLine/timers save-restore
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calcOmzet14, build14DaysSetJakarta, formatJakartaYMD } from "./omzet";
import * as fakeIndexedDB from "fake-indexeddb";

// fake-indexeddb inject di TOP sebelum import modul Dexie (pola src/db/db.test.ts:17-28)
const __g = globalThis as unknown as Record<string, unknown>;
if (!__g.indexedDB) {
  __g.indexedDB = fakeIndexedDB.indexedDB;
  __g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

if (typeof localStorage === "undefined") {
  const _store = new Map<string, string>();
  const _ls: Storage = {
    get length() {
      return _store.size;
    },
    clear() {
      _store.clear();
    },
    getItem(key: string) {
      return _store.get(key) ?? null;
    },
    key(index: number) {
      const keys = Array.from(_store.keys());
      return keys[index] ?? null;
    },
    removeItem(key: string) {
      _store.delete(key);
    },
    setItem(key: string, value: string) {
      _store.set(String(key), String(value));
    },
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = _ls;
  if (typeof window !== "undefined") {
    (window as unknown as { localStorage: Storage }).localStorage = _ls;
  }
}

if (typeof (vi as unknown as { setSystemTime?: unknown }).setSystemTime !== "function") {
  const _origNow = Date.now;
  let _mocked: number | null = null;
  (vi as unknown as { setSystemTime: (d: Date) => void }).setSystemTime = (d: Date) => {
    _mocked = d.getTime();
    (Date as unknown as { now: () => number }).now = () => _mocked as number;
  };
  const _origUseReal = vi.useRealTimers.bind(vi);
  (vi as unknown as { useRealTimers: () => void }).useRealTimers = () => {
    if (_mocked !== null) {
      (Date as unknown as { now: () => number }).now = _origNow;
      _mocked = null;
    }
    return _origUseReal();
  };
  const _origAdvance = vi.advanceTimersByTime.bind(vi);
  (vi as unknown as { advanceTimersByTime: (ms: number) => void }).advanceTimersByTime = (ms: number) => {
    if (_mocked !== null) {
      _mocked += ms;
      (Date as unknown as { now: () => number }).now = () => _mocked as number;
    }
    return _origAdvance(ms);
  };
}

const __origFetch = (globalThis as unknown as { fetch?: typeof fetch }).fetch;
const __origOnLineVal: boolean | undefined =
  typeof navigator !== "undefined"
    ? (navigator as unknown as { onLine?: boolean }).onLine
    : (globalThis as unknown as { navigator?: { onLine?: boolean } }).navigator?.onLine;

// Helper: buat ISO untuk tanggal Jakarta tertentu (agar deterministik)
// today Jakarta 2026-09-04 07:00, transaksi sold_at bisa pakai Date dengan offset +07
function jakartaISO(ymd: string, time = "10:00:00"): string {
  // ymd YYYY-MM-DD → ISO di Asia/Jakarta
  return `${ymd}T${time}+07:00`;
}

describe("omzet engine — TASK-18 pure deterministik", () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const navTarget =
      typeof navigator !== "undefined"
        ? (navigator as unknown as Record<string, unknown>)
        : ((globalThis as unknown as { navigator?: Record<string, unknown> }).navigator ??
          ((globalThis as unknown as Record<string, unknown>).navigator = {}));
    try {
      Object.defineProperty(navTarget, "onLine", { value: true, configurable: true, writable: true });
    } catch {
      (navTarget as Record<string, unknown>).onLine = true;
    }
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T07:00:00+07:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (__origFetch) {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = __origFetch;
    } else {
      try {
        delete (globalThis as unknown as { fetch?: unknown }).fetch;
      } catch {}
    }
    const navTarget =
      typeof navigator !== "undefined"
        ? (navigator as unknown as Record<string, unknown>)
        : (globalThis as unknown as { navigator?: Record<string, unknown> }).navigator;
    if (navTarget) {
      const restoreVal = __origOnLineVal ?? true;
      try {
        Object.defineProperty(navTarget, "onLine", { value: restoreVal, configurable: true, writable: true });
      } catch {
        (navTarget as Record<string, unknown>).onLine = restoreVal;
      }
    }
  });

  it("omzet = harga_jual × qty keluar exact Rp", () => {
    const today = new Date("2026-09-04T07:00:00+07:00");
    const transaksis = [
      { sku_id: 1, qty_sold: 2, sold_at: jakartaISO("2026-09-03"), jenis: "keluar", harga_jual_snapshot: 15000 },
      { sku_id: 1, qty_sold: 3, sold_at: jakartaISO("2026-09-04"), jenis: "keluar", harga_jual_snapshot: 15000 },
    ];
    const result = calcOmzet14(transaksis as any, [], today);
    // 2*15000 + 3*15000 = 75000
    expect(result.omzet).toBe(75000);
  });

  it("margin = omzet − Σ HPP terjual (hpp_snapshot × qty)", () => {
    const today = new Date("2026-09-04T07:00:00+07:00");
    const transaksis = [
      { sku_id: 1, qty_sold: 2, sold_at: jakartaISO("2026-09-03"), jenis: "keluar", harga_jual_snapshot: 15000, hpp_snapshot: 10000 },
      { sku_id: 1, qty_sold: 1, sold_at: jakartaISO("2026-09-04"), jenis: "keluar", harga_jual_snapshot: 20000, hpp_snapshot: 12000 },
    ];
    const result = calcOmzet14(transaksis as any, [], today);
    // omzet = 2*15000 +1*20000=50000, hppTerjual=2*10000+1*12000=32000, margin=18000
    expect(result.omzet).toBe(50000);
    expect(result.margin).toBe(18000);
  });

  it("cashflow = omzet − Σ harga_beli masuk (dari batch hpp_snapshot fallback)", () => {
    const today = new Date("2026-09-04T07:00:00+07:00");
    const nowIso = jakartaISO("2026-09-03", "09:00:00");
    const batches = [
      { id: 1, sku_id: 1, qty: 10, hpp_snapshot: 8000, received_at: nowIso, expiry_date: "2026-09-10", org_id: "toko-01" },
    ];
    const transaksis = [
      { sku_id: 1, qty_sold: 10, sold_at: nowIso, jenis: "masuk" } as any,
      { sku_id: 1, qty_sold: 2, sold_at: jakartaISO("2026-09-03"), jenis: "keluar", harga_jual_snapshot: 15000, hpp_snapshot: 8000 },
    ];
    const result = calcOmzet14(transaksis as any, batches as any, today);
    // belanja =10*8000=80000, omzet=2*15000=30000, cashflow=30000-80000=-50000
    expect(result.belanja).toBe(80000);
    expect(result.omzet).toBe(30000);
    expect(result.cashflow).toBe(-50000);
    // margin = 30000 - 2*8000=14000
    expect(result.margin).toBe(14000);
  });

  it("tanpa transaksi → nol semua", () => {
    const today = new Date("2026-09-04T07:00:00+07:00");
    const result = calcOmzet14([], [], today);
    expect(result.omzet).toBe(0);
    expect(result.margin).toBe(0);
    expect(result.cashflow).toBe(0);
    expect(result.belanja).toBe(0);
  });

  it("window 14 hari memotong data lama (20 hari lalu tidak dihitung)", () => {
    const today = new Date("2026-09-04T07:00:00+07:00");
    const transaksis = [
      // dalam window (13 hari lalu = 2026-08-22, masuk window)
      { sku_id: 1, qty_sold: 5, sold_at: jakartaISO("2026-08-22"), jenis: "keluar", harga_jual_snapshot: 10000 },
      // di luar window (20 hari lalu = 2026-08-15)
      { sku_id: 1, qty_sold: 100, sold_at: jakartaISO("2026-08-15"), jenis: "keluar", harga_jual_snapshot: 10000 },
    ];
    const result = calcOmzet14(transaksis as any, [], today);
    // hanya 5*10000=50000 yang dihitung
    expect(result.omzet).toBe(50000);
  });

  it("masuk enrichment langsung hpp_snapshot tanpa batches tetap hitung belanja", () => {
    const today = new Date("2026-09-04T07:00:00+07:00");
    const transaksis = [
      { sku_id: 1, qty_sold: 4, sold_at: jakartaISO("2026-09-02"), jenis: "masuk", hpp_snapshot: 5000 } as any,
      { sku_id: 1, qty_sold: 1, sold_at: jakartaISO("2026-09-02"), jenis: "keluar", harga_jual_snapshot: 10000 } as any,
    ];
    const result = calcOmzet14(transaksis as any, [], today);
    expect(result.belanja).toBe(20000);
    expect(result.cashflow).toBe(10000 - 20000); // -10000
  });

  it("campur keluar+masuk 14d batas inklusif hari ini", () => {
    const today = new Date("2026-09-04T07:00:00+07:00");
    const transaksis = [
      { sku_id: 1, qty_sold: 1, sold_at: jakartaISO("2026-09-04"), jenis: "keluar", harga_jual_snapshot: 12000, hpp_snapshot: 10000 },
      { sku_id: 2, qty_sold: 2, sold_at: jakartaISO("2026-09-04"), jenis: "masuk", hpp_snapshot: 6000 } as any,
    ];
    const result = calcOmzet14(transaksis as any, [], today);
    expect(result.omzet).toBe(12000);
    expect(result.margin).toBe(2000);
    expect(result.belanja).toBe(12000);
    expect(result.cashflow).toBe(0);
  });

  it("helper build14DaysSetJakarta berisi 14 tanggal dan mencakup today", () => {
    const today = new Date("2026-09-04T07:00:00+07:00");
    const set = build14DaysSetJakarta(today);
    expect(set.size).toBe(14);
    expect(set.has(formatJakartaYMD(today))).toBe(true);
    expect(set.has("2026-08-22")).toBe(true); // 13 hari sebelum 09-04
    expect(set.has("2026-08-21")).toBe(false); // 14 hari sebelum → di luar
  });
});
