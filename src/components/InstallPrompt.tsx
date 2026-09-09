import { Download, Xmark } from "iconoir-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export function InstallPrompt() {
  const { canInstall, promptInstall, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div
      role="dialog"
      aria-label="Pasang aplikasi"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 max-w-[480px] mx-auto bg-base-100 border border-base-300 rounded-xl p-4 shadow-lg flex flex-col gap-3 z-50"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0 text-primary"
        >
          <Download width={20} height={20} color="currentColor" />
        </div>
        <div className="flex-1">
          <p className="m-0 text-base font-semibold text-base-content leading-snug">Pasang aplikasi?</p>
          <p className="mt-1 text-sm text-base-content/70 leading-snug">
            Tambah ke layar utama biar buka lebih cepat, tetap jalan saat offline.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup"
          className="btn btn-ghost btn-sm w-8 h-8 min-h-8 p-0 rounded-lg border border-base-300 bg-base-100 text-base-content"
        >
          <Xmark width={16} height={16} color="currentColor" />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="btn flex-1 min-h-[48px] h-12 rounded-xl border border-base-300 bg-base-100 text-base-content text-base font-semibold hover:bg-base-200"
        >
          Nanti
        </button>
        <button
          type="button"
          onClick={promptInstall}
          aria-label="Pasang aplikasi Tebus Murah"
          className="btn btn-primary flex-1 min-h-[48px] h-12 rounded-xl text-base font-semibold gap-2 border-none w-full text-primary-content"
        >
          <Download width={18} height={18} color="currentColor" />
          Pasang
        </button>
      </div>
    </div>
  );
}
