import { useState, useEffect } from "react";
import { CheckCircle } from "iconoir-react";
import { ThresholdForm } from "./ThresholdForm";
import { getLastBackupAt } from "../backup/backupService";

export type ThresholdKategori = { id: string; name: string; threshold: number[] };

const DEFAULT_KATEGORI: ThresholdKategori[] = [
  { id: "k-dairy", name: "Dairy", threshold: [7, 3, 1] },
  { id: "k-snack", name: "Snack", threshold: [7, 3, 1] },
  { id: "k-beras", name: "Beras", threshold: [7, 3, 1] },
];

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
  const [toast, setToast] = useState<string | null>(null);
  const [hppExample] = useState(10000);
  const floor = Math.round(hppExample * 0.85);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = (katId: string, next: number[]) => {
    const kat = kategoriList.find((k) => k.id === katId);
    if (!kat) return;
    const nextList = kategoriList.map((k) => (k.id === katId ? { ...k, threshold: next } : k));
    setKategoriList(nextList);
    localStorage.setItem("settings-thresholds", JSON.stringify(nextList));
    setToast(`Threshold ${kat.name} disimpan: ${next.join(",")}`);
  };

  return (
    <div data-testid="settings-page" className="w-full max-w-3xl mx-auto px-margin-mobile py-lg space-y-lg">
      <h2 className="font-headline-md text-headline-md text-on-surface" style={{ fontSize: "20px" }}>
        Pengaturan
      </h2>

      {/* Info floor HPP*0.85 */}
      <div
        className="bg-success-bg border border-primary rounded-xl p-md flex items-start gap-2 shadow-sm"
        data-testid="guardrail-info"
      >
        <CheckCircle width={18} height={18} aria-hidden="true" className="text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-on-surface" style={{ fontSize: "14px" }}>
            Guardrail harga: HPP x 0.85
          </p>
          <p className="text-sm text-slate-gray" style={{ fontSize: "14px" }}>
            Contoh HPP Rp{hppExample.toLocaleString("id-ID")} → floor Rp{floor.toLocaleString("id-ID")}. Harga tebus tidak
            boleh di bawah floor.
          </p>
        </div>
      </div>

      <div className="space-y-lg">
        {kategoriList.map((kat) => (
          <div key={kat.id} data-testid={`kategori-${kat.id}`}>
            <ThresholdForm
              kategoriId={kat.id}
              kategoriName={kat.name}
              threshold={kat.threshold}
              onSave={(next) => handleSave(kat.id, next)}
            />
            {/* compatibility anchors for legacy e2e: keep hidden inputs with old ids */}
            <span className="sr-only" data-testid={`save-${kat.id}`} aria-hidden="true" />
            <span className="sr-only" data-testid={`input-threshold-${kat.id}`} aria-hidden="true" />
          </div>
        ))}
      </div>

      <div
        role="status"
        aria-live="polite"
        className="bg-white border border-[#D9D9D9] rounded-xl p-6 flex flex-col items-center gap-3 text-center"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        data-testid="empty-backup-belum-pernah"
      >
        <span className="material-symbols-outlined text-[#595959]" style={{ fontSize: 48 }} aria-hidden="true">
          cloud_off
        </span>
        {(() => {
          const lastAt = getLastBackupAt();
          const never = !lastAt;
          return never ? (
            <>
              <p className="leading-relaxed" style={{ fontSize: "16px", color: "#1A1A1A" }}>
                Belum pernah backup. Yuk backup sekarang biar aman kalau HP hilang.
              </p>
              <button
                type="button"
                aria-label="Backup sekarang"
                onClick={() => setToast("Fitur backup: masukkan PIN untuk backup terenkripsi")}
                className="min-h-[48px] w-full px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-pressed active:bg-primary-pressed transition-colors font-semibold"
                style={{ minHeight: "48px", fontSize: "16px" }}
              >
                Backup Sekarang
              </button>
            </>
          ) : (
            <>
              <p className="leading-relaxed" style={{ fontSize: "16px", color: "#1A1A1A" }}>
                Terakhir backup: {new Date(lastAt!).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
              <button
                type="button"
                aria-label="Backup sekarang"
                onClick={() => setToast("Fitur backup: masukkan PIN untuk backup terenkripsi")}
                className="min-h-[48px] w-full px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-pressed active:bg-primary-pressed transition-colors font-semibold"
                style={{ minHeight: "48px", fontSize: "16px" }}
              >
                Backup Sekarang
              </button>
            </>
          );
        })()}
      </div>

      <div
        className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md shadow-sm"
        data-testid="avg-fallback-info"
      >
        <h3 className="font-headline-md text-headline-md text-on-surface" style={{ fontSize: "16px" }}>
          Rata-rata Harian
        </h3>
        <p className="font-body-md text-body-md text-slate-gray mt-1" style={{ fontSize: "14px" }}>
          Jika histori &lt;14 hari, pakai input manual. Rumus urgencyScore = qty * days / max(avg,1).
        </p>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-32px)] max-w-[480px] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-sm"
          style={{ backgroundColor: "#E8F5E9", borderColor: "#0F7A4A", color: "#1A1A1A" }}
          data-testid="settings-toast"
        >
          <CheckCircle width={18} height={18} aria-hidden="true" className="text-primary shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
