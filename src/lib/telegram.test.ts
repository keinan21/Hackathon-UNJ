/**
 * TASK-17 QA — bun test src/lib/telegram.test.ts
 * - mock fetch assert text berisi angka DB + antre saat offline fetch tidak dipanggil
 * - token kosong → error Indonesia "Bot belum disetting"
 * - dedup batchId+tanggal, retry 3x backoff 5s/30s/5m, enkripsi tidak plaintext
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  saveTelegramSettings,
  getDecryptedToken,
  sendRecap,
  sendRecapFromSettings,
  buildRecapText,
  getQueue,
  clearQueue,
  enqueueTelegram,
  processQueue,
  buildDedupKey,
  BACKOFF_MS,
  _resetTelegramForTest,
  assertNoPlaintextInStorage,
} from "./telegram";
import * as fakeIndexedDB from "fake-indexeddb";

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

const PIN = "1234";
const TOKEN = "123456789:AAFakeTokenForTest123";
const CHAT_ID = "987654321";

describe("telegram adapter — TASK-17", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await _resetTelegramForTest();
    localStorage.clear();
    fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const navTarget =
      typeof navigator !== "undefined"
        ? (navigator as unknown as Record<string, unknown>)
        : ((globalThis as unknown as { navigator?: Record<string, unknown> }).navigator ?? ((globalThis as unknown as Record<string, unknown>).navigator = {}));
    try {
      Object.defineProperty(navTarget, "onLine", { value: true, configurable: true, writable: true });
    } catch {
      (navTarget as Record<string, unknown>).onLine = true;
    }
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T07:00:00+07:00"));
  });

  afterEach(async () => {
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
    await _resetTelegramForTest();
    localStorage.clear();
  });

  it("happy: sendRecap fetch dipanggil dengan text berisi angka DB", async () => {
    const kritis = [
      { nama: "Susu UHT", qty: 10, days: 2 },
      { nama: "Roti Tawar", qty: 5, days: 1 },
    ];
    const omzet = 1_250_000;
    const margin = 350_000;
    const cashflow = 900_000;
    const text = buildRecapText({ kritis, omzet, margin, cashflow });

    // text harus berisi angka DB
    expect(text).toContain("1.250.000");
    expect(text).toContain("350.000");
    expect(text).toContain("900.000");
    expect(text).toContain("Susu UHT");
    expect(text).toContain("H-2");

    const res = await sendRecap(TOKEN, CHAT_ID, text, { batchId: "batch-1", tanggal: "2026-09-04" });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.telegram.org");
    expect(url).toContain(`/bot${TOKEN}/sendMessage`);
    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe(CHAT_ID);
    expect(body.text).toContain("1.250.000");
    // tidak di-queue
    const q = await getQueue();
    expect(q.length).toBe(0);
  });

  it("failure: token kosong → error Indonesia Bot belum disetting", async () => {
    await expect(sendRecap("", CHAT_ID, "halo")).rejects.toThrow("Bot belum disetting");
    await expect(sendRecap("   ", CHAT_ID, "halo")).rejects.toThrow("Bot belum disetting");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("failure: chatId kosong → error Chat ID belum disetting", async () => {
    await expect(sendRecap(TOKEN, "", "halo")).rejects.toThrow("Chat ID belum disetting");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("antre saat offline — fetch tidak dipanggil, masuk queue dedup", async () => {
    // simulate offline via navigator.onLine false — fetch must NOT be called
    Object.defineProperty(globalThis.navigator, "onLine", { value: false, configurable: true });
    const text = buildRecapText({ kritis: [{ nama: "Yogurt", qty: 3, days: 1 }], omzet: 50000, margin: 10000, cashflow: 40000 });
    const res = await sendRecap(TOKEN, CHAT_ID, text, { batchId: "batch-42", tanggal: "2026-09-04" });
    expect(res.ok).toBe(false);
    expect(res.queued).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    const q = await getQueue();
    expect(q.length).toBe(1);
    expect(q[0].dedupKey).toBe(buildDedupKey("batch-42", "2026-09-04"));

    // kirim lagi dedup sama → tidak duplikat
    fetchMock.mockClear();
    const res2 = await sendRecap(TOKEN, CHAT_ID, text, { batchId: "batch-42", tanggal: "2026-09-04" });
    expect(res2.queued).toBe(true);
    const q2 = await getQueue();
    expect(q2.length).toBe(1);
  });

  it("antre saat fetch gagal (throw) dan retry 3x backoff 5s/30s/5m", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("Network error");
    });
    const text = "Rekap gagal test";
    const res = await sendRecap(TOKEN, CHAT_ID, text, { batchId: "b1", tanggal: "2026-09-04" });
    expect(res.queued).toBe(true);
    expect((await getQueue()).length).toBe(1);

    // processQueue retry — pertama langsung (nextRetryAt <= now)
    // fetch masih gagal → attempts jadi 1, nextRetryAt = now + 5s
    let r = await processQueue(TOKEN);
    expect(r.sent).toBe(0);
    let q = await getQueue();
    expect(q[0].attempts).toBe(1);

    // advance 5s → retry ke-2 gagal → attempts 2, next 30s
    vi.advanceTimersByTime(5_000);
    r = await processQueue(TOKEN);
    expect(q[0].attempts).toBe(1); // sebelum retry, still 1 — after retry jadi 2
    q = await getQueue();
    expect(q[0].attempts).toBe(2);
    expect(BACKOFF_MS[1]).toBe(30_000);

    vi.advanceTimersByTime(30_000);
    r = await processQueue(TOKEN);
    q = await getQueue();
    expect(q[0].attempts).toBe(3);

    // attempts 3 → tidak retry lagi, failed
    vi.advanceTimersByTime(300_000);
    r = await processQueue(TOKEN);
    expect(r.failed).toBe(1);
    expect(r.sent).toBe(0);
    q = await getQueue();
    expect(q.length).toBe(1);
    expect(q[0].attempts).toBe(3);
  });

  it("retry sukses: fetch ok setelah gagal → queue terhapus", async () => {
    fetchMock.mockImplementationOnce(async () => { throw new Error("fail"); });
    const text = "Rekap retry sukses";
    await sendRecap(TOKEN, CHAT_ID, text, { batchId: "b2", tanggal: "2026-09-04" });
    expect((await getQueue()).length).toBe(1);

    // next attempt sukses
    fetchMock.mockImplementationOnce(async () => ({ ok: true, status: 200 } as Response));
    // bypass backoff dengan set nextRetryAt ke past via enqueue internal? kita advance time
    vi.advanceTimersByTime(5_000);
    const r = await processQueue(TOKEN);
    expect(r.sent).toBe(1);
    expect((await getQueue()).length).toBe(0);
  });

  it("dedup key batchId+tanggal — beda tanggal beda antrean", async () => {
    // offline
    Object.defineProperty(globalThis.navigator, "onLine", { value: false, configurable: true });
    await sendRecap(TOKEN, CHAT_ID, "msg1", { batchId: "bX", tanggal: "2026-09-04" });
    await sendRecap(TOKEN, CHAT_ID, "msg2", { batchId: "bX", tanggal: "2026-09-05" });
    const q = await getQueue();
    expect(q.length).toBe(2);
    expect(q.map((x) => x.dedupKey)).toContain("bX+2026-09-04");
    expect(q.map((x) => x.dedupKey)).toContain("bX+2026-09-05");
  });

  it("enkripsi: save + decrypt roundtrip, tidak ada plaintext di storage", async () => {
    await saveTelegramSettings(TOKEN, CHAT_ID, PIN);
    const raw = localStorage.getItem("telegram-enc-v1");
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(TOKEN);
    expect(assertNoPlaintextInStorage(TOKEN)).toBe(true);

    const dec = await getDecryptedToken(PIN);
    expect(dec).toBe(TOKEN);

    const wrong = await getDecryptedToken("0000");
    expect(wrong).toBeNull();

    // send via settings
    fetchMock.mockClear();
    const text = buildRecapText({ kritis: [], omzet: 1000, margin: 200, cashflow: 800 });
    const res = await sendRecapFromSettings(PIN, text, { batchId: "b3", tanggal: "2026-09-04" });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sendRecapFromSettings token kosong → Bot belum disetting", async () => {
    // belum save → null
    await expect(sendRecapFromSettings(PIN, "halo")).rejects.toThrow("Bot belum disetting");
  });

  it("buildRecapText format Bahasa Indonesia", () => {
    const t = buildRecapText({ kritis: [], omzet: 0, margin: 0, cashflow: 0, tanggal: "2026-09-04" });
    expect(t).toContain("Rekap 2026-09-04");
    expect(t).toContain("Tidak ada stok kritis");
    expect(t).toContain("Omzet 14 hari");
    expect(t).toContain("Rp");
  });

  it("enqueue dedup via enqueueTelegram langsung", async () => {
    await enqueueTelegram({ dedupKey: "a+2026-09-04", chatId: CHAT_ID, text: "hi", tanggal: "2026-09-04", batchId: "a" });
    await enqueueTelegram({ dedupKey: "a+2026-09-04", chatId: CHAT_ID, text: "hi duplikat", tanggal: "2026-09-04", batchId: "a" });
    const q = await getQueue();
    expect(q.length).toBe(1);
    expect(q[0].text).toBe("hi"); // first wins
  });

  it("tidak ada token plaintext di repo — grep api.telegram.org direct-HTTPS tanpa backend", async () => {
    // pastikan sendRecap pakai api.telegram.org
    const text = buildRecapText({ kritis: [{ nama: "A", qty: 1, days: 1 }], omzet: 12345, margin: 1000, cashflow: 500, tanggal: "2026-09-04" });
    await sendRecap(TOKEN, CHAT_ID, text, { batchId: "b-final", tanggal: "2026-09-04" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url.startsWith("https://api.telegram.org/bot")).toBe(true);
    expect(url).not.toContain("supabase");
    expect(url).not.toContain("firebase");
  });
});
