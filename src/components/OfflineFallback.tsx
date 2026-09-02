import { WifiOff, RefreshDouble } from "iconoir-react";

interface OfflineFallbackProps {
  onReload?: () => void;
}

/**
 * Fallback offline — tampil saat Dexie kosong atau offline tanpa data.
 * Pesan Bahasa Indonesia formal warung, tombol Muat Ulang 48px full width.
 * Shell tetap render, tidak crash halaman putih.
 * DaisyUI: btn btn-primary min-h-[48px] w-full + theme primary #0F7A4A
 */
export function OfflineFallback({ onReload }: OfflineFallbackProps) {
  const handleReload = () => {
    if (onReload) onReload();
    else window.location.reload();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center text-center bg-white px-4 py-8 gap-4"
      style={{ minHeight: "60vh" }}
      data-testid="empty-offline-tanpa-cache"
    >
      <div
        aria-hidden="true"
        className="flex items-center justify-center bg-[#F5F5F0] border border-[#D9D9D9] rounded-2xl"
        style={{ width: 72, height: 72 }}
      >
        <WifiOff width={48} height={48} color="#595959" strokeWidth={1.6} />
      </div>

      <div className="flex flex-col gap-2 max-w-[360px]">
        <h2 className="m-0 text-xl font-bold leading-tight text-[#1A1A1A]" style={{ fontSize: "20px", color: "#1A1A1A" }}>
          Kamu offline
        </h2>
        <p className="m-0 font-normal leading-relaxed" style={{ fontSize: "16px", color: "#1A1A1A" }}>
          Kamu offline, saran kemarin tetap tampil di bawah jika ada. Data tersimpan lokal aman.
        </p>
      </div>

      <button
        type="button"
        onClick={handleReload}
        aria-label="Muat ulang halaman"
        className="btn btn-primary min-h-[48px] h-12 w-full max-w-[360px] rounded-xl text-base font-semibold gap-2 border-none hover:bg-primary-pressed active:bg-primary-pressed transition-colors"
        style={{ minHeight: "48px", fontSize: "16px" }}
      >
        <RefreshDouble width={20} height={20} color="#FFFFFF" />
        Muat Ulang
      </button>

      <p className="m-0 text-sm text-[#595959]" style={{ fontSize: "14px" }}>
        Data lokal aman — tidak hilang
      </p>
    </div>
  );
}
