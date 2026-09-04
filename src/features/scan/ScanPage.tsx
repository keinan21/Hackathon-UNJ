import { useEffect, useRef, useState } from "react";
import { PageHeader, AppButton } from "../../components/ui";
import { ScanBarcode, WarningCircle, ArrowLeft } from "iconoir-react";

export function ScanPage() {
  const readerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const stoppedRef = useRef(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [manualBarcode, setManualBarcode] = useState("");

  useEffect(() => {
    let cancelled = false;
    const readerId = "scan-reader";

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const Html5Qrcode = mod.Html5Qrcode;
        const el = document.getElementById(readerId);
        if (!el) {
          if (!cancelled) {
            setError("Kamera tidak tersedia di perangkat ini. Silakan isi barcode manual.");
            setLoading(false);
          }
          return;
        }
        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
        try {
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText: string) => {
              if (stoppedRef.current) return;
              stoppedRef.current = true;
              window.dispatchEvent(
                new CustomEvent("barcode-scanned", { detail: { barcode: decodedText } }),
              );
              try {
                sessionStorage.setItem("scan-barcode", decodedText);
              } catch {}
              scanner
                .stop()
                .catch(() => {})
                .finally(() => {
                  try {
                    scanner.clear();
                  } catch {}
                  window.history.pushState({}, "", "/sku/baru");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                });
            },
            () => {},
          );
          if (!cancelled) setLoading(false);
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : String(err ?? "");
          if (!cancelled) {
            const lower = msg.toLowerCase();
            if (lower.includes("permission") || lower.includes("notallowed") || lower.includes("denied")) {
              setError("Akses kamera ditolak. Silakan isi barcode manual di bawah.");
            } else if (lower.includes("notfound") || lower.includes("not found") || lower.includes("overconstrained")) {
              setError("Kamera tidak ditemukan. Silakan isi barcode manual di bawah.");
            } else {
              setError("Kamera tidak bisa diakses. Silakan isi barcode manual di bawah.");
            }
            setLoading(false);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Kamera tidak tersedia. Silakan isi barcode manual di bawah.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      const s = scannerRef.current as unknown as { isScanning?: boolean; stop: () => Promise<void>; clear: () => void } | null;
      if (s) {
        try {
          if (s.isScanning) {
            const p = s.stop();
            if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
          }
        } catch {}
        try {
          s.clear();
        } catch {}
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualBarcode.trim();
    if (!val) return;
    const s = scannerRef.current as unknown as { isScanning?: boolean; stop: () => Promise<void>; clear: () => void } | null;
    stoppedRef.current = true;
    if (s) {
      try {
        if (s.isScanning) {
          const maybe = s.stop();
          if (maybe && typeof (maybe as Promise<void>).catch === "function") (maybe as Promise<void>).catch(() => {});
        }
      } catch {}
      try {
        s.clear();
      } catch {}
    }
    window.dispatchEvent(new CustomEvent("barcode-scanned", { detail: { barcode: val } }));
    try {
      sessionStorage.setItem("scan-barcode", val);
    } catch {}
    window.history.pushState({}, "", "/sku/baru");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleBack = () => {
    const s = scannerRef.current as unknown as { isScanning?: boolean; stop: () => Promise<void>; clear: () => void } | null;
    stoppedRef.current = true;
    if (s) {
      try {
        if (s.isScanning) {
          const maybe = s.stop();
          if (maybe && typeof (maybe as Promise<void>).catch === "function") (maybe as Promise<void>).catch(() => {});
        }
      } catch {}
      try {
        s.clear();
      } catch {}
    }
    window.history.pushState({}, "", "/sku/baru");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div data-testid="scan-page" className="w-full max-w-[640px] mx-auto space-y-5">
      <PageHeader
        title="Scan Barcode"
        subtitle="Arahkan kamera ke barcode — atau isi manual bila kamera tidak siap."
        icon={<ScanBarcode width={18} height={18} />}
      />

      {loading && !error && (
        <p data-testid="scan-loading" className="text-sm text-[#595959]">
          Memuat kamera...
        </p>
      )}

      {error && (
        <p data-testid="scan-error" role="alert" className="flex items-start gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#FFF3CD] text-[#856404] border border-[#FFE69C]">
          <WarningCircle width={16} height={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      <div className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-3">
        <div
          id="scan-reader"
          ref={readerRef}
          data-testid="scan-reader"
          className="w-full rounded-xl overflow-hidden border border-base-300 bg-black"
          style={{ minHeight: "280px" }}
        />
        <p className="text-xs text-[#595959] text-center mt-2">Posisikan barcode di tengah kotak. Pencahayaan cukup membantu hasil.</p>
      </div>

      {/* Manual fallback — always visible */}
      <form onSubmit={handleManualSubmit} className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5 space-y-3" noValidate>
        <label htmlFor="scan-manual-barcode" className="block text-[16px] font-semibold text-neutral flex items-center gap-2">
          <ScanBarcode width={16} height={16} className="text-[#0F7A4A]" /> Input manual barcode
        </label>
        <input
          id="scan-manual-barcode"
          data-testid="scan-input-manual"
          type="text"
          value={manualBarcode}
          onChange={(e) => setManualBarcode(e.target.value)}
          placeholder="Contoh: 8991234567890"
          className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
        />
        <AppButton
          type="submit"
          data-testid="scan-manual-submit"
          fullWidth
          className="rounded-xl"
        >
          Pakai Barcode Ini
        </AppButton>
        <p data-testid="scan-manual-hint" className="text-xs text-[#595959] leading-relaxed">
          Jika kamera tidak tersedia atau ditolak, isi barcode manual lalu tekan tombol di atas.
        </p>
      </form>

      <AppButton
        type="button"
        variant="outline"
        onClick={handleBack}
        data-testid="scan-back"
        fullWidth
        className="rounded-xl gap-1.5"
      >
        <ArrowLeft width={16} height={16} /> Kembali ke form SKU
      </AppButton>
    </div>
  );
}

export default ScanPage;
