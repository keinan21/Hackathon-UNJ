import { useEffect, useState } from "react";
import { requestSaranTebus } from "./saranService";

export type SaranTebusButtonProps = {
  batchId: string;
  orgId?: string;
  skuName: string;
  onDone?: (batchId: string) => void;
};

/**
 * Tombol "Lihat Saran Tebus" mandiri: klik → usulan promo proposed
 * (guardrail dulu, idempoten) + toast sukses / error Bahasa Indonesia.
 * Dipakai di tiap baris /kritis; toast fixed 1 lapis per tombol.
 */
export function SaranTebusButton({ batchId, orgId = "toko-01", skuName, onDone }: SaranTebusButtonProps) {
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleClick = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const r = await requestSaranTebus(batchId, orgId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setToast(r.existed ? "Usulan sudah ada, cek halaman promo" : "Usulan tebus murah dibuat, cek halaman promo");
      onDone?.(batchId);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        data-testid={`saran-tebus-${batchId}`}
        onClick={handleClick}
        disabled={creating}
        aria-busy={creating}
        className="btn btn-primary btn-block min-h-12 text-base font-semibold"
        aria-label={`Lihat saran tebus untuk ${skuName}`}
      >
        {creating ? "Membuat saran..." : "Lihat Saran Tebus"}
      </button>
      {error && (
        <div role="alert" data-testid="saran-error" className="alert alert-error alert-soft mt-2 text-sm">
          <span>{error}</span>
        </div>
      )}
      {toast && (
        <div className="toast toast-center toast-bottom z-40 pb-20 lg:pb-4">
          <div role="status" data-testid="saran-toast" className="alert alert-success shadow-lg">
            <span className="text-base font-medium">{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi saran"
              data-testid="saran-toast-dismiss"
              className="btn btn-ghost btn-circle btn-sm shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SaranTebusButton;
