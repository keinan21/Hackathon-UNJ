/**
 * TASK-19 QA — bun test src/advisor/guardrail.test.ts
 * - floor HPP*0.85 tetap, per-jenis promo guardrail
 * - tebus & diskon: harga >= HPP*0.85
 * - bundling: total paket >= ΣHPP*0.85
 * - BOGO: harga_normal/2 >= HPP*0.85
 * - cashback: margin − cashback >= 0 + floor tetap
 * - ngarang ditolak
 * - isolation-safe dual-runner: fake-indexeddb inject + fetch/onLine/timers save-restore
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateHargaTebus, isHargaTebusValid } from '../lib/validation';
import * as fakeIndexedDB from 'fake-indexeddb';

const __g = globalThis as unknown as Record<string, unknown>;
if (!__g.indexedDB) {
  __g.indexedDB = fakeIndexedDB.indexedDB;
  __g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

if (typeof localStorage === 'undefined') {
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
  if (typeof window !== 'undefined') {
    (window as unknown as { localStorage: Storage }).localStorage = _ls;
  }
}

if (typeof (vi as unknown as { setSystemTime?: unknown }).setSystemTime !== 'function') {
  const _origNow = Date.now;
  let _mocked: number | null = null;
  (vi as unknown as { setSystemTime: (d: Date) => void }).setSystemTime = (d: Date) => {
    _mocked = d.getTime();
    (Date as unknown as { now: () => number }).now = () => _mocked as number;
  };
  const _origUseReal = vi.useRealTimers.bind(vi);
  (vi as unknown as { useRealTimers: () => void }).useRealTimers = () => {
    if (_mocked !== null) { (Date as unknown as { now: () => number }).now = _origNow; _mocked = null; }
    return _origUseReal();
  };
  const _origAdvance = vi.advanceTimersByTime.bind(vi);
  (vi as unknown as { advanceTimersByTime: (ms: number) => void }).advanceTimersByTime = (ms: number) => {
    if (_mocked !== null) { _mocked += ms; (Date as unknown as { now: () => number }).now = () => _mocked as number; }
    return _origAdvance(ms);
  };
}

const __origFetch = (globalThis as unknown as { fetch?: typeof fetch }).fetch;
const __origOnLineVal: boolean | undefined =
  typeof navigator !== 'undefined'
    ? (navigator as unknown as { onLine?: boolean }).onLine
    : (globalThis as unknown as { navigator?: { onLine?: boolean } }).navigator?.onLine;

describe('Guardrail & validation tests (HPP, harga, LLM angka)', () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const navTarget =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as Record<string, unknown>)
        : ((globalThis as unknown as { navigator?: Record<string, unknown> }).navigator ?? ((globalThis as unknown as Record<string, unknown>).navigator = {}));
    try { Object.defineProperty(navTarget, 'onLine', { value: true, configurable: true, writable: true }); } catch { (navTarget as Record<string, unknown>).onLine = true; }
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T07:00:00+07:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (__origFetch) { (globalThis as unknown as { fetch: typeof fetch }).fetch = __origFetch; } else { try { delete (globalThis as unknown as { fetch?: unknown }).fetch; } catch {} }
    const navTarget =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as Record<string, unknown>)
        : (globalThis as unknown as { navigator?: Record<string, unknown> }).navigator;
    if (navTarget) {
      const restoreVal = __origOnLineVal ?? true;
      try { Object.defineProperty(navTarget, 'onLine', { value: restoreVal, configurable: true, writable: true }); } catch { (navTarget as Record<string, unknown>).onLine = restoreVal; }
    }
  });

  it('floor pass at 0.85', () => {
    const r = validateHargaTebus(10000, 8500, 15000);
    expect(r.valid).toBe(true);
    expect(isHargaTebusValid(10000, 8500)).toBe(true);
  });

  it('floor fail at 0.84 → throws', () => {
    const r = validateHargaTebus(10000, 8400, 15000);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/HPP x 0.85/);
    expect(isHargaTebusValid(10000, 8400)).toBe(false);
  });

  it('HPP >0, harga_tebus not NaN, LLM output must not contain angka harga if not from DB (mock check)', () => {
    const r1 = validateHargaTebus(0, 9000);
    expect(r1.valid).toBe(false);
    const r2 = validateHargaTebus(10000, NaN);
    expect(r2.valid).toBe(false);
    const r3 = validateHargaTebus(10000, 9000);
    expect(r3.valid).toBe(true);
    const llmHarga = 5000;
    const guard = isHargaTebusValid(10000, llmHarga);
    expect(guard).toBe(false);
  });

  it('optional ceiling harga_normal*0.5 if enabled configurable', () => {
    const r = validateHargaTebus(10000, 8000, 15000, { ceilingEnabled: true, ceilingRatio: 0.5 });
    const r2 = validateHargaTebus(10000, 9000, 15000, { ceilingEnabled: true, ceilingRatio: 0.5 });
    expect(r2.valid).toBe(true);
    const r3 = validateHargaTebus(10000, 16000, 15000);
    expect(r3.valid).toBe(true);
    expect(r3.warning).toBeDefined();
  });

  it('HPP 10000 floor 8500 edge cases', () => {
    expect(isHargaTebusValid(10000, 8500)).toBe(true);
    expect(isHargaTebusValid(10000, 8499.99)).toBe(false);
    expect(isHargaTebusValid(10000, 8500.01)).toBe(true);
  });

  it('comprehensive 4 guard cases pass, LLM mock that tries to ngarang harga fails', () => {
    expect(validateHargaTebus(10000, 8500).valid).toBe(true);
    expect(validateHargaTebus(0, 9000).valid).toBe(false);
    expect(validateHargaTebus(10000, NaN).valid).toBe(false);
    expect(validateHargaTebus(12000, 10500).valid).toBe(true);
    const mockLLMPrice = 8400;
    expect(isHargaTebusValid(10000, mockLLMPrice)).toBe(false);
  });
});

// TASK-19 multi-jenis promo guardrail
describe('TASK-19 guardrail per-jenis promo', () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const navTarget =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as Record<string, unknown>)
        : ((globalThis as unknown as { navigator?: Record<string, unknown> }).navigator ?? ((globalThis as unknown as Record<string, unknown>).navigator = {}));
    try { Object.defineProperty(navTarget, 'onLine', { value: true, configurable: true, writable: true }); } catch { (navTarget as Record<string, unknown>).onLine = true; }
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T07:00:00+07:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (__origFetch) { (globalThis as unknown as { fetch: typeof fetch }).fetch = __origFetch; } else { try { delete (globalThis as unknown as { fetch?: unknown }).fetch; } catch {} }
    const navTarget =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as Record<string, unknown>)
        : (globalThis as unknown as { navigator?: Record<string, unknown> }).navigator;
    if (navTarget) {
      const restoreVal = __origOnLineVal ?? true;
      try { Object.defineProperty(navTarget, 'onLine', { value: restoreVal, configurable: true, writable: true }); } catch { (navTarget as Record<string, unknown>).onLine = restoreVal; }
    }
  });

  it('tebus lolos — harga >= HPP*0.85', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const floor = Math.round(10000 * 0.85);
    const r = validatePromoUsul('tebus', { hpp: 10000, harga_tebus: 8500, harga_normal: 15000 });
    expect(r.valid).toBe(true);
    // exact floor message check on near floor
    const r2 = validatePromoUsul('tebus', { hpp: 10000, harga_tebus: 9000 });
    expect(r2.valid).toBe(true);
    expect(floor).toBe(8500);
  });

  it('tebus tolak — harga < floor', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const r = validatePromoUsul('tebus', { hpp: 10000, harga_tebus: 8400 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/HPP x 0\.85/);
    expect(r.error).toContain('8.500');
  });

  it('diskon lolos — harga >= HPP*0.85', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const r = validatePromoUsul('diskon', { hpp: 12000, harga_tebus: 10500, harga_normal: 15000 });
    expect(r.valid).toBe(true);
  });

  it('diskon tolak — harga < floor', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const r = validatePromoUsul('diskon', { hpp: 12000, harga_tebus: 10000 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/HPP x 0\.85/);
    expect(r.error).toContain('10.200');
  });

  it('bundling lolos — total paket >= ΣHPP*0.85', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    // ΣHPP = 18000 floor 15300
    const r = validatePromoUsul('bundling', { hppList: [10000, 8000], total_paket: 16000 });
    expect(r.valid).toBe(true);
  });

  it('bundling tolak — total < ΣHPP*0.85', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const r = validatePromoUsul('bundling', { hppList: [10000, 8000], total_paket: 15000 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/HPP x 0\.85/);
    expect(r.error).toContain('15.300');
  });

  it('BOGO lolos — harga_normal/2 >= HPP*0.85', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const r = validatePromoUsul('bogo', { hpp: 10000, harga_normal: 20000 });
    expect(r.valid).toBe(true);
  });

  it('BOGO tolak — harga_normal/2 < floor', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const r = validatePromoUsul('bogo', { hpp: 10000, harga_normal: 16000 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/HPP x 0\.85/);
    // 16000/2=8000 <8500 floor
    expect(r.error).toContain('8.500');
  });

  it('cashback lolos — margin − cashback >= 0 + floor', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const r = validatePromoUsul('cashback', { hpp: 10000, harga_tebus: 9000, harga_normal: 15000, margin: 5000, cashback: 3000 });
    expect(r.valid).toBe(true);
  });

  it('cashback tolak — margin − cashback < 0', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    const r = validatePromoUsul('cashback', { hpp: 10000, harga_tebus: 9000, harga_normal: 15000, margin: 2000, cashback: 3000 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/cashback/i);
  });

  it('ngarang ditolak — harga di bawah floor walau LLM ngarang', async () => {
    const { validatePromoUsul } = await import('../lib/validation');
    // LLM ngarang harga 5000 untuk HPP 10000 (jauh di bawah floor 8500) harus ditolak
    const r = validatePromoUsul('tebus', { hpp: 10000, harga_tebus: 5000 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/HPP x 0\.85/);
    expect(r.error).toContain('8.500');
    // juga untuk diskon ngarang
    const r2 = validatePromoUsul('diskon', { hpp: 10000, harga_tebus: 4000 });
    expect(r2.valid).toBe(false);
  });
});
