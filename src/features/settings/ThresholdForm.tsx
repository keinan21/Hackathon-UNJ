import { useEffect, useState } from "react";

export type ThresholdFormProps = {
  kategoriId: string;
  kategoriName: string;
  threshold: number[];
  onSave: (next: number[]) => void;
};

type Errors = { h7?: string; h3?: string; h1?: string };

function validateTriple(h7s: string, h3s: string, h1s: string): Errors {
  const e: Errors = {};
  const raw: Record<string, string> = { h7: h7s, h3: h3s, h1: h1s };
  const keys: (keyof Errors)[] = ["h7", "h3", "h1"];

  // tidak kosong & >0
  for (const k of keys) {
    const v = raw[k].trim();
    if (v === "") {
      e[k] = "Threshold tidak boleh kosong";
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || Number.isNaN(n) || !Number.isInteger(n)) {
      e[k] = "Threshold harus angka bulat";
      continue;
    }
    if (n <= 0) {
      e[k] = "Threshold harus lebih dari 0";
    }
  }
  // if any empty/invalid skip dup/order checks for those
  if (Object.keys(e).length > 0) {
    // still need dup/order if all filled valid — but don't duplicate msgs
    // proceed to dup check only if no empty errors
  }

  const n7 = Number(h7s.trim());
  const n3 = Number(h3s.trim());
  const n1 = Number(h1s.trim());
  const allNums = [n7, n3, n1].every((n) => Number.isFinite(n) && n > 0 && Number.isInteger(n));

  if (allNums) {
    if (n7 === n3 || n7 === n1 || n3 === n1) {
      const dupMsg = "Angka tidak boleh sama";
      if (n7 === n3 || n7 === n1) e.h7 = e.h7 ?? dupMsg;
      if (n7 === n3 || n3 === n1) e.h3 = e.h3 ?? dupMsg;
      if (n7 === n1 || n3 === n1) e.h1 = e.h1 ?? dupMsg;
    }
    if (!(n7 > n3 && n3 > n1)) {
      const orderMsg = "Harus urut besar ke kecil";
      if (!(n7 > n3)) {
        e.h7 = e.h7 ?? orderMsg;
        e.h3 = e.h3 ?? orderMsg;
      }
      if (!(n3 > n1)) {
        e.h3 = e.h3 ?? orderMsg;
        e.h1 = e.h1 ?? orderMsg;
      }
      // if both fail, also hint h7
      if (n7 <= n1) e.h1 = e.h1 ?? orderMsg;
    }
  }

  return e;
}

export function ThresholdForm({ kategoriId, kategoriName, threshold, onSave }: ThresholdFormProps) {
  const [h7, setH7] = useState(String(threshold[0] ?? 7));
  const [h3, setH3] = useState(String(threshold[1] ?? 3));
  const [h1, setH1] = useState(String(threshold[2] ?? 1));
  const [errors, setErrors] = useState<Errors>({});
  const [pushEnabled, setPushEnabled] = useState(true);
  const [waEnabled, setWaEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setH7(String(threshold[0] ?? 7));
    setH3(String(threshold[1] ?? 3));
    setH1(String(threshold[2] ?? 1));
  }, [threshold]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const handleSave = () => {
    const e = validateTriple(h7, h3, h1);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    const next = [Number(h7.trim()), Number(h3.trim()), Number(h1.trim())];
    onSave(next);
    setSaved(true);
  };

  const handleChange = (which: "h7" | "h3" | "h1", val: string) => {
    if (which === "h7") setH7(val);
    if (which === "h3") setH3(val);
    if (which === "h1") setH1(val);
    // clear that field error eagerly
    if (errors[which]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[which];
        return n;
      });
    }
  };

  const inputBase =
    "h-12 min-h-[48px] w-20 text-center font-body-md text-base bg-surface border rounded-lg focus:ring-2 outline-none transition-shadow";
  const normalInput = "border-border focus:border-primary focus:ring-primary";
  const errorInput = "border-error bg-error-container text-error focus:border-error focus:ring-error";

  return (
    <section
      className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden"
      aria-labelledby={`threshold-heading-${kategoriId}`}
      data-testid={`threshold-form-${kategoriId}`}
    >
      <div className="p-md border-b border-border-subtle bg-surface-bright">
        <h3 id={`threshold-heading-${kategoriId}`} className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">
            settings_suggest
          </span>
          Konfigurasi Kategori: {kategoriName}
        </h3>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Atur pemicu notifikasi untuk kategori ini.</p>
      </div>

      <div className="p-md space-y-md">
        {/* H-7 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor={`threshold-h7-${kategoriId}`} className="font-data-mono text-data-mono text-on-surface block">
                H-7 Peringatan
              </label>
              <span className="text-xs text-slate-gray">Hari sebelum kadaluarsa</span>
            </div>
            <input
              id={`threshold-h7-${kategoriId}`}
              aria-label="Threshold H-7 Peringatan"
              aria-describedby={`hint-h7-${kategoriId}`}
              aria-invalid={!!errors.h7}
              type="number"
              inputMode="numeric"
              min={1}
              value={h7}
              onChange={(e) => handleChange("h7", e.target.value)}
              className={`${inputBase} ${errors.h7 ? errorInput : normalInput}`}
              data-testid={`input-h7-${kategoriId}`}
            />
          </div>
          <p
            id={`hint-h7-${kategoriId}`}
            className={`text-xs text-right ${errors.h7 ? "text-error block" : "hidden"}`}
            role={errors.h7 ? "alert" : undefined}
            style={{ fontSize: "12px", color: "#ba1a1a" }}
          >
            {errors.h7 ?? "Threshold tidak boleh kosong"}
          </p>
        </div>

        <hr className="border-border-subtle" />

        {/* H-3 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor={`threshold-h3-${kategoriId}`} className="font-data-mono text-data-mono text-on-surface block">
                H-3 Waspada
              </label>
              <span className="text-xs text-slate-gray">Hari sebelum kadaluarsa</span>
            </div>
            <input
              id={`threshold-h3-${kategoriId}`}
              aria-label="Threshold H-3 Waspada"
              aria-describedby={`hint-h3-${kategoriId}`}
              aria-invalid={!!errors.h3}
              type="number"
              inputMode="numeric"
              min={1}
              value={h3}
              onChange={(e) => handleChange("h3", e.target.value)}
              className={`${inputBase} ${errors.h3 ? errorInput : normalInput}`}
              data-testid={`input-h3-${kategoriId}`}
            />
          </div>
          <p
            id={`hint-h3-${kategoriId}`}
            className={`text-xs text-right ${errors.h3 ? "text-error block" : "hidden"}`}
            role={errors.h3 ? "alert" : undefined}
            style={{ fontSize: "12px", color: "#ba1a1a" }}
          >
            {errors.h3 ?? "Angka tidak boleh sama"}
          </p>
        </div>

        <hr className="border-border-subtle" />

        {/* H-1 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor={`threshold-h1-${kategoriId}`} className="font-data-mono text-data-mono text-on-surface block">
                H-1 Kritis
              </label>
              <span className="text-xs text-slate-gray">Hari sebelum kadaluarsa</span>
            </div>
            <input
              id={`threshold-h1-${kategoriId}`}
              aria-label="Threshold H-1 Kritis"
              aria-describedby={`hint-h1-${kategoriId}`}
              aria-invalid={!!errors.h1}
              type="number"
              inputMode="numeric"
              min={1}
              value={h1}
              onChange={(e) => handleChange("h1", e.target.value)}
              className={`${inputBase} ${errors.h1 ? errorInput : normalInput}`}
              data-testid={`input-h1-${kategoriId}`}
            />
          </div>
          <p
            id={`hint-h1-${kategoriId}`}
            className={`text-xs text-right ${errors.h1 ? "text-error block" : "hidden"}`}
            role={errors.h1 ? "alert" : undefined}
            style={{ fontSize: "12px", color: "#ba1a1a" }}
          >
            {errors.h1 ?? "Harus urut besar ke kecil"}
          </p>
        </div>

        <div className="pt-sm space-y-3">
          <div className="flex items-center justify-between bg-surface-container p-3 rounded-lg min-h-[48px]">
            <span className="font-body-md text-body-md font-semibold text-on-surface">Notifikasi Push</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={(e) => setPushEnabled(e.target.checked)}
                className="sr-only peer"
                aria-label="Aktifkan Notifikasi Push"
                data-testid={`toggle-push-${kategoriId}`}
              />
              <div className="w-11 h-6 bg-slate-gray peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex items-center justify-between bg-surface-container p-3 rounded-lg min-h-[48px]">
            <div className="flex flex-col">
              <span className="font-body-md text-body-md font-semibold text-on-surface">Notifikasi WhatsApp</span>
              <span className="text-xs text-slate-gray">stub, hanya log</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={waEnabled}
                onChange={(e) => setWaEnabled(e.target.checked)}
                className="sr-only peer"
                aria-label="Aktifkan Notifikasi WhatsApp"
                data-testid={`toggle-wa-${kategoriId}`}
              />
              <div className="w-11 h-6 bg-slate-gray peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="p-md bg-surface-container-low border-t border-border-subtle">
        <button
          type="button"
          onClick={handleSave}
          className="w-full bg-primary text-white min-h-[48px] h-12 rounded-lg font-body-md text-base font-semibold shadow-sm hover:bg-primary-pressed transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={`Simpan Konfigurasi ${kategoriName}`}
          data-testid={`save-threshold-${kategoriId}`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            save
          </span>
          Simpan Konfigurasi
        </button>
        {saved && (
          <p role="status" aria-live="polite" className="text-xs text-primary text-center mt-2" style={{ fontSize: "12px" }}>
            Konfigurasi {kategoriName} disimpan
          </p>
        )}
      </div>
    </section>
  );
}

export default ThresholdForm;
