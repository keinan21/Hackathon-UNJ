import { useMemo, useState } from "react";
import { FakeRepository } from "../../lib/fakeRepository";
import BatchCard from "../../components/BatchCard";

export type DashboardPageProps = {
  seedMode?: "demo" | "many" | "empty" | "expiryNull";
};

const FILTERS = ["Semua", "Dairy", "Snack", "Beras"] as const;

function variantFromDays(days: number | null): "danger" | "warning" | "caution" | "safe" {
  if (days === null) return "safe";
  if (days <= 1) return "danger";
  if (days <= 3) return "warning";
  if (days <= 7) return "caution";
  return "safe";
}

export function DashboardPage({ seedMode = "demo" }: DashboardPageProps) {
  const [activeFilter, setActiveFilter] = useState<string>("Semua");

  const batches = useMemo(() => {
    const repo = new FakeRepository();
    const today = new Date();
    if (seedMode === "empty") {
      repo.clear();
    } else if (seedMode === "many") {
      repo.seedManyUrgent(60, today);
    } else if (seedMode === "expiryNull") {
      repo.clear();
      repo.batches = [
        {
          id: "b-null",
          sku_id: "sku-susu",
          sku_name: "Susu UHT 1L",
          kategori_id: "k-dairy",
          kategori_name: "Dairy",
          qty: 10,
          expiry_date: null,
          received_at: new Date().toISOString(),
          hpp_snapshot: 10000,
          org_id: "toko-01",
          avg_daily_usage: 2,
        },
      ];
    } else {
      repo.seedUrgentDemo(today);
    }
    // respect window injection
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("seed") === "empty") {
        repo.clear();
      }
    }
    return repo.getUrgentBatches(today, "expiry");
  }, [seedMode]);

  const filtered = useMemo(() => {
    if (activeFilter === "Semua") return batches;
    return batches.filter((b) => b.kategori_name === activeFilter);
  }, [batches, activeFilter]);

  // summary numbers persis dashboard html static
  const totalSku = 1248;
  const urgentCount = batches.length;
  const proposedPromos = 5;

  return (
    <div data-testid="dashboard-page" className="w-full flex flex-col gap-lg mt-md">
      {/* Seksi Sambutan & Ringkasan */}
      <section className="flex flex-col gap-md" aria-labelledby="greeting-heading">
        <div>
          <h2 id="greeting-heading" className="font-headline-md text-headline-md text-primary">
            Halo, Supervisor
          </h2>
          <p className="font-body-md text-body-md text-slate-gray">Ringkasan stok hari ini.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {/* Kartu 1 */}
          <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md shadow-sm flex flex-col gap-sm">
            <span className="font-body-md text-body-md text-slate-gray">Total SKU</span>
            <span className="font-headline-lg text-headline-lg text-primary">{totalSku.toLocaleString("id-ID")}</span>
          </div>
          {/* Kartu 2 - Urgent */}
          <a
            href="#stok-mepet"
            aria-label={`Lihat stok mepet ${urgentCount} batch`}
            className="bg-error-container border-2 border-danger rounded-xl p-md shadow-sm flex flex-col gap-sm relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity min-h-[48px]"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-critical-red" aria-hidden="true" />
            <span className="font-body-md text-body-md text-on-error-container pl-sm">Urgent Batches</span>
            <span className="font-headline-lg text-headline-lg text-on-error-container pl-sm">{urgentCount}</span>
          </a>
          {/* Kartu 3 */}
          <div className="bg-secondary-fixed border border-secondary-fixed rounded-xl p-md shadow-sm flex flex-col gap-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning" aria-hidden="true" />
            <span className="font-body-md text-body-md text-on-secondary-fixed pl-sm">Proposed Promos</span>
            <span className="font-headline-lg text-headline-lg text-on-secondary-fixed pl-sm">{proposedPromos}</span>
          </div>
        </div>
      </section>

      {/* Filter Kategori Chips */}
      <section aria-label="Filter kategori" className="flex flex-col gap-sm">
        <span className="font-body-md text-body-md text-slate-gray">Filter kategori</span>
        <div className="flex flex-wrap gap-sm">
          {FILTERS.map((cat) => {
            const active = activeFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveFilter(cat)}
                className={`min-h-[48px] px-4 py-2 rounded-full font-body-md text-body-md transition-colors ${
                  active
                    ? "bg-primary text-on-primary hover:bg-primary-pressed"
                    : "bg-surface-container-lowest border border-border-subtle text-text-primary hover:bg-surface-container-low"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Stok Mepet */}
      <section id="stok-mepet" className="flex flex-col gap-md" aria-labelledby="stok-mepet-heading">
        <h3 id="stok-mepet-heading" className="font-headline-md text-headline-md text-primary">
          Stok Mepet
        </h3>
        {filtered.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md shadow-sm flex flex-col items-center gap-3 text-center py-8"
            data-testid="empty-stok-aman"
          >
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 0", fontSize: 48 }} aria-hidden="true">
              check_circle
            </span>
            <p className="font-body-md text-body-md text-text-primary">Stok aman, tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            {filtered.slice(0, 3).map((b) => (
              <BatchCard
                key={b.id}
                batchId={b.id}
                skuName={b.sku_name ?? b.sku_id}
                qty={b.qty}
                expiryDate={b.expiry_date}
                daysToExpiry={b.daysToExpiry}
                urgencyScore={b.urgencyScore}
                variant={variantFromDays(b.daysToExpiry)}
              />
            ))}
            {filtered.length > 3 && (
              <p className="font-body-md text-body-md text-slate-gray text-sm">Menampilkan 3 dari {filtered.length} stok mepet</p>
            )}
          </div>
        )}
      </section>

      {/* Saran Tebus Murah */}
      <section className="flex flex-col gap-md" aria-labelledby="saran-heading">
        <h3 id="saran-heading" className="font-headline-md text-headline-md text-primary">
          Saran Tebus Murah
        </h3>
        <div className="bg-primary-fixed border border-primary-fixed-dim rounded-xl p-md shadow-sm flex flex-col gap-md">
          <div className="flex items-start gap-sm">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
              psychology
            </span>
            <div className="flex flex-col gap-xs">
              <span className="font-headline-md text-headline-md text-primary text-base">Usulan Tebus Murah: Paket Sarapan</span>
              <p className="font-body-md text-body-md text-on-primary-fixed-variant">
                Pasangkan Susu UHT 1L (mepet kadaluarsa) dengan Roti Tawar Gandum diskon 20% agar stok cepat habis tanpa rugi.
              </p>
            </div>
          </div>
          <div className="flex gap-sm w-full">
            <button
              type="button"
              aria-label="Tutup saran"
              className="flex-1 min-h-[48px] bg-surface-container-lowest border border-border-subtle text-primary font-body-md text-body-md py-3 px-5 rounded-lg hover:bg-surface-container-low transition-colors"
            >
              Tutup
            </button>
            <button
              type="button"
              aria-label="Lihat dan setujui tebus murah Paket Sarapan harga 9000"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("app:navigate", { detail: "promo" }));
                const el = document.querySelector('[data-testid="nav-promo"]') as HTMLElement | null;
                el?.click();
              }}
              className="flex-1 min-h-[48px] bg-primary text-on-primary font-body-md text-body-md py-3 px-5 rounded-lg hover:bg-primary-pressed transition-colors"
            >
              Lihat &amp; Setujui
            </button>
          </div>
        </div>
      </section>

      {/* Keep legacy sections hidden for compat but not visible */}
      <span className="sr-only" data-testid="promo-active-count">
        5 promo aktif
      </span>
    </div>
  );
}

export default DashboardPage;
