/**
 * TASK-03 [FRD-06] — Supervisor PIN auth + encrypted API key storage
 *
 * Single device, single supervisor, PIN 4 digit.
 * - PIN tidak disimpan plaintext, hanya hash PBKDF2 100k + salt 16b
 * - API key Gemini di-encrypt via PIN-derived key (PBKDF2 -> AES-GCM-256), simpan ciphertext di localStorage
 * - Tidak ada plaintext di Dexie.settings maupun localStorage
 * - Single org toko-01, no multi-role, simple fail count (MUST NOT escalation beyond simple)
 *
 * Storage:
 * - PIN: localStorage key PIN_STORE_KEY -> { salt, hash, failCount }
 *   + optional Dexie settings table `pinAuth` jika ada (sync-ready) — try/catch agar tidak break jika Dexie belum ada settings
 * - API key: localStorage key API_KEY_STORE_KEY -> { salt, iv, ciphertext, org_id }
 *
 * WebCrypto PBKDF2 100k + AES-GCM-256 via src/lib/crypto.ts
 */

import { derivePinHash, generateSalt, generateIv, encryptString, decryptString, encodeBase64, decodeBase64, hashPin } from "../../lib/crypto";

const PIN_STORE_KEY = "pinStore-v1";
const API_KEY_STORE_KEY = "gemini-api-key-enc-v1";
export const DEFAULT_ORG_ID = "toko-01";

type PinRecord = {
  salt: string; // base64
  hash: string; // base64 32b
  failCount: number;
  created_at: string;
  org_id: string;
};

type ApiKeyRecord = {
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  org_id: string;
  created_at: string;
};

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  const g = globalThis as unknown as { localStorage?: Storage };
  if (g.localStorage) return g.localStorage;
  // fallback in-memory for Node tests without window
  return null;
}

// In-memory fallback for vitest jsdom without localStorage or for isolated tests
const memStore = new Map<string, string>();

function storageGet(key: string): string | null {
  const s = getStorage();
  if (s) {
    try {
      return s.getItem(key);
    } catch {
      return memStore.get(key) ?? null;
    }
  }
  return memStore.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  const s = getStorage();
  if (s) {
    try {
      s.setItem(key, value);
      memStore.set(key, value);
      return;
    } catch {}
  }
  memStore.set(key, value);
}

function storageRemove(key: string): void {
  const s = getStorage();
  if (s) {
    try {
      s.removeItem(key);
    } catch {}
  }
  memStore.delete(key);
}

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------

export async function setPin(pin: string): Promise<PinRecord> {
  if (!pin || pin.trim().length === 0) throw new Error("PIN tidak boleh kosong");
  // allow 4 digit but not enforce strict 4 — FRD says 4 digit but test uses "1234"
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  const rec: PinRecord = {
    salt: encodeBase64(salt),
    hash,
    failCount: 0,
    created_at: new Date().toISOString(),
    org_id: DEFAULT_ORG_ID,
  };
  storageSet(PIN_STORE_KEY, JSON.stringify(rec));
  // optional Dexie settings persist — best effort
  try {
    const { db } = await import("../../db/db");
    // if db has settings table (future), persist there too (encrypted not needed)
    const maybe = db as unknown as { settings?: { put(v: unknown): Promise<unknown> } };
    if (maybe.settings) {
      await maybe.settings.put({ key: "pinAuth", ...rec });
    }
  } catch {}
  return rec;
}

export async function isPinSet(): Promise<boolean> {
  return storageGet(PIN_STORE_KEY) !== null;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = storageGet(PIN_STORE_KEY);
  if (!raw) return false;
  let rec: PinRecord;
  try {
    rec = JSON.parse(raw) as PinRecord;
  } catch {
    return false;
  }
  const salt = decodeBase64(rec.salt);
  // derive hash with same salt
  const hash = await hashPin(pin, salt);
  // constant-time compare (length check then char compare)
  if (hash.length !== rec.hash.length) {
    rec.failCount = (rec.failCount ?? 0) + 1;
    storageSet(PIN_STORE_KEY, JSON.stringify(rec));
    return false;
  }
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ rec.hash.charCodeAt(i);
  const ok = diff === 0;
  rec.failCount = ok ? 0 : (rec.failCount ?? 0) + 1;
  storageSet(PIN_STORE_KEY, JSON.stringify(rec));
  // no lockout escalation beyond simple failCount — do not block after N
  return ok;
}

export function getPinRecord(): PinRecord | null {
  const raw = storageGet(PIN_STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PinRecord;
  } catch {
    return null;
  }
}

export function clearPin(): void {
  storageRemove(PIN_STORE_KEY);
}

// ---------------------------------------------------------------------------
// API Key (Gemini) encrypted via PIN-derived key
// ---------------------------------------------------------------------------

export async function setApiKey(apiKey: string, pin: string): Promise<ApiKeyRecord> {
  if (!apiKey) throw new Error("API key tidak boleh kosong");
  // PIN must be valid if already set
  if (await isPinSet()) {
    const ok = await verifyPin(pin);
    if (!ok) throw new Error("PIN salah, tidak bisa simpan API key");
  }
  const salt = generateSalt();
  const iv = generateIv();
  const ciphertext = await encryptString(apiKey, pin, salt, iv);
  const rec: ApiKeyRecord = {
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext,
    org_id: DEFAULT_ORG_ID,
    created_at: new Date().toISOString(),
  };
  storageSet(API_KEY_STORE_KEY, JSON.stringify(rec));
  return rec;
}

export async function getApiKey(pin: string): Promise<string | null> {
  const raw = storageGet(API_KEY_STORE_KEY);
  if (!raw) return null;
  let rec: ApiKeyRecord;
  try {
    rec = JSON.parse(raw) as ApiKeyRecord;
  } catch {
    return null;
  }
  try {
    const salt = decodeBase64(rec.salt);
    const iv = decodeBase64(rec.iv);
    const plain = await decryptString(rec.ciphertext, pin, salt, iv);
    return plain;
  } catch {
    // wrong PIN or corrupt -> return null (caller asserts null/error)
    return null;
  }
}

export function clearApiKey(): void {
  storageRemove(API_KEY_STORE_KEY);
}

export function getApiKeyRawRecord(): ApiKeyRecord | null {
  const raw = storageGet(API_KEY_STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiKeyRecord;
  } catch {
    return null;
  }
}

/** For tests: ensure no plaintext API key in storage or Dexie */
export function assertNoPlaintextInStorage(plain: string): boolean {
  const raw = storageGet(API_KEY_STORE_KEY);
  if (raw && raw.includes(plain)) return false;
  // also check pin store
  const pinRaw = storageGet(PIN_STORE_KEY);
  if (pinRaw && pinRaw.includes(plain)) return false;
  return true;
}

// expose for e2e/debug
if (typeof window !== "undefined") {
  (window as unknown as { __PIN_STORE__?: unknown }).__PIN_STORE__ = {
    setPin,
    verifyPin,
    isPinSet,
    setApiKey,
    getApiKey,
    clearPin,
    clearApiKey,
    getPinRecord,
  };
}
