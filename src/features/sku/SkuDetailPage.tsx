/**
 * TASK-11 [FRD-02/03] — Detail SKU 1-halaman + grafik mini arus 14d
 *
 * 1 halaman /sku/:id guarded login — data real Dexie (bukan FakeRepository):
 * - header: nama, kode, barcode, kategori, tag
 * - ringkasan: stok total (sum batch qty) + HPP + harga_normal + margin per pcs
 * - batch list: qty • exp H- • hpp_snapshot, null → "Tanpa kadaluarsa", kritis merah ikut threshold max
 * - histori 14d: tanggal • jenis • qty • harga (dari transaksis)
 * - grafik mini SVG inline 14 titik (masuk hijau / keluar merah batang ganda, sumbu tanggal),
 *   marker BEP lingkaran hijau #16a34a pada titik pertama kumulatif margin >=0
 *   margin harian = Σ(harga_jual_snapshot − hpp_snapshot)×qty keluar per hari,
 *   fallback bila snapshot tidak ada pakai sku.hpp (catat di evidence — transaksi tidak punya batch_id link)
 *   BEP = Σ margin harian kumulatif >=0, label "BEP tercapai H+{n}" atau "Belum BEP"
 *   tanpa transaksi → grafik empty "Belum ada transaksi 14 hari terakhir"
 *
 * Tanpa dep chart baru — SVG rect/circle/line murni.
 * Angka semua dari DB + engine daysToExpiry (Asia/Jakarta), bukan LLM.
 */

import { useEffect, useState } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { SKU, Kategori, Batch, Tag, Transaksi } from "../../db/types";
import { daysToExpiry } from "../../engine/expiry";

// Jakarta offset fixed UTC+7 tanpa DST
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function formatJakarta(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTodayJakartaParts(): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  return {
    y: Number(parts.find((p) => p.type === "year")!.value),
    m: Number(parts.find((p) => p.type === "month")!.value),
    d: Number(parts.find((p) => p.type === "day")!.value),
  };
}

function build14DaysJakarta(): string[] {
  const { y, m, d } = getTodayJakartaParts();
  const baseUTC = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - JAKARTA_OFFSET_MS;
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const delta = i - 13; // earliest = today-13, latest = today
    const utc = baseUTC + delta * 86_400_000;
    const dt = new Date(utc);
    days.push(formatJakarta(dt));
  }
  return days;
}

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
        // resolve tag names
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
        // for grafik we need all transaksis sorted; also filter 14d later
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

  // Histori 14d: filter transaksis where Jakarta date within last 14 days
  const fourteenDays = build14DaysJakarta();
  const fourteenSet = new Set(fourteenDays);
  // Group for grafik + histori list
  // For histori display: sort sold_at desc, take last 14d
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

  // Grafik data: per day masuk/keluar qty + margin harian
  const masukPerDay: number[] = Array(14).fill(0);
  const keluarPerDay: number[] = Array(14).fill(0);
  const marginPerDay: number[] = Array(14).fill(0);
  const dayIndexMap = new Map(fourteenDays.map((d, i) => [d, i]));

  for (const t of allRecent) {
    let day: string;
    try {
      day = formatJakarta(new Date(t.sold_at));
    } catch {
      continue;
    }
    const idx = dayIndexMap.get(day);
    if (idx === undefined) continue;
    const j = (t.jenis ?? "keluar") as string;
    const qty = typeof t.qty_sold === "number" ? t.qty_sold : 0;
    if (j === "masuk") {
      masukPerDay[idx] += qty;
    } else if (j === "keluar") {
      keluarPerDay[idx] += qty;
      // margin harian = (harga_jual_snapshot − hpp_snapshot) × qty
      // transaksi tidak punya batch_id link → fallback pakai sku.hpp (catat evidence)
      // harga_jual_snapshot fallback ke sku.harga_normal bila null/0
      const hargaJual = t.harga_jual_snapshot != null && t.harga_jual_snapshot > 0 ? t.harga_jual_snapshot : sku.harga_normal;
      const hppSnap = sku.hpp; // fallback: transaksi tidak menyimpan hpp_snapshot, pakai sku.hpp
      const margin = (hargaJual - hppSnap) * qty;
      marginPerDay[idx] += margin;
    } else {
      // opname or other → ignore for masuk/keluar but count? treat as keluar for margin? skip
    }
  }

  const hasAnyTransaksiIn14 = histori14.length > 0;
  const kumulatif: number[] = [];
  let cum = 0;
  for (let i = 0; i < 14; i++) {
    cum += marginPerDay[i];
    kumulatif.push(cum);
  }
  let bepIndex: number | null = null;
  for (let i = 0; i < 14; i++) {
    if (kumulatif[i] >= 0) {
      bepIndex = i;
      break;
    }
  }
  // If margin never positive but there is at least some transaksi? Still null → Belum BEP
  // Also if no transaksi at all, bep stays null

  const maxQty = Math.max(...masukPerDay, ...keluarPerDay, 1);

  // SVG layout
  const svgW = 360;
  const svgH = 140;
  const padLeft = 24;
  const padRight = 12;
  const padTop = 24;
  const padBottom = 28;
  const chartW = svgW - padLeft - padRight;
  const chartH = svgH - padTop - padBottom;

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
              const days = b.expiry_date !== null ? daysToExpiry(b.expiry_date) : null;
              const isKritis = b.expiry_date !== null && days !== null && days <= maxThreshold;
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
                    {b.qty} pcs • exp {b.expiry_date ?? "Tanpa kadaluarsa"} {days !== null ? `(H-${days})` : ""} • Rp{b.hpp_snapshot.toLocaleString("id-ID")}
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

      {/* Grafik mini */}
      <div data-testid="sku-detail-grafik-section" style={{ background: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Grafik Arus 14 Hari</h3>
        {hasAnyTransaksiIn14 ? (
          <>
            <div data-testid="sku-detail-grafik" style={{ marginTop: 12, overflowX: "auto" }}>
              <svg
                data-testid="grafik-svg"
                width={svgW}
                height={svgH}
                viewBox={`0 0 ${svgW} ${svgH}`}
                role="img"
                aria-label="Grafik arus 14 hari"
                style={{ display: "block", maxWidth: "100%" }}
              >
                {/* grid line */}
                <line x1={padLeft} y1={padTop + chartH} x2={padLeft + chartW} y2={padTop + chartH} stroke="#D9D9D9" strokeWidth={1} />
                {/* bars per day */}
                {fourteenDays.map((day, i) => {
                  const slotW = chartW / 14;
                  const xCenter = padLeft + i * slotW + slotW / 2;
                  const barW = 6;
                  const masukH = (masukPerDay[i] / maxQty) * chartH;
                  const keluarH = (keluarPerDay[i] / maxQty) * chartH;
                  const label = day.slice(5); // MM-DD
                  const isBep = bepIndex === i;
                  return (
                    <g key={day} data-testid={`grafik-point-${i}`}>
                      {/* masuk hijau */}
                      <rect
                        data-testid={`grafik-masuk-${i}`}
                        x={xCenter - barW - 2}
                        y={padTop + chartH - masukH}
                        width={barW}
                        height={masukH}
                        fill="#16a34a"
                        rx={2}
                      />
                      {/* keluar merah */}
                      <rect
                        data-testid={`grafik-keluar-${i}`}
                        x={xCenter + 2}
                        y={padTop + chartH - keluarH}
                        width={barW}
                        height={keluarH}
                        fill="#dc2626"
                        rx={2}
                      />
                      {/* x label */}
                      <text x={xCenter} y={padTop + chartH + 14} textAnchor="middle" fontSize={8} fill="#595959">
                        {label}
                      </text>
                      {/* BEP marker */}
                      {isBep && (
                        <circle
                          data-testid="bep-marker"
                          cx={xCenter}
                          cy={padTop - 6}
                          r={6}
                          fill="#16a34a"
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        />
                      )}
                      {/* hidden akses: titik qty for screen reader */}
                      <title>{`${day}: masuk ${masukPerDay[i]} keluar ${keluarPerDay[i]} margin ${marginPerDay[i]}`}</title>
                    </g>
                  );
                })}
                {/* BEP line highlight */}
                {bepIndex !== null && (
                  <line
                    data-testid="bep-line"
                    x1={padLeft + bepIndex * (chartW / 14) + chartW / 28}
                    y1={padTop}
                    x2={padLeft + bepIndex * (chartW / 14) + chartW / 28}
                    y2={padTop + chartH}
                    stroke="#16a34a"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.6}
                  />
                )}
              </svg>
            </div>
            {bepIndex !== null ? (
              <p data-testid="bep-label" style={{ fontSize: 14, color: "#16a34a", fontWeight: 600, marginTop: 8 }}>
                BEP tercapai H+{bepIndex + 1}
              </p>
            ) : (
              <p data-testid="bep-label" style={{ fontSize: 14, color: "#595959", marginTop: 8 }}>
                Belum BEP
              </p>
            )}
            {/* legenda */}
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12, color: "#595959" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 12, background: "#16a34a", display: "inline-block", borderRadius: 2 }} /> Masuk
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 12, background: "#dc2626", display: "inline-block", borderRadius: 2 }} /> Keluar
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 12, background: "#16a34a", display: "inline-block", borderRadius: 9999, border: "2px solid #FFFFFF", boxShadow: "0 0 0 1px #16a34a" }} /> BEP
              </span>
            </div>
          </>
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
