/**
 * TASK-07 [FRD-06] — Session guard via sessionStorage
 *
 * sessionStorage flag hilang saat tab ditutup = aman.
 * Tidak menyimpan PIN plaintext.
 */

const SESSION_KEY = "auth-logged-in-v1";

function getSessionStorage(): Storage | null {
  if (typeof window !== "undefined" && window.sessionStorage) return window.sessionStorage;
  const g = globalThis as unknown as { sessionStorage?: Storage };
  if (g.sessionStorage) return g.sessionStorage;
  return null;
}

const memSession = new Map<string, string>();

function sGet(key: string): string | null {
  const s = getSessionStorage();
  if (s) {
    try {
      return s.getItem(key);
    } catch {
      return memSession.get(key) ?? null;
    }
  }
  return memSession.get(key) ?? null;
}

function sSet(key: string, value: string): void {
  const s = getSessionStorage();
  if (s) {
    try {
      s.setItem(key, value);
      memSession.set(key, value);
      return;
    } catch {}
  }
  memSession.set(key, value);
}

function sRemove(key: string): void {
  const s = getSessionStorage();
  if (s) {
    try {
      s.removeItem(key);
    } catch {}
  }
  memSession.delete(key);
}

export function isLoggedIn(): boolean {
  return sGet(SESSION_KEY) === "1";
}

export function setLoggedIn(): void {
  sSet(SESSION_KEY, "1");
}

export function logout(): void {
  sRemove(SESSION_KEY);
}

// For tests: clear mem fallback
export function _clearMemSession(): void {
  memSession.clear();
  sRemove(SESSION_KEY);
}
