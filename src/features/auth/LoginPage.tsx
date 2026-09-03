import { useEffect, useState, useCallback, useRef } from "react";
import { isPinSet, setPin, verifyPin } from "./pinStore";
import { setLoggedIn } from "./session";

const PROFILE_KEY = "profil_toko_v1";
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 30_000;

function getNamaTokoStored(): string {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { nama_toko?: string };
      return parsed.nama_toko ?? "";
    }
  } catch {}
  return "";
}

function saveNamaToko(nama: string): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ nama_toko: nama, updated_at: new Date().toISOString() }));
    // best-effort Dexie settings persist — sync-ready, non-blocking
    import("../../db/db")
      .then(({ db }) => {
        const maybe = db as unknown as { settings?: { put(v: unknown): Promise<unknown> } };
        if (maybe.settings) {
          return maybe.settings.put({ key: "profil_toko", nama_toko: nama, updated_at: new Date().toISOString(), org_id: "toko-01" });
        }
      })
      .catch(() => {});
  } catch {}
}

export function getProfilToko(): string {
  return getNamaTokoStored();
}

type LoginPageProps = {
  onSuccess: () => void;
};

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<"loading" | "setup" | "login">("loading");
  const [namaToko, setNamaToko] = useState("");
  const [namaTokoReadonly, setNamaTokoReadonly] = useState("");
  const [pin, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasPin = await isPinSet();
      if (cancelled) return;
      if (hasPin) {
        const nama = getNamaTokoStored();
        setNamaTokoReadonly(nama);
        setMode("login");
      } else {
        const nama = getNamaTokoStored();
        if (nama) setNamaToko(nama);
        setMode("setup");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // lockout countdown
  useEffect(() => {
    if (lockoutUntil === null) return;
    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutSeconds(0);
        setFailCount(0);
        setError(null);
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
      } else {
        setLockoutSeconds(remaining);
      }
    };
    tick();
    timerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [lockoutUntil]);

  const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;

  const handleSetup = useCallback(async () => {
    setError(null);
    if (!namaToko.trim()) {
      setError("Nama toko tidak boleh kosong");
      return;
    }
    if (!pin || pin.length < 4) {
      setError("PIN minimal 4 digit");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PIN dan konfirmasi PIN tidak sama");
      return;
    }
    setSubmitting(true);
    try {
      await setPin(pin);
      saveNamaToko(namaToko.trim());
      setLoggedIn();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan PIN");
    } finally {
      setSubmitting(false);
    }
  }, [namaToko, pin, pinConfirm, onSuccess]);

  const handleLogin = useCallback(async () => {
    if (isLocked) return;
    setError(null);
    if (!pin) {
      setError("PIN tidak boleh kosong");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await verifyPin(pin);
      if (ok) {
        setFailCount(0);
        setLoggedIn();
        onSuccess();
      } else {
        const next = failCount + 1;
        setFailCount(next);
        if (next >= LOCKOUT_THRESHOLD) {
          const until = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutUntil(until);
          setLockoutSeconds(30);
          setError(`Terlalu banyak percobaan salah. Coba lagi dalam 30 detik.`);
        } else {
          setError(`PIN salah. Percobaan ${next} dari ${LOCKOUT_THRESHOLD}.`);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal verifikasi PIN");
    } finally {
      setSubmitting(false);
    }
  }, [pin, failCount, isLocked, onSuccess]);

  if (mode === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F0" }}>
        <p style={{ fontSize: 16, color: "#595959" }}>Memuat...</p>
      </div>
    );
  }

  const isSetup = mode === "setup";

  return (
    <div
      data-testid="login-page"
      style={{ minHeight: "100vh", background: "#F5F5F0", display: "flex", flexDirection: "column", alignItems: "center", padding: 16 }}
    >
      <div style={{ width: "100%", maxWidth: 480, marginTop: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F7A4A", textAlign: "center", margin: 0 }}>Inventaris Tebus Murah</h1>
        <p style={{ fontSize: 14, color: "#595959", textAlign: "center", marginTop: 4 }}>{isSetup ? "Buat PIN untuk toko Anda" : "Masuk ke toko Anda"}</p>

        <div style={{ background: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: 12, padding: 16, marginTop: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          {/* Nama toko */}
          <label htmlFor="input-nama-toko" style={{ display: "block", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
            Nama Toko
          </label>
          {isSetup ? (
            <input
              id="input-nama-toko"
              data-testid="input-nama-toko"
              type="text"
              value={namaToko}
              onChange={(e) => setNamaToko(e.target.value)}
              placeholder="Contoh: Toko Berkah"
              aria-label="Nama Toko"
              style={{
                width: "100%",
                minHeight: 48,
                fontSize: 16,
                padding: "10px 12px",
                border: "1px solid #D9D9D9",
                borderRadius: 8,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          ) : (
            <input
              id="input-nama-toko"
              data-testid="input-nama-toko"
              type="text"
              value={namaTokoReadonly}
              readOnly
              aria-label="Nama Toko"
              aria-readonly="true"
              style={{
                width: "100%",
                minHeight: 48,
                fontSize: 16,
                padding: "10px 12px",
                border: "1px solid #D9D9D9",
                borderRadius: 8,
                boxSizing: "border-box",
                background: "#F5F5F0",
                color: "#595959",
                outline: "none",
              }}
            />
          )}

          {/* PIN */}
          <label htmlFor="input-pin" style={{ display: "block", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginTop: 16, marginBottom: 6 }}>
            PIN
          </label>
          <input
            id="input-pin"
            data-testid="input-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Masukkan PIN"
            aria-label="PIN"
            disabled={isLocked}
            style={{
              width: "100%",
              minHeight: 48,
              fontSize: 16,
              padding: "10px 12px",
              border: "1px solid #D9D9D9",
              borderRadius: 8,
              boxSizing: "border-box",
              outline: "none",
              opacity: isLocked ? 0.6 : 1,
            }}
          />

          {/* Konfirmasi PIN hanya di setup */}
          {isSetup && (
            <>
              <label htmlFor="input-pin-confirm" style={{ display: "block", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginTop: 16, marginBottom: 6 }}>
                Konfirmasi PIN
              </label>
              <input
                id="input-pin-confirm"
                data-testid="input-pin-confirm"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="new-password"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                placeholder="Ulangi PIN"
                aria-label="Konfirmasi PIN"
                style={{
                  width: "100%",
                  minHeight: 48,
                  fontSize: 16,
                  padding: "10px 12px",
                  border: "1px solid #D9D9D9",
                  borderRadius: 8,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </>
          )}

          {/* Error / lockout */}
          {error && (
            <div data-testid="login-error" role="alert" style={{ marginTop: 12, padding: "10px 12px", background: "#FFEBEE", border: "1px solid #C62828", borderRadius: 8, color: "#C62828", fontSize: 14 }}>
              {error}
            </div>
          )}

          {isLocked && (
            <div data-testid="lockout-message" role="alert" style={{ marginTop: 12, padding: "10px 12px", background: "#FFF3E0", border: "1px solid #E65100", borderRadius: 8, color: "#E65100", fontSize: 14 }}>
              Akun terkunci. Coba lagi dalam {lockoutSeconds} detik.
            </div>
          )}

          {/* Tombol */}
          <button
            type="button"
            data-testid="btn-masuk"
            onClick={isSetup ? handleSetup : handleLogin}
            disabled={isLocked || submitting}
            aria-label={isSetup ? "Buat PIN dan Masuk" : "Masuk"}
            style={{
              width: "100%",
              minHeight: 48,
              fontSize: 16,
              fontWeight: 600,
              background: isLocked ? "#BDBDBD" : "#0F7A4A",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 12,
              marginTop: 20,
              cursor: isLocked ? "not-allowed" : "pointer",
              opacity: submitting ? 0.8 : 1,
            }}
          >
            {submitting ? "Memproses..." : isSetup ? "Buat PIN dan Masuk" : "Masuk"}
          </button>

          {isSetup ? (
            <p style={{ fontSize: 12, color: "#595959", textAlign: "center", marginTop: 12 }}>PIN akan disimpan terenkripsi di perangkat ini.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
