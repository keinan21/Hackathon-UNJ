import { WifiOff, RefreshDouble } from "iconoir-react";

interface OfflineFallbackProps {
  onReload?: () => void;
}

/**
 * Fallback offline — tampil saat Dexie kosong atau offline tanpa data.
 * Pesan Bahasa Indonesia formal warung, tombol Muat Ulang 48px full width.
 * Shell tetap render, tidak crash halaman putih.
 * DaisyUI: btn btn-primary min-h-[48px] w-full + theme primary (token semantik)
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
      className="flex flex-col items-center justify-center text-center bg-base-100 px-4 py-8 gap-4"
      style={{ minHeight: "60vh" }}
    >
      <div
        aria-hidden="true"
        className="flex items-center justify-center bg-base-200 border border-base-300 rounded-2xl text-base-content/70"
        style={{ width: 72, height: 72 }}
      >
        <WifiOff width={36} height={36} color="currentColor" strokeWidth={1.6} />
      </div>

      <div className="flex flex-col gap-2 max-w-[360px]">
        <h2 className="m-0 text-xl font-bold leading-tight text-base-content">Kamu offline</h2>
        <p className="m-0 text-base font-normal leading-relaxed text-base-content/70">
          Kamu offline, data tersimpan lokal akan tampil saat ada
        </p>
      </div>

      <button
        type="button"
        onClick={handleReload}
        aria-label="Muat ulang halaman"
        className="btn btn-primary min-h-[48px] h-12 w-full max-w-[360px] rounded-xl text-base font-semibold gap-2 border-none text-primary-content"
      >
        <RefreshDouble width={20} height={20} color="currentColor" />
        Muat Ulang
      </button>

      <p className="m-0 text-sm text-base-content/70">Data lokal aman — tidak hilang</p>
    </div>
  );
}
