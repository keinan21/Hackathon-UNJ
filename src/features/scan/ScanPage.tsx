import { useEffect, useRef, useState } from "react";
import { PageHeader, AppButton } from "../../components/ui";
import { ScanBarcode, WarningCircle, ArrowLeft } from "iconoir-react";

type ScannerCtl = {
  stop: () => Promise<void>;
  clear: () => void;
  isScanning?: boolean;
  getRunningTrackCapabilities?: () => MediaTrackCapabilities;
  applyVideoConstraints?: (c: MediaTrackConstraints) => Promise<void>;
};

export function ScanPage() {
  const readerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<ScannerCtl | null>(null);
  const stoppedRef = useRef(false);
  const frameCountRef = useRef(0);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [manualBarcode, setManualBarcode] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [framesChecked, setFramesChecked] = useState(0);
  const [engine, setEngine] = useState<string>("");
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const readerId = "scan-reader";

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const Html5Qrcode = mod.Html5Qrcode;
        // html5-qrcode (nama historis) memindai barcode 1D produk juga via
        // zxing + BarcodeDetector. Daftar format 1D ditaruh di constructor —
        // start() tidak menerima formatsToSupport (ada di tipenya).
        const Formats = mod.Html5QrcodeSupportedFormats;
        const el = document.getElementById(readerId);
        if (!el) {
          if (!cancelled) {
            setError("Kamera tidak tersedia di perangkat ini. Silakan isi barcode manual.");
            setLoading(false);
          }
          return;
        }
        const scanner = new Html5Qrcode(readerId, {
          formatsToSupport: [
            Formats.EAN_13,
            Formats.EAN_8,
            Formats.UPC_A,
            Formats.UPC_E,
            Formats.CODE_128,
            Formats.CODE_39,
            Formats.ITF,
            Formats.QR_CODE,
          ],
          // Pakai BarcodeDetector bawaan browser bila ada (lebih cepat),
          // otomatis fallback ke zxing bila tidak didukung.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
        scannerRef.current = scanner as unknown as ScannerCtl;
        try {
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              // Tanpa qrbox: seluruh frame video dipindai otomatis,
              // tidak perlu mengarahkan barcode ke kotak bidik.
            },
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
            () => {
              // Tiap frame gagal dihitung — membuktikan loop pindai hidup.
              frameCountRef.current += 1;
              if (frameCountRef.current % 15 === 0) setFramesChecked(frameCountRef.current);
            },
          );
          if (!cancelled) {
            setLoading(false);
            setEngine(typeof window !== "undefined" && "BarcodeDetector" in window ? "detektor bawaan HP" : "zxing");
            // Dorong autofocus kontinu + deteksi dukungan lampu, best-effort.
            try {
              await scanner.applyVideoConstraints({
                advanced: [{ focusMode: "continuous" }],
              } as unknown as MediaTrackConstraints);
            } catch {}
            try {
              const caps = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
              if (caps && "torch" in caps) setTorchSupported(true);
            } catch {}
          }
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

  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => {
      setError("Kamera tidak ketemu, tulis manual saja Bu");
      setTimeout(() => {
        document.getElementById("scan-input-manual")?.focus();
      }, 100);
    }, 8000);
    return () => clearTimeout(id);
  }, [loading]);

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

  const handleTorch = async () => {
    const s = scannerRef.current;
    if (!s?.applyVideoConstraints) return;
    const next = !torchOn;
    try {
      await s.applyVideoConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {}
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
        <p className="text-xs text-base-content/70 text-center mt-2">Arahkan kamera ke barcode — terbaca otomatis di mana saja dalam gambar.</p>
      </div>

      {!loading && !error && (
        <p data-testid="scan-status" role="status" className="text-sm text-base-content/70 text-center">
          Memindai otomatis… ({framesChecked} frame dicek){engine ? ` • Mesin ${engine}` : ""}
        </p>
      )}

      {torchSupported && !error && (
        <AppButton
          type="button"
          variant={torchOn ? "primary" : "outline"}
          onClick={handleTorch}
          data-testid="scan-torch"
          fullWidth
          className="rounded-xl"
        >
          {torchOn ? "Matikan Lampu" : "Nyalakan Lampu"}
        </AppButton>
      )}

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
