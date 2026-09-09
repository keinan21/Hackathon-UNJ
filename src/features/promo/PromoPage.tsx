import { ArrowLeft } from "iconoir-react";
import { PromoAktifList } from "./PromoAktifList";

export function PromoPage() {
  const handleBack = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div data-testid="promo-page" className="w-full max-w-3xl">
      <button
        type="button"
        data-testid="promo-back"
        onClick={handleBack}
        className="btn btn-ghost btn-sm min-h-12 gap-1.5 self-start mb-4 text-base"
        aria-label="Kembali ke dashboard"
      >
        <ArrowLeft width={16} height={16} /> Kembali
      </button>

      <PromoAktifList />
    </div>
  );
}

export default PromoPage;
