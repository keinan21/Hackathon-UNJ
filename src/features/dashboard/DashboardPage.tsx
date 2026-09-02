import { UrgentList } from "./UrgentList";
import { PromoAktifList } from "../promo/PromoAktifList";
import { HistoriList } from "./HistoriList";

export type DashboardPageProps = {
  onHistoriSelect?: (id: string) => void;
};

export function DashboardPage({ onHistoriSelect }: DashboardPageProps) {
  const handleHistoriSelect = (id: string) => {
    if (onHistoriSelect) {
      onHistoriSelect(id);
      return;
    }
    const url = `/histori/${id}`;
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="w-full max-w-[480px] mx-auto" data-testid="dashboard-page">
      {/* Seksi 1: UrgentList */}
      <div data-testid="section-urgent">
        <UrgentList />
      </div>

      {/* Spacer 24px token space-lg */}
      <div className="h-6" aria-hidden="true" />

      {/* Seksi 2: PromoAktifList */}
      <div data-testid="section-promo">
        <PromoAktifList />
      </div>

      <div className="h-6" aria-hidden="true" />

      {/* Seksi 3: Histori 5 terbaru */}
      <div data-testid="section-histori">
        <HistoriList onSelect={handleHistoriSelect} />
      </div>
    </div>
  );
}

export default DashboardPage;
