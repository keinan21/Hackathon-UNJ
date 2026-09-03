/**
 * TASK-03 + TASK-18 [FRD-06] — Crypto helpers
 *
 * PBKDF2 100k iter + AES-GCM-256 sesuai docs/architecture.md:372 dan
 * docs/frd/frd-06-backup.md:42. Local-first, zero cloud.
 *
 * - deriveKey(pin, salt) -> CryptoKey AES-GCM-256
 * - hashPin(pin, salt) -> base64(32 bytes) untuk verifikasi PIN (tidak decrypt)
 * - encryptString / decryptString -> base64 ciphertext dengan iv 12 byte
 * - helpers base64, salt/iv generation, WebCrypto subtle wrapper
 *
 * Must NOT simpan PIN atau API key plain text.
 * Salt 16 byte random, IV 12 byte random, iter 100k, hash SHA-256.
 */

const ITERATIONS = 100_000;
const HASH = "SHA-256";
const SALT_LEN = 16;
const IV_LEN = 12;

// ---------------------------------------------------------------------------
// Base64 helpers (work in browser + Node + jsdom)
// ---------------------------------------------------------------------------

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  // Node Buffer available?
  const g = globalThis as unknown as { Buffer?: { from(v: Uint8Array): { toString(enc: string): string } } };
  if (g.Buffer) {
    try {
      return g.Buffer.from(bytes).toString("base64");
    } catch {}
  }
  // browser btoa
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa may not exist in Node without Buffer
  if (typeof btoa !== "undefined") return btoa(binary);
  // fallback manual via Buffer polyfill
  if (typeof (globalThis as unknown as { Buffer?: unknown }).Buffer !== "undefined") {
    // last resort
    return (globalThis as unknown as { Buffer: typeof Buffer }).Buffer.from(bytes).toString("base64");
  }
  return binary; // should not happen in tests
}

function base64ToBuf(b64: string): Uint8Array {
  const g = globalThis as unknown as { Buffer?: { from(v: string, enc: string): Uint8Array } };
  if (g.Buffer) {
    try {
      return Uint8Array.from(g.Buffer.from(b64, "base64"));
    } catch {}
  }
  if (typeof atob !== "undefined") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  if (typeof (globalThis as unknown as { Buffer?: unknown }).Buffer !== "undefined") {
    return Uint8Array.from((globalThis as unknown as { Buffer: typeof Buffer }).Buffer.from(b64, "base64"));
  }
  throw new Error("Base64 decode not available");
}

// ---------------------------------------------------------------------------
// WebCrypto subtle helper (browser vs Node)
// ---------------------------------------------------------------------------

function getSubtle(): SubtleCrypto {
  // browser
  const g = globalThis as unknown as {
    crypto?: Crypto;
    window?: { crypto?: Crypto };
  };
  if (g.crypto?.subtle) return g.crypto.subtle;
  if (g.window?.crypto?.subtle) return g.window.crypto.subtle;
  // Node 20 webcrypto
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try {
    // Node: use globalThis.crypto if available (jsdom provides it)
    const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (c?.subtle) return c.subtle;
  } catch {}
  throw new Error("WebCrypto subtle not available");
}

// ---------------------------------------------------------------------------
// Core: PBKDF2 derive
// ---------------------------------------------------------------------------

export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const subtle = getSubtle();
  const baseKey = await subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey", "deriveBits"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: HASH },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Derive 32 byte hash untuk simpan verifikasi PIN (PBKDF2 bits) */
export async function derivePinHash(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const subtle = getSubtle();
  const baseKey = await subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: HASH },
    baseKey,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const out = await derivePinHash(pin, salt);
  return bufToBase64(out);
}

export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_LEN);
  const g = globalThis as unknown as { crypto?: Crypto };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(salt);
  } else {
    // fallback Math.random (not secure but for test only, still 16b)
    for (let i = 0; i < salt.length; i++) salt[i] = Math.floor(Math.random() * 256);
  }
  return salt;
}

export function generateIv(): Uint8Array {
  const iv = new Uint8Array(IV_LEN);
  const g = globalThis as unknown as { crypto?: Crypto };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < iv.length; i++) iv[i] = Math.floor(Math.random() * 256);
  }
  return iv;
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt string (AES-GCM)
// ---------------------------------------------------------------------------

export async function encryptString(plaintext: string, pin: string, salt: Uint8Array, iv: Uint8Array): Promise<string> {
  const key = await deriveKey(pin, salt);
  const enc = new TextEncoder();
  const subtle = getSubtle();
  const cipher = await subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, enc.encode(plaintext));
  return bufToBase64(cipher);
}

export async function decryptString(ciphertextB64: string, pin: string, salt: Uint8Array, iv: Uint8Array): Promise<string> {
  const key = await deriveKey(pin, salt);
  const subtle = getSubtle();
  const cipherBuf = base64ToBuf(ciphertextB64);
  const plainBuf = await subtle.decrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, cipherBuf as unknown as BufferSource);
  return new TextDecoder().decode(plainBuf);
}

// ---------------------------------------------------------------------------
// Re-export helpers for backupService
// ---------------------------------------------------------------------------

export function encodeBase64(bytes: Uint8Array): string {
  return bufToBase64(bytes);
}

export function decodeBase64(b64: string): Uint8Array {
  return base64ToBuf(b64);
}

export const CRYPTO_META = {
  iterations: ITERATIONS,
  hash: HASH,
  saltLen: SALT_LEN,
  ivLen: IV_LEN,
  version: 1,
} as const;
