/**
 * TASK-16 [FRD-03] — Halaman khusus kritis
 *
 * Definisi kritis: days_to_expiry <= max(threshold_h_minus) kategori induk SKU-nya.
 * Contoh: kategori [14,7,3] → kritis jika H<=14; badge warna dinamis:
 *   H <= nilai terkecil (3) → merah #C62828
 *   H <= nilai tengah (7)   → oranye #EF6C00
 *   H <= nilai terbesar (14) → kuning #F9A825
 * Default [7,3,1] mapping tetap 1 merah, 3 oranye, 7 kuning.
 *
 * List per-batch kritis (nama SKU, sisa qty, H-remaining, urgensi), tap → /sku/:id
 * Dashboard hanya badge/banner (di DashboardPage), bukan daftar lengkap.
 * Threshold baca dari DB kategori.threshold_h_minus, tidak hardcode.
 */

import { useEffect, useMemo, useState } from "react";
import { WarningCircle, Package, ArrowLeft } from "iconoir-react";
import { daysToExpiry, urgencyScore } from "../../engine/expiry";
import { realRepo } from "../../db/dexieRepository";
import { seedDefaultKategoris } from "../../db/seed";
import { FakeRepository, type UrgentBatch as FakeUrgentBatch } from "../../lib/fakeRepository";
import { PageHeader, EmptyState } from "../../components/ui";

export type KritisPageProps = {
  useRealData?: boolean;
  batchesOverride?: FakeUrgentBatch[];
};

type KritisBatch = {
  id: string;
  sku_id: string;
  sku_name: string;
  kategori_id: string;
  kategori_name: string;
  qty: number;
  expiry_date: string | null;
  received_at: string;
  hpp_snapshot: number;
  org_id: string;
  daysToExpiry: number;
  urgencyScore: number;
  threshold_h_minus: number[];
};

function badgeStyleForKategori(days: number, threshold: number[]): { bg: string; color: string } {
  // threshold expected descending e.g. [14,7,3] or [7,3,1]
  // sort descending to be safe
  const sorted = [...threshold].sort((a, b) => b - a);
  const max = sorted[0] ?? 7;
  const mid = sorted[1] ?? max;
  const min = sorted[sorted.length - 1] ?? mid;
  if (days <= min) return { bg: "#C62828", color: "#FFFFFF" };
  if (sorted.length >= 2 && days <= mid) return { bg: "#EF6C00", color: "#FFFFFF" };
  if (days <= max) return { bg: "#F9A825", color: "#1A1A1A" };
  return { bg: "#D9D9D9", color: "#1A1A1A" };
}

function toSkuDetailUrl(skuId: string) {
  return `/sku/${skuId}`;
}

export function KritisPage({ useRealData = true, batchesOverride }: KritisPageProps) {
  const [loading, setLoading] = useState(true);
  const [kritisBatches, setKritisBatches] = useState<KritisBatch[]>([]);
  const [fakeRepo] = useState(() => new FakeRepository());
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    if (batchesOverride) {
      const mapped: KritisBatch[] = (batchesOverride as unknown as KritisBatch[]).sort((a, b) => a.daysToExpiry - b.daysToExpiry);
      setKritisBatches(mapped);
      setLoading(false);
      return;
    }

    if (!useRealData) {
      const win = typeof window !== "undefined" ? (window as unknown as { __FAKE_SEED_MODE?: string }) : null;
      const mode = win?.__FAKE_SEED_MODE;
      if (mode === "many") fakeRepo.seedManyUrgent(60, today);
      else if (mode === "demo") fakeRepo.seedUrgentDemo(today);
      else if (mode === "empty") { fakeRepo.clear(); }
      const urgent = fakeRepo.getUrgentBatches(today, "expiry") as unknown as KritisBatch[];
      // enrich threshold_h_minus from kategoris
      const kategoriMap = new Map(fakeRepo.kategoris.map((k) => [k.id, k.threshold_h_minus]));
      for (const b of urgent) {
        const thr = kategoriMap.get(b.kategori_id) ?? [7, 3, 1];
        (b as KritisBatch).threshold_h_minus = thr;
      }
      // filter already done by getUrgentBatches (days <= max), but ensure sorted expiry asc
      urgent.sort((a, b) => a.daysToExpiry - b.daysToExpiry || a.urgencyScore - b.urgencyScore);
      setKritisBatches(urgent);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const existingKategoris = await realRepo.listKategoris("toko-01").catch(() => []);
        if (existingKategoris.length === 0) {
          await seedDefaultKategoris(realRepo as unknown as import("../../db/db").InventoryRepository).catch(() => {});
        }

        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const urlSeed = params?.get("seed");
        if (urlSeed === "empty") {
          if (!cancelled) { setKritisBatches([]); setLoading(false); }
          return;
        }
        if (urlSeed === "expiryNull") {
          if (!cancelled) { setKritisBatches([]); setLoading(false); }
          return;
        }
        if (urlSeed === "demo" || urlSeed === "many") {
          // For e2e, use fake even in real mode so threshold per kategori is predictable
          if (urlSeed === "demo") fakeRepo.seedUrgentDemo(today);
          else fakeRepo.seedManyUrgent(60, today);
          const urgent = fakeRepo.getUrgentBatches(today, "expiry") as unknown as KritisBatch[];
          const kategoriMap = new Map(fakeRepo.kategoris.map((k) => [k.id, k.threshold_h_minus]));
          for (const b of urgent) (b as KritisBatch).threshold_h_minus = kategoriMap.get((b as unknown as { kategori_id: string }).kategori_id) ?? [7, 3, 1];
          urgent.sort((a, b) => a.daysToExpiry - b.daysToExpiry || a.urgencyScore - b.urgencyScore);
          if (!cancelled) { setKritisBatches(urgent); setLoading(false); }
          return;
        }

        // Real Dexie path
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
          // Definisi kritis: days <= max threshold
          if (days > maxThreshold) continue;
          const avg = avgMap.get(b.sku_id) ?? 1;
          const score = urgencyScore(b.qty, days, avg);
          result.push({
            id: b.id,
            sku_id: b.sku_id,
            sku_name: sku?.nama ?? b.sku_id,
            kategori_id: kategori?.id ?? "",
            kategori_name: kategori?.nama ?? "",
            qty: b.qty,
            expiry_date: b.expiry_date,
            received_at: b.received_at,
            hpp_snapshot: b.hpp_snapshot,
            org_id: b.org_id,
            daysToExpiry: days,
            urgencyScore: score,
            threshold_h_minus: threshold,
          });
        }
        result.sort((a, b) => {
          if (a.daysToExpiry !== b.daysToExpiry) return a.daysToExpiry - b.daysToExpiry;
          return a.urgencyScore - b.urgencyScore;
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
    return () => { cancelled = true; };
  }, [today, useRealData, batchesOverride, fakeRepo]);

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
      <div data-testid="kritis-page" className="w-full max-w-[720px] mx-auto px-4">
        <p className="text-[16px] text-[#595959]" role="status">Memuat batch kritis...</p>
      </div>
    );
  }

  return (
    <div data-testid="kritis-page" className="w-full max-w-[720px] mx-auto px-4">
      <button
        type="button"
        data-testid="kritis-back"
        onClick={handleBack}
        className="btn btn-ghost rounded-xl gap-1.5 self-start mb-4 min-h-[48px] text-[16px]"
        aria-label="Kembali ke dashboard"
      >
        <ArrowLeft width={16} height={16} /> Kembali
      </button>

      <PageHeader
        title="Stok Kritis"
        subtitle="Batch dengan sisa hari ≤ batas terbesar kategori. Urut kadaluarsa terdekat di atas. Tap lihat detail SKU."
        icon={<WarningCircle width={20} height={20} />}
        testId="kritis-header"
      />

      {kritisBatches.length === 0 ? (
        <div
          data-testid="kritis-empty"
          role="status"
          aria-live="polite"
          className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-8 text-center flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] border border-[#A5D6A7]/60 flex items-center justify-center text-[#0F7A4A] mb-4">
            <Package width={28} height={28} />
          </div>
          <h3 className="text-[16px] font-bold text-[#1A1A1A]">Tidak ada batch kritis</h3>
          <p className="text-sm text-[#595959] mt-1.5 leading-relaxed max-w-sm">
            Stok aman, tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi atau saat ada batch baru.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-[#595959] mb-3" aria-live="polite">
            Menampilkan {kritisBatches.length} batch kritis — tap untuk lihat detail SKU
          </p>
          <ul data-testid="kritis-list" aria-label="Daftar batch kritis" className="flex flex-col gap-3">
            {kritisBatches.map((b) => {
              const { bg, color } = badgeStyleForKategori(b.daysToExpiry, b.threshold_h_minus);
              const hRemaining = `H-${b.daysToExpiry}`;
              return (
                <li
                  key={b.id}
                  data-testid="kritis-item"
                  className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <WarningCircle width={16} height={16} aria-hidden="true" className="text-[#1A1A1A] shrink-0" />
                        <span className="font-semibold text-[#1A1A1A] truncate" style={{ fontSize: "16px" }}>
                          {b.sku_name}
                        </span>
                      </div>
                      <p className="text-sm text-[#595959]" style={{ fontSize: "16px" }}>
                        Sisa {b.qty} pcs • exp {b.expiry_date}
                      </p>
                      <p className="text-xs text-[#595959] mt-1">
                        Urgensi: {b.urgencyScore.toFixed(1)} • {b.kategori_name} • Threshold [{b.threshold_h_minus.join(",")}]
                      </p>
                    </div>
                    <span
                      data-testid="kritis-badge"
                      role="status"
                      aria-label={`Batch ${b.sku_name} ${hRemaining}, ${b.qty} pcs`}
                      className="badge gap-1 border-none font-bold rounded-full shrink-0"
                      style={{
                        backgroundColor: bg,
                        color,
                        fontSize: "14px",
                        padding: "4px 10px",
                        height: "24px",
                        borderRadius: "8px",
                      }}
                    >
                      <WarningCircle width={14} height={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                      <span data-testid="kritis-h-remaining">{hRemaining}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="kritis-tombol-lihat-detail"
                    onClick={() => handleLihatDetail(b.sku_id)}
                    aria-label={`Lihat detail ${b.sku_name}`}
                    className="btn btn-primary w-full min-h-[48px] text-[16px] font-semibold rounded-xl shadow-sm"
                    style={{ minHeight: "48px", fontSize: "16px" }}
                  >
                    Lihat Detail
                  </button>
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
