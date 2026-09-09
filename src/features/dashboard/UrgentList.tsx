import { useMemo, useState, useEffect } from "react";
import Badge from "../../components/Badge";
import { daysToExpiry, peringkat } from "../../engine/expiry";
import { realRepo } from "../../db/dexieRepository";
import { seedDefaultKategoris } from "../../db/seed";

export type UrgentListProps = {
  onViewSuggestion?: (batchId: string) => void;
  actions?: boolean;
};

type RealUrgentBatch = {
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
};

export function UrgentList({ onViewSuggestion, actions = true }: UrgentListProps) {
  const goKritis = () => {
    window.history.pushState({}, "", "/kritis");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const [kategoriFilter, setKategoriFilter] = useState("Semua");
  const [sortBy, setSortBy] = useState<"expiry" | "urgency">("expiry");
  const [visibleCount, setVisibleCount] = useState(50);
  const [realBatches, setRealBatches] = useState<RealUrgentBatch[]>([]);
  const [kategoriOptions, setKategoriOptions] = useState<{ id: string; nama: string }[]>([]);
  const [loading, setLoading] = useState(true);

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
        for (const t of transaksis) totals.set(t.sku_id, (totals.get(t.sku_id) ?? 0) + ((t as unknown as { qty_sold?: number }).qty_sold ?? 1));
        const avgMap = new Map<string, number>();
        for (const [k, v] of totals) avgMap.set(k, v / 14);

        const urgent: RealUrgentBatch[] = [];
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
          urgent.push({
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
          });
        }
        urgent.sort((a, b) => {
          if (sortBy === "urgency") return a.peringkat - b.peringkat;
          if (a.daysToExpiry !== b.daysToExpiry) return a.daysToExpiry - b.daysToExpiry;
          return a.peringkat - b.peringkat;
        });
        if (!cancelled) {
          setKategoriOptions(kategoris.map((k) => ({ id: k.id, nama: k.nama })));
          setRealBatches(urgent);
          setLoading(false);
        }
      } catch (e) {
        console.error("UrgentList real fetch error", e);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today, sortBy]);

  useEffect(() => {
    (window as unknown as { __RESET_REAL_DATA__?: () => Promise<void> }).__RESET_REAL_DATA__ = async () => {
      try {
        await (realRepo as unknown as { clearAll?: (org: string) => Promise<void> }).clearAll?.("toko-01");
      } catch {}
      try {
        indexedDB.deleteDatabase("inventaris-tebus-murah");
        indexedDB.deleteDatabase("inventaris-tebus-murah-v2");
      } catch {}
      location.reload();
    };
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("reset") === "1") {
        (window as unknown as { __RESET_REAL_DATA__?: () => Promise<void> }).__RESET_REAL_DATA__?.();
      }
    } catch {}
  }, []);

  const urgentBatches = realBatches;

  const filtered = useMemo(() => {
    if (kategoriFilter === "Semua") return urgentBatches;
    return urgentBatches.filter((b) => b.kategori_name === kategoriFilter);
  }, [urgentBatches, kategoriFilter]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;
  const totalCount = filtered.length;

  const handleKategoriChange = (nama: string) => {
    setKategoriFilter(nama);
    setVisibleCount(50);
  };



  const showLoading = loading;

  return (
    <section className="w-full" aria-labelledby="urgent-heading">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="urgent-heading" className="text-lg font-bold">
          Stok Mepet
        </h2>
        <span role="status" aria-live="polite" className="text-sm text-base-content/70 shrink-0">
          {showLoading ? "Memuat..." : totalCount === 0 ? "Aman semua" : `${totalCount} perlu perhatian`}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <label className="sr-only" htmlFor="filter-kategori">
          Filter kategori
        </label>
        <select
          id="filter-kategori"
          data-testid="filter-kategori"
          aria-label="Filter kategori"
          value={kategoriFilter}
          onChange={(e) => handleKategoriChange(e.target.value)}
          className="select select-bordered min-h-12 text-base font-medium w-full sm:max-w-60"
        >
          <option value="Semua">Semua kategori</option>
          {kategoriOptions.map((k) => (
            <option key={k.id} value={k.nama}>
              {k.nama}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="sort-order">
          Urutkan stok mepet
        </label>
        <select
          id="sort-order"
          data-testid="sort-order"
          aria-label="Urutkan stok mepet"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "expiry" | "urgency")}
          className="select select-bordered min-h-12 text-base font-medium w-full sm:max-w-60"
        >
          <option value="expiry">Urut: paling dekat</option>
          <option value="urgency">Urut: paling mendesak</option>
        </select>
      </div>

      {showLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div role="status" className="card card-border bg-base-100">
          <div className="card-body items-center text-center">
            <p className="text-base font-semibold">Stok aman semua</p>
            <p className="text-base text-base-content/70 leading-relaxed">
              Tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Daftar stok mepet">
          {visible.map((b) => (
            <li key={b.id} className="card card-border bg-base-100">
              <div className="card-body gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="card-title text-base leading-snug">{b.sku_name}</p>
                    <p className="text-base text-base-content/70">
                      Sisa {b.qty} pcs • kadaluarsa {b.expiry_date}
                    </p>
                    {b.kategori_name ? (
                      <span className="badge badge-soft badge-sm mt-1.5">{b.kategori_name}</span>
                    ) : null}
                  </div>
                  <Badge daysToExpiry={b.daysToExpiry} qty={b.qty} expiryDate={b.expiry_date as string} showIcon />
                </div>
                <div className="card-actions flex-col items-stretch">
                  {actions ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onViewSuggestion?.(b.id)}
                        className="btn btn-primary btn-block min-h-12 text-base font-semibold"
                        aria-label={`Lihat saran tebus untuk ${b.sku_name}`}
                      >
                        Lihat Saran Tebus
                      </button>
                      <button
                        type="button"
                        data-testid={`sku-detail-${b.sku_id}`}
                        aria-label={`Lihat detail ${b.sku_name}`}
                        onClick={() => {
                          window.history.pushState({}, "", `/sku/${b.sku_id}`);
                          window.dispatchEvent(new PopStateEvent("popstate"));
                        }}
                        className="btn btn-ghost btn-block min-h-12 text-base font-semibold"
                      >
                        Detail Barang
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      data-testid={`urgent-lihat-${b.id}`}
                      aria-label={`Lihat daftar kritis ${b.sku_name}`}
                      onClick={goKritis}
                      className="btn btn-outline btn-block min-h-12 text-base font-semibold"
                    >
                      Lihat
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button type="button" onClick={() => setVisibleCount(filtered.length)} className="btn btn-outline btn-block min-h-12 mt-4 text-base font-semibold">
          Lihat semua ({filtered.length - visibleCount} lagi)
        </button>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {totalCount} item mepet kadaluarsa
      </div>
    </section>
  );
}

export default UrgentList;
