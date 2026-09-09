/**
 * TASK-16 [FRD-03] — Halaman khusus kritis — real Dexie only
 *
 * Definisi kritis: days_to_expiry <= max(threshold_h_minus) kategori induk SKU-nya.
 * Contoh: kategori [14,7,3] → kritis jika H<=14; badge warna dinamis:
 *   H <= nilai terkecil (3) → merah #C62828
 *   H <= nilai tengah (7)   → oranye #EF6C00
 *   H <= nilai terbesar (14) → kuning #F9A825
 * Default [7,3,1] mapping tetap 1 merah, 3 oranye, 7 kuning.
 */

import { useEffect, useMemo, useState } from "react";
import { WarningCircle, Package, ArrowLeft } from "iconoir-react";
import { daysToExpiry, peringkat } from "../../engine/expiry";
import { realRepo } from "../../db/dexieRepository";
import { seedDefaultKategoris } from "../../db/seed";
import { PageHeader } from "../../components/ui";
import { SaranTebusButton } from "../promo/SaranTebusButton";

export type KritisPageProps = Record<string, never>;

type KritisBatch = {
  id: string;
  sku_id: string;
  sku_name: string;
  kategori_id: string;
  kategori_name: string;
  qty: number;
  expiry_date: string | null;
  received_at: string;
  modal_snapshot: number;
  org_id: string;
  daysToExpiry: number;
  peringkat: number;
  threshold_h_minus: number[];
};

function badgeClassForKategori(days: number, threshold: number[]): string {
  const sorted = [...threshold].sort((a, b) => b - a);
  const max = sorted[0] ?? 7;
  const mid = sorted[1] ?? max;
  const min = sorted[sorted.length - 1] ?? mid;
  if (days <= min) return "badge-error";
  if (sorted.length >= 2 && days <= mid) return "badge-warning";
  return "badge-info";
}

function toSkuDetailUrl(skuId: string) {
  return `/sku/${skuId}`;
}

export function KritisPage(_props: KritisPageProps) {
  const [loading, setLoading] = useState(true);
  const [kritisBatches, setKritisBatches] = useState<KritisBatch[]>([]);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existingKategoris = await realRepo.listKategoris("toko-01").catch(() => []);
        if (existingKategoris.length === 0) {
          await seedDefaultKategoris(realRepo as unknown as import("../../db/db").InventoryRepository).catch(() => {});
        }
        const batches = await realRepo.listBatchesExpiring("toko-01");
        const kategoris = await realRepo.listKategoris("toko-01");
        const kategoriMap = new Map(kategoris.map((k) => [k.id, k]));
        const skus = await realRepo.listSkus("toko-01");
        const skuMap = new Map(skus.map((s) => [s.id, s]));
        const transaksis = await realRepo.listTransaksis("toko-01").catch(() => []);
        const totals = new Map<string, number>();
        for (const t of transaksis) {
          const sold = (t as unknown as { qty_sold?: number }).qty_sold ?? 1;
          totals.set(t.sku_id, (totals.get(t.sku_id) ?? 0) + sold);
        }
        const avgMap = new Map<string, number>();
        for (const [k, v] of totals) avgMap.set(k, v / 14);

        const result: KritisBatch[] = [];
        for (const b of batches) {
          if (b.expiry_date === null) continue;
          const days = daysToExpiry(b.expiry_date, today);
          if (days === null) continue;
          const sku = skuMap.get(b.sku_id);
          const kategori = sku ? kategoriMap.get(sku.kategori_id) : undefined;
          const threshold = kategori?.threshold_h_minus ?? [7, 3, 1];
          const maxThreshold = Math.max(...threshold);
          if (days > maxThreshold) continue;
          const avg = avgMap.get(b.sku_id) ?? 1;
          const score = peringkat(b.qty, days, avg);
          result.push({
            id: b.id,
            sku_id: b.sku_id,
            sku_name: sku?.nama ?? b.sku_id,
            kategori_id: kategori?.id ?? "",
            kategori_name: kategori?.nama ?? "",
            qty: b.qty,
            expiry_date: b.expiry_date,
            received_at: b.received_at,
            modal_snapshot: b.modal_snapshot,
            org_id: b.org_id,
            daysToExpiry: days,
            peringkat: score,
            threshold_h_minus: threshold,
          });
        }
        result.sort((a, b) => {
          if (a.daysToExpiry !== b.daysToExpiry) return a.daysToExpiry - b.daysToExpiry;
          return a.peringkat - b.peringkat;
        });
        if (!cancelled) {
          setKritisBatches(result);
          setLoading(false);
        }
      } catch (e) {
        console.error("KritisPage fetch error", e);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today]);

  const handleLihatDetail = (skuId: string) => {
    window.history.pushState({}, "", toSkuDetailUrl(skuId));
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleBack = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (loading) {
    return (
      <div data-testid="kritis-page" className="w-full max-w-3xl">
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="kritis-page" className="w-full max-w-3xl">
      <button
        type="button"
        data-testid="kritis-back"
        onClick={handleBack}
        className="btn btn-ghost btn-sm min-h-12 gap-1.5 self-start mb-4 text-base"
        aria-label="Kembali ke dashboard"
      >
        <ArrowLeft width={16} height={16} /> Kembali
      </button>

      <PageHeader
        title="Stok Kritis"
        subtitle="Urut dari yang paling mepet. Tap satu untuk lihat detail barangnya."
        icon={<WarningCircle width={20} height={20} />}
        testId="kritis-header"
      />

      {kritisBatches.length === 0 ? (
        <div
          data-testid="kritis-empty"
          role="status"
          className="card card-border bg-base-100"
        >
          <div className="card-body items-center text-center">
            <div className="bg-base-200 text-base-content/70 flex h-14 w-14 items-center justify-center rounded-field">
              <Package width={26} height={26} aria-hidden="true" />
            </div>
            <h3 className="card-title text-base">Aman, tidak ada yang kritis</h3>
            <p className="text-base text-base-content/70 leading-relaxed max-w-sm">
              Tidak ada stok yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-base-content/70 mb-3" aria-live="polite">
            {kritisBatches.length} batch perlu perhatian — tap untuk lihat detail
          </p>
          <ul data-testid="kritis-list" aria-label="Daftar batch kritis" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {kritisBatches.map((b) => {
              const hRemaining = `H-${b.daysToExpiry}`;
              return (
                <li
                  key={b.id}
                  data-testid="kritis-item"
                  className="card card-border bg-base-100"
                >
                  <div className="card-body gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="card-title text-base leading-snug">{b.sku_name}</p>
                        <p className="text-base text-base-content/70">
                          Sisa {b.qty} • kedaluwarsa {b.expiry_date}
                        </p>
                        {b.kategori_name ? (
                          <span className="badge badge-soft badge-sm mt-1.5">{b.kategori_name}</span>
                        ) : null}
                      </div>
                      <span
                        data-testid="kritis-badge"
                        role="status"
                        aria-label={`Batch ${b.sku_name} ${hRemaining}, ${b.qty} pcs`}
                        className={`badge badge-sm gap-1 font-semibold shrink-0 ${badgeClassForKategori(b.daysToExpiry, b.threshold_h_minus)}`}
                      >
                        <WarningCircle width={12} height={12} aria-hidden="true" />
                        <span data-testid="kritis-h-remaining">{hRemaining}</span>
                      </span>
                    </div>
                    <div className="card-actions flex-col items-stretch">
                      <SaranTebusButton batchId={b.id} orgId={b.org_id} skuName={b.sku_name} />
                      <button
                        type="button"
                        data-testid="kritis-tombol-lihat-detail"
                        onClick={() => handleLihatDetail(b.sku_id)}
                        aria-label={`Lihat detail ${b.sku_name}`}
                        className="btn btn-ghost btn-block min-h-12 text-base font-semibold"
                      >
                        Lihat Detail
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default KritisPage;
