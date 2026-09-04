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
      <div data-testid="sku-detail-page" style={{ padding: 16 }}>
        <p data-testid="sku-detail-loading" style={{ fontSize: 16, color: "#595959" }} role="status">
          Memuat detail SKU...
        </p>
      </div>
    );
  }

  if (!sku) {
    return (
      <div data-testid="sku-detail-page" style={{ padding: 16 }}>
        <p data-testid="sku-detail-notfound" style={{ fontSize: 16, color: "#C62828" }}>
          SKU tidak ditemukan
        </p>
        <button
          type="button"
          data-testid="sku-detail-back"
          onClick={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          style={{ minHeight: 48, fontSize: 16, marginTop: 12, padding: "8px 16px", border: "1px solid #D9D9D9", borderRadius: 12, background: "#FFFFFF" }}
        >
          Kembali
        </button>
      </div>
    );
  }

  const stokTotal = batches.reduce((a, b) => a + b.qty, 0);
  const marginPerPcs = sku.harga_normal - sku.hpp;
  const maxThreshold = getMaxThreshold(kategori);

  // 14d helper
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

  // agregasi via helper (tanpa duplikasi rumus)
  const { masukPerDay, keluarPerDay, marginPerDay, days } = aggregateArus14(allRecent, sku, fourteenDays);

  const hasAnyTransaksiIn14 = histori14.length > 0;

  const handleBack = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div data-testid="sku-detail-page" style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "Inter, system-ui, sans-serif" }} className="space-y-4">
      <button
        type="button"
        data-testid="sku-detail-back"
        onClick={handleBack}
        style={{ minHeight: 48, fontSize: 16, padding: "8px 16px", border: "1px solid #D9D9D9", borderRadius: 12, background: "#FFFFFF", cursor: "pointer" }}
      >
        ← Kembali
      </button>

      {/* Header */}
      <div data-testid="sku-detail-header" style={{ background: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h2 data-testid="sku-detail-nama" style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
          {sku.nama}
        </h2>
        <p data-testid="sku-detail-kode" style={{ fontSize: 14, color: "#595959", margin: "4px 0 0" }}>
          Kode: {sku.kode ?? "-"} {sku.barcode ? `• Barcode: ${sku.barcode}` : ""}
        </p>
        <p data-testid="sku-detail-kategori" style={{ fontSize: 14, color: "#595959", margin: "4px 0 0" }}>
          Kategori: {kategori?.nama ?? "-"} • Threshold: [{kategori?.threshold_h_minus.join(",") ?? "7,3,1"}]
        </p>
        {tags.length > 0 && (
          <p data-testid="sku-detail-tags" style={{ fontSize: 12, color: "#595959", margin: "4px 0 0" }}>
            {tags.map((t) => `#${t.nama}`).join(" ")}
          </p>
        )}
      </div>

      {/* Ringkasan stok */}
      <div data-testid="sku-detail-ringkas" style={{ background: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Ringkasan Stok</h3>
        <p data-testid="sku-detail-stok-total" style={{ fontSize: 16, color: "#1A1A1A", margin: "8px 0 0" }}>
          Stok total: {stokTotal} pcs
        </p>
        <p data-testid="sku-detail-hpp" style={{ fontSize: 14, color: "#595959", margin: "4px 0 0" }}>
          HPP: Rp{sku.hpp.toLocaleString("id-ID")} • Harga: Rp{sku.harga_normal.toLocaleString("id-ID")} • Margin: Rp{marginPerPcs.toLocaleString("id-ID")}/pcs
        </p>
      </div>

      {/* Batch list */}
      <div data-testid="sku-detail-batches" style={{ background: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Daftar Batch</h3>
        {batches.length === 0 ? (
          <p data-testid="sku-detail-batch-empty" style={{ fontSize: 14, color: "#595959", marginTop: 8 }}>
            Belum ada batch
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 8 }} aria-label="Daftar batch">
            {batches.map((b) => {
              const daysExp = b.expiry_date !== null ? daysToExpiry(b.expiry_date) : null;
              const isKritis = b.expiry_date !== null && daysExp !== null && daysExp <= maxThreshold;
              return (
                <li
                  key={b.id}
                  data-testid={`batch-row-${b.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid #F0F0F0",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 14,
                    backgroundColor: isKritis ? "#FFEBEE" : "#FFFFFF",
                  }}
                >
                  <span data-testid={`batch-info-${b.id}`} style={{ fontSize: 14 }}>
                    {b.qty} pcs • exp {b.expiry_date ?? "Tanpa kadaluarsa"} {daysExp !== null ? `(H-${daysExp})` : ""} • Rp{b.hpp_snapshot.toLocaleString("id-ID")}
                  </span>
                  {isKritis && (
                    <span
                      data-testid={`batch-kritis-${b.id}`}
                      style={{ backgroundColor: "#C62828", color: "#FFFFFF", fontSize: 10, fontWeight: 600, borderRadius: 9999, padding: "2px 8px" }}
                    >
                      Kritis
                    </span>
                  )}
                  {b.expiry_date === null && (
                    <span data-testid={`batch-tanpa-${b.id}`} style={{ fontSize: 12, color: "#595959" }}>
                      Tanpa kadaluarsa
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Grafik — ChartArus lazy */}
      <div data-testid="sku-detail-grafik-section" style={{ background: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Grafik Arus 14 Hari</h3>
        {hasAnyTransaksiIn14 ? (
          <div data-testid="sku-detail-grafik">
            <Suspense fallback={<p data-testid="chart-loading" style={{ fontSize: 14, color: "#595959" }}>Memuat grafik...</p>}>
              <ChartArus masukPerDay={masukPerDay} keluarPerDay={keluarPerDay} marginPerDay={marginPerDay} days={days} />
            </Suspense>
          </div>
        ) : (
          <p data-testid="grafik-empty" style={{ fontSize: 14, color: "#595959", marginTop: 12 }}>
            Belum ada transaksi 14 hari terakhir
          </p>
        )}
      </div>

      {/* Histori transaksi 14d */}
      <div data-testid="sku-detail-histori" style={{ background: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Histori Transaksi 14 Hari</h3>
        {histori14.length === 0 ? (
          <p data-testid="histori-empty" style={{ fontSize: 14, color: "#595959", marginTop: 8 }}>
            Belum ada transaksi 14 hari terakhir
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
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
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 14, border: "1px solid #F0F0F0", borderRadius: 8, padding: "8px 12px" }}
                >
                  <span>
                    {day} • {jenis} • {t.qty_sold} pcs
                  </span>
                  <span>Rp{harga.toLocaleString("id-ID")}</span>
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
