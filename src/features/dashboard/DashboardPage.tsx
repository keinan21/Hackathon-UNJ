import { useRef } from "react";
import { UrgentList } from "./UrgentList";
import { PromoAktifList } from "../promo/PromoAktifList";
import { HistoriList } from "./HistoriList";

export type DashboardPageProps = {
  seedMode?: "demo" | "many" | "empty" | "expiryNull";
};

export function DashboardPage({ seedMode }: DashboardPageProps) {
  const promoRef = useRef<HTMLElement>(null);

  return (
    <div data-testid="dashboard-page" className="w-full">
      {/* Seksi 1: Urgent */}
      <section data-testid="section-urgent" className="mb-6">
        <UrgentList seedMode={seedMode} onViewSuggestion={() => promoRef.current?.scrollIntoView({ behavior: "smooth" })} />
      </section>

      {/* Spacer 24px token space-lg */}
      <div style={{ height: 24 }} aria-hidden="true" />

      {/* Seksi 2: Promo Aktif */}
      <section ref={promoRef} data-testid="section-promo" className="mb-6">
        <PromoAktifList seedMode={seedMode} />
      </section>

      <div style={{ height: 24 }} aria-hidden="true" />

      {/* Seksi 3: Histori */}
      <section data-testid="section-histori" className="mb-6">
        <HistoriList seedMode={seedMode} />
        <span className="sr-only" data-testid="histori-count">Menampilkan 5 terbaru</span>
      </section>
    </div>
  );
}

export default DashboardPage;
