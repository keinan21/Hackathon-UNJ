/**
 * TASK-11 + TASK-29 [FRD-02/03] — Detail SKU 1-halaman + ChartArus lazy
 *
 * Agregasi dipindah ke src/engine/arus.ts (build14DaysJakarta, aggregateArus14, bep helper)
 * Grafik: ChartArus via React.lazy (chunk terpisah), bar ganda masuk #16a34a / keluar #dc2626,
 * sumbu-x DD-MM, sumbu-y qty+grid, tooltip Bahasa Indonesia, garis BEP amber #F59E0B.
 */

import { useEffect, useState, lazy, Suspense } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { SKU, Kategori, Batch, Tag, Transaksi } from "../../db/types";
import { daysToExpiry } from "../../engine/expiry";
import { build14DaysJakarta, aggregateArus14, formatJakarta } from "../../engine/arus";
import { AppButton, StatCard } from "../../components/ui";
import { ArrowLeft, Package, Hashtag, StatsReport, WarningCircle, Calendar, Box, Clock } from "iconoir-react";

const ChartArus = lazy(() => import("../../components/ChartArus"));

function getMaxThreshold(kategori: Kategori | undefined): number {
  const arr = kategori?.threshold_h_minus ?? [7, 3, 1];
  if (arr.length === 0) return 7;
  return Math.max(...arr);
}

export function SkuDetailPage({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [sku, setSku] = useState<SKU | null>(null);
  const [kategori, setKategori] = useState<Kategori | undefined>(undefined);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transaksis, setTransaksis] = useState<Transaksi[]>([]);
  const [allRecent, setAllRecent] = useState<Transaksi[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await realRepo.getSku(id);
        if (!s) {
          if (!cancelled) {
            setSku(null);
            setLoading(false);
          }
          return;
        }
        const [k, batchList, skuTags, transList] = await Promise.all([
          realRepo.getKategori(s.kategori_id).catch(() => undefined),
          realRepo.listBatchesBySku(s.id, "toko-01"),
          dexieV2.sku_tags.where("org_id").equals("toko-01").toArray().catch(() => []),
          realRepo.listTransaksisBySku(s.id, "toko-01").catch(() => []),
        ]);
        let tagNames: Tag[] = [];
        try {
          const allTags = await dexieV2.tags.where("org_id").equals("toko-01").toArray();
          const tagById = new Map(allTags.map((t) => [t.id, t]));
          const linked = skuTags.filter((st) => st.sku_id === s.id);
          tagNames = linked.map((st) => tagById.get(st.tag_id)).filter(Boolean) as Tag[];
        } catch {
          tagNames = [];
        }
        if (cancelled) return;
        setSku(s);
        setKategori(k as Kategori | undefined);
        setBatches(batchList);
        setTags(tagNames);
        setTransaksis(transList);
        setAllRecent(transList);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSku(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div data-testid="sku-detail-page" className="w-full max-w-[720px] mx-auto">
        <p data-testid="sku-detail-loading" className="text-[16px] text-[#595959]" role="status">
          Memuat detail SKU...
        </p>
      </div>
    );
  }

  if (!sku) {
    return (
      <div data-testid="sku-detail-page" className="w-full max-w-[720px] mx-auto space-y-4">
        <div className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FFEBEE] border border-[#FFCDD2]/60 flex items-center justify-center text-[#C62828] mx-auto mb-4">
            <WarningCircle width={28} height={28} />
          </div>
          <p data-testid="sku-detail-notfound" className="text-[16px] font-semibold text-[#C62828]">
            SKU tidak ditemukan
          </p>
          <p className="text-sm text-[#595959] mt-1">Coba kembali ke katalog dan pilih SKU lain.</p>
          <AppButton variant="outline" data-testid="sku-detail-back" onClick={() => { window.history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); }} className="mt-5 rounded-xl gap-1.5">
            <ArrowLeft width={16} height={16} /> Kembali
          </AppButton>
        </div>
      </div>
    );
  }

  const stokTotal = batches.reduce((a, b) => a + b.qty, 0);
  const marginPerPcs = sku.harga_normal - sku.hpp;
  const maxThreshold = getMaxThreshold(kategori);

  const fourteenDays = build14DaysJakarta();
  const fourteenSet = new Set(fourteenDays);

  const histori14 = allRecent
    .filter((t) => {
      try {
        const day = formatJakarta(new Date(t.sold_at));
        return fourteenSet.has(day);
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.sold_at.localeCompare(a.sold_at));

  const { masukPerDay, keluarPerDay, marginPerDay, days } = aggregateArus14(allRecent, sku, fourteenDays);

  const hasAnyTransaksiIn14 = histori14.length > 0;

  const handleBack = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div data-testid="sku-detail-page" className="w-full max-w-[720px] mx-auto space-y-5">
      <AppButton
        type="button"
        variant="ghost"
        data-testid="sku-detail-back"
        onClick={handleBack}
        className="rounded-xl gap-1.5 self-start"
      >
        <ArrowLeft width={16} height={16} /> Kembali
      </AppButton>

      {/* Header */}
      <div data-testid="sku-detail-header" className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0F7A4A]/10 text-[#0F7A4A] flex items-center justify-center shrink-0">
            <Package width={20} height={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 data-testid="sku-detail-nama" className="text-xl font-bold text-neutral leading-tight">
              {sku.nama}
            </h2>
            <p data-testid="sku-detail-kode" className="text-sm text-[#595959] mt-1 flex flex-wrap items-center gap-1">
              <span>Kode: {sku.kode ?? "-"} </span> {sku.barcode ? <span className="badge badge-sm bg-base-200 border-base-300 text-neutral">Barcode: {sku.barcode}</span> : null}
            </p>
            <p data-testid="sku-detail-kategori" className="text-sm text-[#595959] mt-1">
              Kategori: {kategori?.nama ?? "-"} • Threshold: [{kategori?.threshold_h_minus.join(",") ?? "7,3,1"}]
            </p>
            {tags.length > 0 && (
              <p data-testid="sku-detail-tags" className="text-xs text-[#595959] mt-2 flex items-center gap-1.5 flex-wrap">
                <Hashtag width={12} height={12} className="text-[#0F7A4A]" />
                {tags.map((t) => `#${t.nama}`).join(" ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Ringkasan stok — StatCard */}
      <div data-testid="sku-detail-ringkas" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Stok total" value={`${stokTotal} pcs`} icon={<Box width={18} height={18} />} variant="neutral" className="sm:col-span-1" />
        <div className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-4 sm:col-span-2">
          <p className="text-xs font-semibold tracking-wide opacity-70 uppercase">Harga & Margin</p>
          <p data-testid="sku-detail-stok-total" className="sr-only">Stok total: {stokTotal} pcs</p>
          <p data-testid="sku-detail-hpp" className="text-sm text-neutral mt-2 leading-relaxed">
            HPP: Rp{sku.hpp.toLocaleString("id-ID")} • Harga: Rp{sku.harga_normal.toLocaleString("id-ID")} • Margin: <span className="font-bold text-[#0F7A4A]">Rp{marginPerPcs.toLocaleString("id-ID")}/pcs</span>
          </p>
        </div>
      </div>

      {/* Batch list */}
      <div data-testid="sku-detail-batches" className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2">
          <Calendar width={16} height={16} className="text-[#0F7A4A]" /> Daftar Batch
        </h3>
        {batches.length === 0 ? (
          <p data-testid="sku-detail-batch-empty" className="text-sm text-[#595959] mt-3">
            Belum ada batch — tambah stok untuk melihat kadaluarsa.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" aria-label="Daftar batch">
            {batches.map((b) => {
              const daysExp = b.expiry_date !== null ? daysToExpiry(b.expiry_date) : null;
              const isKritis = b.expiry_date !== null && daysExp !== null && daysExp <= maxThreshold;
              return (
                <li
                  key={b.id}
                  data-testid={`batch-row-${b.id}`}
                  className={[
                    "flex justify-between items-center rounded-xl px-3 py-2.5 border text-sm gap-2",
                    isKritis ? "bg-[#FFEBEE] border-[#FFCDD2]" : "bg-base-200/60 border-base-300/40",
                  ].join(" ")}
                >
                  <span data-testid={`batch-info-${b.id}`} className="text-sm">
                    {b.qty} pcs • exp {b.expiry_date ?? "Tanpa kadaluarsa"} {daysExp !== null ? `(H-${daysExp})` : ""} • Rp{b.hpp_snapshot.toLocaleString("id-ID")}
                  </span>
                  {isKritis && (
                    <span
                      data-testid={`batch-kritis-${b.id}`}
                      className="badge badge-sm font-bold rounded-full text-white border-none shrink-0"
                      style={{ backgroundColor: "#C62828" }}
                    >
                      <WarningCircle width={10} height={10} /> Kritis
                    </span>
                  )}
                  {b.expiry_date === null && (
                    <span data-testid={`batch-tanpa-${b.id}`} className="text-xs text-[#595959] shrink-0">
                      Tanpa kadaluarsa
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Grafik — ChartArus lazy — JANGAN disentuh */}
      <div data-testid="sku-detail-grafik-section" className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2">
          <StatsReport width={16} height={16} className="text-[#0F7A4A]" /> Grafik Arus 14 Hari
        </h3>
        {hasAnyTransaksiIn14 ? (
          <div data-testid="sku-detail-grafik">
            <Suspense fallback={<p data-testid="chart-loading" className="text-sm text-[#595959]">Memuat grafik...</p>}>
              <ChartArus masukPerDay={masukPerDay} keluarPerDay={keluarPerDay} marginPerDay={marginPerDay} days={days} />
            </Suspense>
          </div>
        ) : (
          <p data-testid="grafik-empty" className="text-sm text-[#595959] mt-3">
            Belum ada transaksi 14 hari terakhir
          </p>
        )}
      </div>

      {/* Histori transaksi 14d */}
      <div data-testid="sku-detail-histori" className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2">
          <Clock width={16} height={16} className="text-[#0F7A4A]" /> Histori Transaksi 14 Hari
        </h3>
        {histori14.length === 0 ? (
          <p data-testid="histori-empty" className="text-sm text-[#595959] mt-3">
            Belum ada transaksi 14 hari terakhir
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {histori14.map((t) => {
              const day = (() => {
                try {
                  return formatJakarta(new Date(t.sold_at));
                } catch {
                  return t.sold_at.slice(0, 10);
                }
              })();
              const jenis = (t.jenis ?? "keluar") as string;
              const harga = t.harga_jual_snapshot != null && t.harga_jual_snapshot > 0 ? t.harga_jual_snapshot : sku.harga_normal;
              return (
                <li
                  key={t.id}
                  data-testid={`histori-item-${t.id}`}
                  className="flex justify-between items-center text-sm rounded-xl px-3 py-2.5 border border-base-300/40 bg-base-200/50"
                >
                  <span>
                    {day} • {jenis} • {t.qty_sold} pcs
                  </span>
                  <span className="font-semibold">Rp{harga.toLocaleString("id-ID")}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default SkuDetailPage;
