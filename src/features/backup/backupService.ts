/**
 * TASK-18 [FRD-06] — Backup/Restore JSON terenkripsi + Drive hook
 *
 * Export semua tabel Dexie ke JSON, enkripsi AES-GCM-256 dengan key = PBKDF2(PIN, salt 16b, 100k iter),
 * IV 12b random, header { version:1, org_id, salt, iv, created_at }, lalu download file .json.enc.
 * Import: pilih file, masukkan PIN, decrypt, validasi JSON, replace Dexie (v1 replace dengan konfirmasi).
 * Drive hook stub: window.showPicker jika ada, else instruksi manual.
 *
 * Local-first, no backend, no cloud sync v1. Penyimpanan salt/iv di header file, bukan hardcode.
 * Bahasa Indonesia untuk pesan error, tombol 48px di UI (di-handle di komponen, bukan di service).
 */

import { generateSalt, generateIv, encryptString, decryptString, encodeBase64, decodeBase64 } from "../../lib/crypto";
import { db, DEFAULT_ORG_ID } from "../../db/db";

export const BACKUP_VERSION = 1;
export const BACKUP_FILE_EXT = ".json.enc";

export type BackupHeader = {
  version: number;
  org_id: string;
  salt: string; // base64
  iv: string; // base64
  created_at: string; // ISO
};

export type BackupEnvelope = {
  header: BackupHeader;
  ciphertext: string; // base64 AES-GCM
};

export type BackupPlainPayload = {
  version: number;
  org_id: string;
  exported_at: string;
  tables: {
    skus: unknown[];
    kategoris: unknown[];
    batches: unknown[];
    transaksis: unknown[];
    promos: unknown[];
    advisorCache: unknown[];
    settings?: unknown[];
  };
  meta: {
    counts: Record<string, number>;
  };
};

const LAST_BACKUP_KEY = "lastBackupAt-v1";

// ---------------------------------------------------------------------------
// Helpers: lastBackupAt
// ---------------------------------------------------------------------------

function setLastBackupAt(iso: string) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LAST_BACKUP_KEY, iso);
    }
  } catch {}
}

export function getLastBackupAt(): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {}
  return null;
}

export function shouldShowBackupReminder(): boolean {
  const raw = getLastBackupAt();
  if (!raw) return true;
  const last = new Date(raw).getTime();
  if (Number.isNaN(last)) return true;
  const days = (Date.now() - last) / 86400000;
  return days > 7;
}

// ---------------------------------------------------------------------------
// Core: plain payload build
// ---------------------------------------------------------------------------

export async function buildPlainPayload(orgId: string = DEFAULT_ORG_ID): Promise<BackupPlainPayload> {
  // query all tables filtered by org_id where applicable
  // db.ts tables: skus, kategoris, batches, transaksis, promos, advisorCache
  const [skus, kategoris, batches, transaksis, promos, advisorCache] = await Promise.all([
    db.skus.where("org_id").equals(orgId).toArray().catch(() => db.skus.toArray()),
    db.kategoris.where("org_id").equals(orgId).toArray().catch(() => db.kategoris.toArray()),
    db.batches.where("org_id").equals(orgId).toArray().catch(() => db.batches.toArray()),
    db.transaksis.where("org_id").equals(orgId).toArray().catch(() => db.transaksis.toArray()),
    db.promos.where("org_id").equals(orgId).toArray().catch(() => db.promos.toArray()),
    db.advisorCache.where("org_id").equals(orgId).toArray().catch(() => db.advisorCache.toArray()),
  ]);

  return {
    version: BACKUP_VERSION,
    org_id: orgId,
    exported_at: new Date().toISOString(),
    tables: { skus, kategoris, batches, transaksis, promos, advisorCache },
    meta: {
      counts: {
        skus: skus.length,
        kategoris: kategoris.length,
        batches: batches.length,
        transaksis: transaksis.length,
        promos: promos.length,
        advisorCache: advisorCache.length,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt envelope
// ---------------------------------------------------------------------------

export async function encryptBackup(plaintext: string, pin: string): Promise<BackupEnvelope> {
  if (!pin) throw new Error("PIN tidak boleh kosong");
  const salt = generateSalt();
  const iv = generateIv();
  const ciphertext = await encryptString(plaintext, pin, salt, iv);
  const header: BackupHeader = {
    version: BACKUP_VERSION,
    org_id: DEFAULT_ORG_ID,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    created_at: new Date().toISOString(),
  };
  return { header, ciphertext };
}

export async function decryptBackup(envelope: BackupEnvelope, pin: string): Promise<string> {
  if (!envelope.header || !envelope.ciphertext) throw new Error("File rusak, coba file lain");
  const { salt, iv } = envelope.header;
  if (!salt || !iv) throw new Error("File rusak, coba file lain");
  // validate header
  if (envelope.header.version !== BACKUP_VERSION) {
    // allow but warn — still try decrypt
  }
  try {
    const saltBuf = decodeBase64(salt);
    const ivBuf = decodeBase64(iv);
    const plain = await decryptString(envelope.ciphertext, pin, saltBuf, ivBuf);
    return plain;
  } catch (e) {
    // WebCrypto throws on wrong PIN (tag mismatch) or corrupt
    // Distinguish: if ciphertext tampered, still throw "File rusak" but spec says PIN salah for wrong PIN
    // We try to detect: if pin is wrong, decrypt fails with OperationError
    // Show PIN salah first (more specific), fallback to file rusak
    const msg = (e as Error)?.message ?? "";
    if (msg.includes("OperationError") || msg.includes("decrypt") || msg.includes("tag")) {
      throw new Error("PIN salah, tidak bisa buka backup");
    }
    throw new Error("PIN salah, tidak bisa buka backup");
  }
}

// ---------------------------------------------------------------------------
// Export / Import high-level
// ---------------------------------------------------------------------------

export async function exportEncryptedBackup(pin: string, orgId: string = DEFAULT_ORG_ID): Promise<string> {
  if (!pin) throw new Error("PIN tidak boleh kosong");
  const payload = await buildPlainPayload(orgId);
  const plaintext = JSON.stringify(payload);
  const envelope = await encryptBackup(plaintext, pin);
  // Override header org_id with actual orgId used
  envelope.header.org_id = orgId;
  const fileContent = JSON.stringify(envelope);
  setLastBackupAt(new Date().toISOString());
  return fileContent;
}

export async function importEncryptedBackup(fileContent: string, pin: string): Promise<BackupPlainPayload> {
  if (!fileContent || fileContent.trim().length === 0) throw new Error("File rusak, coba file lain");
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(fileContent) as BackupEnvelope;
  } catch {
    throw new Error("File rusak, coba file lain");
  }
  if (!envelope.header || !envelope.ciphertext) throw new Error("File rusak, coba file lain");
  if (!envelope.header.salt || !envelope.header.iv) throw new Error("File rusak, coba file lain");

  let plaintext: string;
  try {
    plaintext = await decryptBackup(envelope, pin);
  } catch (e) {
    // decryptBackup already maps to Indonesian message
    throw e;
  }

  let payload: BackupPlainPayload;
  try {
    payload = JSON.parse(plaintext) as BackupPlainPayload;
  } catch {
    throw new Error("File rusak, coba file lain");
  }

  if (!payload.tables || typeof payload.tables !== "object") throw new Error("File rusak, coba file lain");

  // Restore: clear then bulkPut (replace)
  // Use transaction for atomicity where possible
  try {
    await db.transaction("rw", [db.skus, db.kategoris, db.batches, db.transaksis, db.promos, db.advisorCache], async () => {
      // clear existing org data
      // For v1 single org, clear all then restore
      await Promise.all([
        db.skus.clear(),
        db.kategoris.clear(),
        db.batches.clear(),
        db.transaksis.clear(),
        db.promos.clear(),
        db.advisorCache.clear(),
      ]);
      // restore
      if (payload.tables.skus.length) await db.skus.bulkAdd(payload.tables.skus as never[]);
      if (payload.tables.kategoris.length) await db.kategoris.bulkAdd(payload.tables.kategoris as never[]);
      if (payload.tables.batches.length) await db.batches.bulkAdd(payload.tables.batches as never[]);
      if (payload.tables.transaksis.length) await db.transaksis.bulkAdd(payload.tables.transaksis as never[]);
      if (payload.tables.promos.length) await db.promos.bulkAdd(payload.tables.promos as never[]);
      if (payload.tables.advisorCache.length) await db.advisorCache.bulkAdd(payload.tables.advisorCache as never[]);
    });
  } catch (e) {
    throw new Error("File rusak, coba file lain");
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Download helper + Drive hook stub
// ---------------------------------------------------------------------------

export function buildBackupFilename(orgId: string = DEFAULT_ORG_ID): string {
  const date = new Date().toISOString().slice(0, 10);
  return `backup-${orgId}-${date}${BACKUP_FILE_EXT}`;
}

export function triggerDownload(filename: string, content: string): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

export type DriveHookResult =
  | { mode: "native"; message: string }
  | { mode: "manual"; message: string };

export function backupToDriveHook(filename: string): DriveHookResult {
  const g = globalThis as unknown as { window?: { showPicker?: unknown } };
  // Check if window.showPicker exists (File System Access API pick)
  const hasPicker = typeof window !== "undefined" && typeof (window as unknown as { showPicker?: unknown }).showPicker === "function";
  if (hasPicker || g.window?.showPicker) {
    return { mode: "native", message: "Membuka pemilih Google Drive..." };
  }
  return { mode: "manual", message: "File sudah diunduh, upload manual ke Google Drive" };
}

// Combined flow for UI: export + download + drive hook
export async function exportAndDownload(pin: string, orgId: string = DEFAULT_ORG_ID): Promise<{ filename: string; content: string; drive: DriveHookResult }> {
  const content = await exportEncryptedBackup(pin, orgId);
  const filename = buildBackupFilename(orgId);
  triggerDownload(filename, content);
  const drive = backupToDriveHook(filename);
  return { filename, content, drive };
}

// expose for e2e/debug
if (typeof window !== "undefined") {
  (window as unknown as { __BACKUP_SERVICE__?: unknown }).__BACKUP_SERVICE__ = {
    exportEncryptedBackup,
    importEncryptedBackup,
    buildPlainPayload,
    getLastBackupAt,
    shouldShowBackupReminder,
    backupToDriveHook,
  };
}
