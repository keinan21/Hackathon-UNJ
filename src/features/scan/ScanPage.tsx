import { useEffect, useRef, useState } from "react";

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
        // Dynamic import — never top-level, keeps main bundle small
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
              // dispatch barcode to listeners (SkuForm)
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
            () => {
              // per-frame decode error — ignore
            },
          );
          if (!cancelled) setLoading(false);
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : String(err ?? "");
          // Permission denied or no camera
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
    <div data-testid="scan-page" className="w-full max-w-[480px] mx-auto px-4 space-y-4">
      <h2 className="text-[20px] font-bold text-[#1A1A1A]">Scan Barcode</h2>

      {loading && !error && (
        <p data-testid="scan-loading" className="text-[14px] text-[#595959]" style={{ fontSize: "14px" }}>
          Memuat kamera...
        </p>
      )}

      {error && (
        <p data-testid="scan-error" role="alert" className="rounded-[8px] px-3 py-2 text-[14px] font-medium" style={{ fontSize: "14px", backgroundColor: "#FFF3CD", color: "#856404", border: "1px solid #FFE69C" }}>
          {error}
        </p>
      )}

      <div
        id="scan-reader"
        ref={readerRef}
        data-testid="scan-reader"
        className="w-full rounded-[12px] overflow-hidden border border-[#D9D9D9] bg-black"
        style={{ minHeight: "280px" }}
      />

      {/* Manual fallback — always visible */}
      <form onSubmit={handleManualSubmit} className="space-y-2" noValidate>
        <label htmlFor="scan-manual-barcode" className="block text-[14px] font-medium text-[#1A1A1A]" style={{ fontSize: "14px" }}>
          Input manual barcode
        </label>
        <input
          id="scan-manual-barcode"
          data-testid="scan-input-manual"
          type="text"
          value={manualBarcode}
          onChange={(e) => setManualBarcode(e.target.value)}
          placeholder="Contoh: 8991234567890"
          className="w-full border border-[#D9D9D9] rounded-[12px] px-3"
          style={{ minHeight: "48px", fontSize: "16px" }}
        />
        <button
          type="submit"
          data-testid="scan-manual-submit"
          className="w-full rounded-[12px] font-semibold"
          style={{ minHeight: "48px", fontSize: "16px", backgroundColor: "#0F7A4A", color: "#FFFFFF", border: "none" }}
        >
          Pakai Barcode Ini
        </button>
        <p data-testid="scan-manual-hint" className="text-[12px] text-[#595959]" style={{ fontSize: "12px" }}>
          Jika kamera tidak tersedia atau ditolak, isi barcode manual lalu tekan tombol di atas.
        </p>
      </form>

      <button
        type="button"
        onClick={handleBack}
        data-testid="scan-back"
        className="w-full rounded-[12px] font-semibold border border-[#0F7A4A] text-[#0F7A4A] bg-white"
        style={{ minHeight: "48px", fontSize: "16px" }}
      >
        Kembali ke form SKU
      </button>
    </div>
  );
}

export default ScanPage;
