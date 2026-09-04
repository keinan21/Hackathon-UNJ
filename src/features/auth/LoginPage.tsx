import { useEffect, useState, useCallback, useRef } from "react";
import { isPinSet, setPin, verifyPin } from "./pinStore";
import { setLoggedIn } from "./session";
import { AppButton } from "../../components/ui";
import { Shop, Lock, WarningCircle, CheckCircle } from "iconoir-react";

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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <p className="text-[16px] text-[#595959]">Memuat...</p>
      </div>
    );
  }

  const isSetup = mode === "setup";

  return (
    <div
      data-testid="login-page"
      className="min-h-screen bg-[#F5F5F0] flex flex-col items-center px-4 py-8"
    >
      <div className="w-full max-w-[480px] mt-4 sm:mt-8">
        {/* Brand hangat */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0F7A4A] text-white flex items-center justify-center shadow-sm">
            <Shop width={26} height={26} strokeWidth={1.6} />
          </div>
          <h1 className="text-[22px] font-bold text-[#0F7A4A] mt-3 leading-tight">Inventaris Tebus Murah</h1>
          <p className="text-sm text-[#595959] mt-1 leading-relaxed">
            {isSetup ? "Buat PIN untuk toko Anda — data aman di perangkat" : "Masuk ke toko Anda — cepat dan aman"}
          </p>
        </div>

        <div className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5 sm:p-6 mt-6">
          {/* Nama toko */}
          <label htmlFor="input-nama-toko" className="flex items-center gap-2 text-[16px] font-semibold text-neutral mb-2">
            <Shop width={16} height={16} className="text-[#0F7A4A]" />
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
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
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
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-[#F5F5F0] text-[#595959] border-base-300 px-3"
            />
          )}

          {/* PIN */}
          <label htmlFor="input-pin" className="flex items-center gap-2 text-[16px] font-semibold text-neutral mt-5 mb-2">
            <Lock width={16} height={16} className="text-[#0F7A4A]" />
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
            className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3 disabled:opacity-60"
          />

          {/* Konfirmasi PIN hanya di setup */}
          {isSetup && (
            <>
              <label htmlFor="input-pin-confirm" className="flex items-center gap-2 text-[16px] font-semibold text-neutral mt-5 mb-2">
                <CheckCircle width={16} height={16} className="text-[#0F7A4A]" />
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
                className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
              />
            </>
          )}

          {/* Error / lockout */}
          {error && (
            <div data-testid="login-error" role="alert" className="mt-4 flex items-start gap-2 rounded-xl px-3 py-3 text-sm bg-[#FFEBEE] border border-[#FFCDD2] text-[#C62828]">
              <WarningCircle width={18} height={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isLocked && (
            <div data-testid="lockout-message" role="alert" className="mt-3 flex items-start gap-2 rounded-xl px-3 py-3 text-sm bg-[#FFF3E0] border border-[#FFE0B2] text-[#E65100]">
              <WarningCircle width={18} height={18} className="shrink-0 mt-0.5" />
              <span>Akun terkunci. Coba lagi dalam {lockoutSeconds} detik.</span>
            </div>
          )}

          {/* Tombol */}
          <AppButton
            type="button"
            data-testid="btn-masuk"
            onClick={isSetup ? handleSetup : handleLogin}
            disabled={isLocked || submitting}
            loading={submitting}
            fullWidth
            aria-label={isSetup ? "Buat PIN dan Masuk" : "Masuk"}
            className="mt-6 rounded-xl"
          >
            {submitting ? "Memproses..." : isSetup ? "Buat PIN dan Masuk" : "Masuk"}
          </AppButton>

          {isSetup ? (
            <p className="text-xs text-[#595959] text-center mt-3 leading-relaxed">PIN disimpan terenkripsi di perangkat ini. Aman dan offline siap.</p>
          ) : null}
        </div>

        <p className="text-xs text-[#595959] text-center mt-4">Butuh bantuan? Semua data tersimpan lokal di perangkat.</p>
      </div>
    </div>
  );
}

export default LoginPage;
