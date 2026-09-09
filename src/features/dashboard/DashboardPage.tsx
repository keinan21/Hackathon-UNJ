import { useEffect, useState } from "react";
import { UrgentList } from "./UrgentList";
import { PromoAktifList } from "../promo/PromoAktifList";
import { HistoriList } from "./HistoriList";
import { WarningCircle, Package, StatsReport, ShoppingBag, Plus } from "iconoir-react";
import { daysToExpiry } from "../../engine/expiry";
import { realRepo } from "../../db/dexieRepository";

function KritisBanner() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) return null;
  if (count === 0) return null;

  const handleClick = () => {
    window.history.pushState({}, "", `/kritis`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div data-testid="kritis-banner" role="alert" className="alert alert-error alert-soft mb-6">
      <WarningCircle width={20} height={20} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-bold">Ada {count} batch kritis</p>
        <p className="text-sm opacity-80">Tap untuk lihat daftar lengkap per batch</p>
      </div>
      <button
        type="button"
        data-testid="kritis-banner-link"
        onClick={handleClick}
        aria-label={`Lihat ${count} batch kritis`}
        className="btn btn-error btn-sm min-h-12 px-5 text-base font-semibold shrink-0"
      >
        Lihat Kritis
      </button>
    </div>
  );
}

function go(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function goSkuView() {
  window.dispatchEvent(new CustomEvent("warung-navigate", { detail: { view: "sku" } }));
}

const HUB_BUTTONS = [
  { id: "hub-masuk", label: "Barang Masuk", icon: <Plus width={26} height={26} aria-hidden="true" />, onClick: () => go("/masuk") },
  { id: "hub-kasir", label: "Kasir", icon: <ShoppingBag width={26} height={26} aria-hidden="true" />, onClick: () => go("/keluar") },
  { id: "hub-sku", label: "Lihat SKU", icon: <Package width={26} height={26} aria-hidden="true" />, onClick: goSkuView },
  { id: "hub-statistik", label: "Statistik", icon: <StatsReport width={26} height={26} aria-hidden="true" />, onClick: () => go("/statistik") },
];

function NavHub() {
  return (
    <nav data-testid="hub-nav" aria-label="Navigasi cepat warung" className="grid grid-cols-2 gap-3 mb-6">
      {HUB_BUTTONS.map((b) => (
        <button
          key={b.id}
          type="button"
          data-testid={b.id}
          onClick={b.onClick}
          aria-label={b.label}
          className="btn btn-primary min-h-16 text-base font-bold flex-col gap-1 py-4 rounded-2xl"
        >
          {b.icon}
          {b.label}
        </button>
      ))}
    </nav>
  );
}

export function DashboardPage() {
  const [skuCount, setSkuCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const skus = await realRepo.listSkus("toko-01");
        if (!cancelled) setSkuCount(skus.length);
      } catch {
        if (!cancelled) setSkuCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTambahSku = () => {
    window.history.pushState({}, "", "/sku/baru");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const isEmpty = skuCount !== null && skuCount === 0;

  return (
    <div data-testid="dashboard-page" className="w-full">
      <KritisBanner />
      <NavHub />

      <div className="space-y-6">
        {isEmpty && (
          <div data-testid="dashboard-empty" role="status" className="card card-border bg-base-100">
            <div className="card-body items-center text-center">
              <div className="bg-base-200 text-base-content/70 flex h-14 w-14 items-center justify-center rounded-field">
                <Package width={26} height={26} />
              </div>
              <h3 className="card-title text-base">Belum ada SKU</h3>
              <p className="text-base text-base-content/70 leading-relaxed max-w-sm">
                Tambah barang pertama biar stok toko tercatat rapi di HP ini.
              </p>
              <div className="card-actions">
                <button
                  type="button"
                  data-testid="dashboard-empty-cta"
                  onClick={handleTambahSku}
                  className="btn btn-primary min-h-12 text-base font-semibold"
                  aria-label="Tambah SKU"
                >
                  Tambah SKU
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <section data-testid="section-urgent" className="lg:col-span-3 min-w-0">
            <UrgentList actions={false} />
          </section>
          <section data-testid="section-promo" className="lg:col-span-2 min-w-0 lg:sticky lg:top-20">
            <PromoAktifList actions={false} />
          </section>
        </div>

        <div className="divider my-0" aria-hidden="true" />

        <section data-testid="section-histori">
          <HistoriList />
          <span className="sr-only" data-testid="histori-count">Menampilkan histori terbaru</span>
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;
