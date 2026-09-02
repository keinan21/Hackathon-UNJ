import { useEffect, useState, useCallback } from "react";
import { Settings, CheckCircle, WarningCircle, InfoCircle } from "iconoir-react";
import { getKategoris, updateThreshold, validateThreshold, floorHarga, formatRupiah, type KategoriSetting } from "../../lib/settingsStore";

type Toast = { message: string; type: "success" | "error"; id: number } | null;

export default function SettingsPage() {
  const [kategoris, setKategoris] = useState<KategoriSetting[]>(() => getKategoris());
  // drafts per kategori id: string values for 3 inputs
  const [drafts, setDrafts] = useState<Record<string, string[]>>(() => {
    const cats = getKategoris();
    const m: Record<string, string[]> = {};
    for (const c of cats) {
      m[c.id] = c.threshold_h_minus.map(String);
      // ensure 3 length
      while (m[c.id].length < 3) m[c.id].push("");
      m[c.id] = m[c.id].slice(0, 3);
    }
    return m;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // sync when storage changes externally? listen storage event
  useEffect(() => {
    const handler = () => {
      const cats = getKategoris();
      setKategoris(cats);
      setDrafts((prev) => {
        const next: Record<string, string[]> = { ...prev };
        for (const c of cats) {
          if (!next[c.id]) next[c.id] = c.threshold_h_minus.map(String);
        }
        return next;
      });
    };
    window.addEventListener("storage", handler);
    // also custom event for in-tab updates
    window.addEventListener("__settings_updated" as unknown as string, handler as EventListener);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("__settings_updated" as unknown as string, handler as EventListener);
    };
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToast({ message, type, id });
    window.setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 4000);
  }, []);

  const handleChange = (kategoriId: string, idx: number, raw: string) => {
    // allow empty for validation, but keep raw
    setDrafts((prev) => {
      const arr = [...(prev[kategoriId] ?? ["", "", ""])];
      arr[idx] = raw;
      return { ...prev, [kategoriId]: arr };
    });
    // clear error on change
    if (errors[kategoriId]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[kategoriId];
        return n;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "-", "+", ".", ","].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleSave = (kategori: KategoriSetting) => {
    const rawArr = drafts[kategori.id] ?? [];
    // check empty strings
    const hasEmpty = rawArr.some((s) => s.trim() === "");
    if (hasEmpty) {
      const msg = "Threshold tidak boleh kosong";
      setErrors((p) => ({ ...p, [kategori.id]: msg }));
      showToast(msg, "error");
      return;
    }
    const nums = rawArr.map((s) => Number(s));
    // if any NaN
    if (nums.some((n) => Number.isNaN(n))) {
      const msg = "Threshold tidak boleh kosong";
      setErrors((p) => ({ ...p, [kategori.id]: msg }));
      showToast(msg, "error");
      return;
    }
    const validation = validateThreshold(nums);
    if (validation) {
      setErrors((p) => ({ ...p, [kategori.id]: validation }));
      showToast(validation, "error");
      return;
    }
    const res = updateThreshold(kategori.id, nums);
    if (!res.ok) {
      const msg = res.error ?? "Gagal simpan";
      setErrors((p) => ({ ...p, [kategori.id]: msg }));
      showToast(msg, "error");
      return;
    }
    // success
    const updated = getKategoris();
    setKategoris(updated);
    setErrors((p) => {
      const n = { ...p };
      delete n[kategori.id];
      return n;
    });
    setSavingId(kategori.id);
    window.setTimeout(() => setSavingId(null), 800);
    showToast(`Threshold ${kategori.nama} disimpan: [${nums.join(",")}]`, "success");
    // dispatch custom event for other tabs
    window.dispatchEvent(new CustomEvent("__settings_updated"));
  };

  return (
    <section
      data-testid="settings-page"
      aria-labelledby="settings-heading"
      className="w-full max-w-[480px] mx-auto px-4"
      style={{ fontSize: "16px" }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-[#0F7A4A] text-white rounded-full p-2">
          <Settings width={20} height={20} aria-hidden="true" />
        </div>
        <div>
          <h1 id="settings-heading" className="text-xl font-bold text-[#1A1A1A]" style={{ fontSize: "24px", lineHeight: 1.25 }}>
            Pengaturan
          </h1>
          <p className="text-sm text-[#595959]" style={{ fontSize: "16px" }}>
            Ubah angka H- pengingat & lihat harga floor HPP × 0.85
          </p>
        </div>
      </div>

      <p className="text-sm text-[#595959] mb-4 flex items-start gap-2 bg-white border border-[#D9D9D9] rounded-[8px] p-3" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", fontSize: "16px" }}>
        <InfoCircle width={16} height={16} aria-hidden="true" className="shrink-0 mt-[2px] text-[#0F7A4A]" />
        <span>
          Ubah angka H-, contoh <b>7</b> artinya ingatkan 7 hari sebelum kadaluarsa. Threshold default <code className="bg-[#F5F5F0] px-1 rounded">[7,3,1]</code> bisa diatur per kategori.
        </span>
      </p>

      <div className="space-y-4">
        {kategoris.map((kat) => {
          const draft = drafts[kat.id] ?? kat.threshold_h_minus.map(String);
          const errMsg = errors[kat.id] ?? null;
          const isError = !!errMsg;
          const floor = floorHarga(kat.contoh_hpp);
          const currentDisplay = kat.threshold_h_minus.join(",");
          return (
            <div
              key={kat.id}
              data-testid={`kategori-card-${kat.nama}`}
              className="bg-white border border-[#D9D9D9] rounded-[12px] p-4"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-[#1A1A1A]" style={{ fontSize: "18px" }}>
                  Kategori {kat.nama}
                </h2>
                <span className="text-xs font-mono bg-[#F5F5F0] border border-[#D9D9D9] px-2 py-1 rounded-full" aria-label={`Threshold saat ini [${currentDisplay}]`}>
                  [{currentDisplay}]
                </span>
              </div>

              <div className="mb-1">
                <span className="text-sm font-semibold text-[#1A1A1A]" style={{ fontSize: "16px" }}>
                  Threshold H- (hari sebelum kadaluarsa)
                </span>
              </div>

              {/* 3 kolom desktop, stacked mobile */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2" role="group" aria-label={`Threshold ${kat.nama} 3 nilai`}>
                {[0, 1, 2].map((idx) => {
                  const label = idx === 0 ? "Terbesar" : idx === 2 ? "Terkecil" : "Tengah";
                  const inputId = `threshold-${kat.id}-${idx}`;
                  const errorId = `error-${kat.id}-${idx}`;
                  return (
                    <div key={idx} className="form-control w-full">
                      <label htmlFor={inputId} className="label py-1">
                        <span className="label-text text-sm font-semibold text-[#1A1A1A]" style={{ fontSize: "16px" }}>
                          Nilai {idx + 1} <span className="text-[#595959] font-normal">({label})</span>
                        </span>
                      </label>
                      <input
                        id={inputId}
                        data-testid={`input-${kat.nama}-${idx}`}
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        step={1}
                        value={draft[idx] ?? ""}
                        onChange={(e) => handleChange(kat.id, idx, e.target.value)}
                        onKeyDown={handleKeyDown}
                        aria-invalid={isError ? "true" : "false"}
                        aria-describedby={isError ? `error-${kat.id}` : undefined}
                        aria-label={`Threshold ${kat.nama} nilai ${idx + 1}`}
                        className={`input input-bordered w-full min-h-[48px] h-12 text-base bg-white text-[#1A1A1A] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                          isError ? "input-error border-[#C62828] border-2" : "border-[#D9D9D9]"
                        }`}
                        style={{
                          fontSize: "16px",
                          minHeight: "48px",
                          ...(isError ? { borderColor: "#C62828", borderWidth: "2px" } : {}),
                          MozAppearance: "textfield",
                        }}
                        placeholder={String(kat.threshold_h_minus[idx] ?? "")}
                      />
                    </div>
                  );
                })}
              </div>

              {isError && (
                <p
                  id={`error-${kat.id}`}
                  role="alert"
                  data-testid={`error-${kat.nama}`}
                  className="text-sm flex items-center gap-1.5 mt-1 mb-2"
                  style={{ color: "#C62828", fontSize: "14px" }}
                >
                  <WarningCircle width={14} height={14} aria-hidden="true" className="shrink-0" />
                  {errMsg}
                </p>
              )}

              {/* Floor view read-only */}
              <div className="bg-[#F5F5F0] border border-[#D9D9D9] rounded-[8px] px-3 py-2 mb-3">
                <p className="text-sm text-[#1A1A1A]" style={{ fontSize: "14px" }}>
                  <span className="font-semibold">Harga floor:</span>{" "}
                  <span data-testid={`floor-${kat.nama}`} className="font-mono font-bold text-[#0F7A4A]">
                    {formatRupiah(floor)}
                  </span>{" "}
                  <span className="text-[#595959]">(HPP {formatRupiah(kat.contoh_hpp)} × 0.85)</span>
                </p>
                <p className="text-xs text-[#595959] mt-0.5">Harga tebus tidak boleh di bawah floor ini (guardrail HPP × 0.85).</p>
              </div>

              <button
                type="button"
                data-testid={`save-${kat.nama}`}
                onClick={() => handleSave(kat)}
                className="btn btn-primary w-full min-h-[48px] h-12 text-base font-semibold shadow-none"
                style={{ fontSize: "16px", minHeight: "48px", background: "#0F7A4A", borderColor: "#0F7A4A" }}
                aria-label={`Simpan threshold ${kat.nama}`}
              >
                {savingId === kat.id ? (
                  <>
                    <CheckCircle width={18} height={18} aria-hidden="true" />
                    Tersimpan
                  </>
                ) : (
                  "Simpan"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Toast 4s role=status DaisyUI alert */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="settings-toast"
          className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[480px] pointer-events-none"
        >
          <div
            className={`alert ${toast.type === "success" ? "alert-success bg-[#E8F5E9] border border-[#0F7A4A] text-[#0F7A4A]" : "alert-error bg-[#FFEBEE] border border-[#C62828] text-[#C62828]"} shadow-lg pointer-events-auto`}
            style={{
              fontSize: "16px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle width={18} height={18} aria-hidden="true" className="shrink-0" />
            ) : (
              <WarningCircle width={18} height={18} aria-hidden="true" className="shrink-0" />
            )}
            <span className="text-sm font-semibold" style={{ fontSize: "16px" }}>
              {toast.message}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
