import { useState } from "react";
import { UrgentList } from "./UrgentList";
import { PromoAktifList } from "../promo/PromoAktifList";
import { HistoriList } from "./HistoriList";

export type DashboardPageProps = {
  seedMode?: "demo" | "many" | "empty" | "expiryNull";
};

export function DashboardPage({ seedMode = "demo" }: DashboardPageProps) {
  const [activePromoCount] = useState(0);

  return (
    <div data-testid="dashboard-page" className="w-full">
      {/* Seksi 1: Urgent */}
      <section data-testid="section-urgent" className="mb-6">
        <UrgentList seedMode={seedMode} />
      </section>

      {/* Spacer 24px token space-lg */}
      <div style={{ height: 24 }} aria-hidden="true" />

      {/* Seksi 2: Promo Aktif */}
      <section data-testid="section-promo" className="mb-6">
        <PromoAktifList />
      </section>

      <div style={{ height: 24 }} aria-hidden="true" />

      {/* Seksi 3: Histori */}
      <section data-testid="section-histori" className="mb-6">
        <HistoriList />
        <span className="sr-only" data-testid="histori-count">Menampilkan 5 terbaru</span>
      </section>

      <span className="sr-only" data-testid="promo-active-count">{activePromoCount} promo aktif</span>
    </div>
  );
}

export default DashboardPage;
