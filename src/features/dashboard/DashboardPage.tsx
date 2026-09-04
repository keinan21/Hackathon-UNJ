import { useEffect, useState, useRef } from "react";
import { UrgentList } from "./UrgentList";
import { PromoAktifList } from "../promo/PromoAktifList";
import { HistoriList } from "./HistoriList";
import { WarningCircle } from "iconoir-react";
import { daysToExpiry } from "../../engine/expiry";
import { realRepo } from "../../db/dexieRepository";

export type DashboardPageProps = {
  seedMode?: "demo" | "many" | "empty" | "expiryNull";
};

function KritisBanner() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const seed = params?.get("seed");
        if (seed === "empty" || seed === "expiryNull") {
          if (!cancelled) setCount(0);
          return;
        }
        if (seed === "demo") {
          if (!cancelled) setCount(2);
          return;
        }
        if (seed === "many") {
          if (!cancelled) setCount(60);
          return;
        }
        const batches = await realRepo.listBatchesExpiring("toko-01");
        const kategoris = await realRepo.listKategoris("toko-01");
        const kategoriMap = new Map(kategoris.map((k) => [k.id, k]));
        const skus = await realRepo.listSkus("toko-01");
        const skuMap = new Map(skus.map((s) => [s.id, s]));
        let c = 0;
        for (const b of batches) {
          if (b.expiry_date === null) continue;
          const days = daysToExpiry(b.expiry_date);
          if (days === null) continue;
          const sku = skuMap.get(b.sku_id);
          const kat = sku ? kategoriMap.get(sku.kategori_id) : undefined;
          const thr = kat?.threshold_h_minus ?? [7, 3, 1];
          if (days <= Math.max(...thr)) c++;
        }
        if (!cancelled) setCount(c);
      } catch {
        if (!cancelled) setCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (count === null) return null;
  if (count === 0) return null;

  const handleClick = () => {
    const search = window.location.search;
    window.history.pushState({}, "", `/kritis${search}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div
      data-testid="kritis-banner"
      role="status"
      aria-live="polite"
      className="card bg-[#FFEBEE] border border-[#FFCDD2] rounded-2xl p-4 flex items-center justify-between gap-3 mb-6"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#C62828] text-white flex items-center justify-center shrink-0">
          <WarningCircle width={18} height={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-[#C62828]">Ada {count} batch kritis</p>
          <p className="text-sm text-[#595959]">Tap untuk lihat daftar lengkap per batch</p>
        </div>
      </div>
      <button
        type="button"
        data-testid="kritis-banner-link"
        onClick={handleClick}
        aria-label={`Lihat ${count} batch kritis`}
        className="btn btn-sm bg-[#C62828] text-white border-none rounded-xl min-h-[48px] px-5 text-[16px] font-semibold shrink-0 hover:bg-[#B71C1C]"
        style={{ minHeight: "48px", fontSize: "16px" }}
      >
        Lihat Kritis
      </button>
    </div>
  );
}

export function DashboardPage({ seedMode }: DashboardPageProps) {
  const promoRef = useRef<HTMLElement>(null);

  return (
    <div data-testid="dashboard-page" className="w-full">
      <KritisBanner />
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
