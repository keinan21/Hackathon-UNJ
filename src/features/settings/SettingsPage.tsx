import { useState, useEffect } from "react";
import { CheckCircle, WarningCircle } from "iconoir-react";

export type ThresholdKategori = { id: string; name: string; threshold: number[] };

const DEFAULT_KATEGORI: ThresholdKategori[] = [
  { id: "k-dairy", name: "Dairy", threshold: [7, 3, 1] },
  { id: "k-snack", name: "Snack", threshold: [7, 3, 1] },
  { id: "k-beras", name: "Beras", threshold: [7, 3, 1] },
];

function validateThreshold(input: string): { valid: boolean; error?: string; value?: number[] } {
  if (!input.trim()) return { valid: false, error: "Threshold tidak boleh kosong" };
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { valid: false, error: "Threshold tidak boleh kosong" };
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n) || !Number.isFinite(n))) return { valid: false, error: "Threshold harus angka, pisahkan dengan koma" };
  if (nums.some((n) => n <= 0)) return { valid: false, error: "Threshold harus lebih dari 0" };
  if (new Set(nums).size !== nums.length) return { valid: false, error: "Threshold tidak boleh duplikat" };
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] >= nums[i - 1]) return { valid: false, error: "Threshold harus urut menurun, contoh 7,3,1" };
  }
  return { valid: true, value: nums };
}

export function SettingsPage() {
  const [kategoriList, setKategoriList] = useState<ThresholdKategori[]>(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("settings-thresholds");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ThresholdKategori[];
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return DEFAULT_KATEGORI;
  });
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    const list = (() => {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("settings-thresholds");
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as ThresholdKategori[];
            if (Array.isArray(parsed)) return parsed;
          } catch {}
        }
      }
      return DEFAULT_KATEGORI;
    })();
    for (const k of list) m[k.id] = k.threshold.join(",");
    return m;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [hppExample] = useState(10000);
  const floor = Math.round(hppExample * 0.85);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = (kat: ThresholdKategori) => {
    const input = inputs[kat.id] ?? "";
    const v = validateThreshold(input);
    if (!v.valid) {
      setErrors((prev) => ({ ...prev, [kat.id]: v.error! }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[kat.id];
      return next;
    });
    const nextList = kategoriList.map((k) => (k.id === kat.id ? { ...k, threshold: v.value! } : k));
    setKategoriList(nextList);
    localStorage.setItem("settings-thresholds", JSON.stringify(nextList));
    setToast(`Threshold ${kat.name} disimpan: ${v.value!.join(",")}`);
  };

  const handleInputChange = (id: string, val: string) => {
    setInputs((prev) => ({ ...prev, [id]: val }));
    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <div data-testid="settings-page" className="w-full max-w-[480px] mx-auto px-4 py-4">
      <h2 className="text-[20px] font-bold text-[#1A1A1A] mb-4" style={{ fontSize: "20px" }}>Pengaturan</h2>

      {/* Info floor HPP*0.85 */}
      <div className="bg-[#E8F5E9] border border-[#0F7A4A] rounded-[12px] p-3 mb-4 flex items-start gap-2" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <CheckCircle width={18} height={18} aria-hidden="true" className="text-[#0F7A4A] shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-[#1A1A1A]" style={{ fontSize: "14px" }}>Guardrail harga: HPP x 0.85</p>
          <p className="text-[14px] text-[#595959]" style={{ fontSize: "14px" }}>Contoh HPP Rp{hppExample.toLocaleString("id-ID")} → floor Rp{floor.toLocaleString("id-ID")}. Harga tebus tidak boleh di bawah floor.</p>
        </div>
      </div>

      <div className="space-y-4">
        {kategoriList.map((kat) => (
          <div key={kat.id} className="bg-white border border-[#D9D9D9] rounded-[12px] p-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }} data-testid={`kategori-${kat.id}`}>
            <label htmlFor={`threshold-${kat.id}`} className="block text-[16px] font-semibold text-[#1A1A1A] mb-1" style={{ fontSize: "16px" }}>
              Threshold {kat.name}
            </label>
            <p className="text-[12px] text-[#595959] mb-2" style={{ fontSize: "12px" }}>Format: angka menurun pisah koma, contoh 7,3,1</p>
            <input
              id={`threshold-${kat.id}`}
              type="text"
              value={inputs[kat.id] ?? ""}
              onChange={(e) => handleInputChange(kat.id, e.target.value)}
              aria-label={`Threshold ${kat.name}`}
              aria-invalid={!!errors[kat.id]}
              aria-describedby={errors[kat.id] ? `error-${kat.id}` : undefined}
              placeholder="7,3,1"
              className={`input input-bordered w-full min-h-[48px] text-base ${errors[kat.id] ? "input-error border-[#C62828]" : "border-[#D9D9D9]"}`}
              style={{ minHeight: "48px", fontSize: "16px", borderWidth: "1px" }}
              data-testid={`input-threshold-${kat.id}`}
            />
            {errors[kat.id] ? (
              <div id={`error-${kat.id}`} role="alert" className="alert alert-error mt-2 py-2 px-3 text-[14px] flex items-center gap-2" style={{ fontSize: "14px", backgroundColor: "#FFEBEE", color: "#C62828", borderColor: "#C62828" }} data-testid={`error-${kat.id}`}>
                <WarningCircle width={16} height={16} aria-hidden="true" /> {errors[kat.id]}
              </div>
            ) : (
              <p className="text-[12px] text-[#595959] mt-1" style={{ fontSize: "12px" }}>Tersimpan: {kat.threshold.join(",")}</p>
            )}
            <button type="button" onClick={() => handleSave(kat)} className="btn btn-primary w-full min-h-[48px] mt-3 text-base font-semibold rounded-[12px]" style={{ minHeight: "48px", fontSize: "16px", backgroundColor: "#0F7A4A", color: "#FFFFFF", border: "none" }} data-testid={`save-${kat.id}`}>
              Simpan Threshold {kat.name}
            </button>
          </div>
        ))}
      </div>

      {/* Avg fallback info */}
      <div className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 mt-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }} data-testid="avg-fallback-info">
        <h3 className="text-[16px] font-semibold text-[#1A1A1A]" style={{ fontSize: "16px" }}>Rata-rata Harian</h3>
        <p className="text-[14px] text-[#595959] mt-1" style={{ fontSize: "14px" }}>Jika histori &lt;14 hari, pakai input manual. Rumus urgencyScore = qty * days / max(avg,1).</p>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-32px)] max-w-[480px] flex items-center gap-2 px-4 py-3 rounded-[12px] border" style={{ backgroundColor: "#E8F5E9", borderColor: "#0F7A4A", color: "#1A1A1A", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} data-testid="settings-toast">
          <CheckCircle width={18} height={18} aria-hidden="true" className="text-[#0F7A4A] shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
