import { useEffect, useMemo, useState } from "react";
import { StatsReport, Box, ArrowLeft, ArrowRight, Clock, Package, Shop, StatUp } from "iconoir-react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import { calcAvgDailyUsage } from "../../engine/avgUsage";
import { calcOmzet14 } from "../../engine/omzet";
import type { SKU, Kategori, Transaksi, Batch } from "../../db/types";
import { PageHeader, StatCard } from "../../components/ui";

function formatRp(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

function formatAvg(n: number): string {
  if (!Number.isFinite(n)) return "0 / hari";
  if (n === 0) return "0 / hari";
  return `${n.toFixed(1).replace(".", ",")} / hari`;
}

type RankRow = { skuId: string; skuName: string; kategoriName: string; qty: number };
type KecepatanRow = { id: string; nama: string; totalQty: number; avg: number; kind?: "sku" | "kategori" };

export function StatistikTab() {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [kategoris, setKategoris] = useState<Kategori[]>([]);
  const [transaksis, setTransaksis] = useState<Transaksi[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, k, t, b] = await Promise.all([
          realRepo.listSkus("toko-01").catch(() => [] as SKU[]),
          realRepo.listKategoris("toko-01").catch(() => [] as Kategori[]),
          realRepo.listTransaksis("toko-01").catch(() => [] as Transaksi[]),
          dexieV2.batches.where("org_id").equals("toko-01").toArray().catch(() => [] as Batch[]),
        ]);
        if (cancelled) return;
        setSkus(s);
        setKategoris(k);
        setTransaksis(t);
        setBatches(b);
      } catch {
        if (!cancelled) {
          setSkus([]);
          setKategoris([]);
          setTransaksis([]);
          setBatches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const skuMap = useMemo(() => new Map(skus.map((s) => [s.id, s])), [skus]);
  const kategoriMap = useMemo(() => new Map(kategoris.map((k) => [k.id, k])), [kategoris]);

  const enrichedTransaksis = useMemo(() => {
    if (skuMap.size === 0) return transaksis;
    return transaksis.map((t) => {
      const anyT = t as unknown as Record<string, unknown>;
      if ((t.jenis ?? "keluar") === "keluar" && typeof anyT.hpp_snapshot !== "number") {
        const sku = skuMap.get(t.sku_id);
        if (sku && typeof sku.hpp === "number") {
          return { ...t, hpp_snapshot: sku.hpp } as unknown as Transaksi;
        }
      }
      return t;
    });
  }, [transaksis, skuMap]);

  const omzetResult = useMemo(() => {
    return calcOmzet14(
      enrichedTransaksis as unknown as Parameters<typeof calcOmzet14>[0],
      batches as unknown as Parameters<typeof calcOmzet14>[1],
      new Date()
    );
  }, [enrichedTransaksis, batches]);

  const rankMasuk = useMemo<RankRow[]>(() => {
    const map = new Map<string, number>();
    for (const t of transaksis) {
      if ((t.jenis ?? "keluar") !== "masuk") continue;
      map.set(t.sku_id, (map.get(t.sku_id) ?? 0) + (t.qty_sold ?? 0));
    }
    const rows: RankRow[] = [];
    for (const [skuId, qty] of map) {
      const sku = skuMap.get(skuId);
      const kat = sku ? kategoriMap.get(sku.kategori_id) : undefined;
      rows.push({ skuId, skuName: sku?.nama ?? skuId, kategoriName: kat?.nama ?? "-", qty });
    }
    rows.sort((a, b) => b.qty - a.qty);
    return rows;
  }, [transaksis, skuMap, kategoriMap]);

  const rankKeluar = useMemo<RankRow[]>(() => {
    const map = new Map<string, number>();
    for (const t of transaksis) {
      if ((t.jenis ?? "keluar") !== "keluar") continue;
      map.set(t.sku_id, (map.get(t.sku_id) ?? 0) + (t.qty_sold ?? 0));
    }
    const rows: RankRow[] = [];
    for (const [skuId, qty] of map) {
      const sku = skuMap.get(skuId);
      const kat = sku ? kategoriMap.get(sku.kategori_id) : undefined;
      rows.push({ skuId, skuName: sku?.nama ?? skuId, kategoriName: kat?.nama ?? "-", qty });
    }
    rows.sort((a, b) => b.qty - a.qty);
    return rows;
  }, [transaksis, skuMap, kategoriMap]);

  const kecepatanSku = useMemo<KecepatanRow[]>(() => {
    const rows: KecepatanRow[] = [];
    for (const sku of skus) {
      const list = transaksis.filter((t) => t.sku_id === sku.id && (t.jenis ?? "keluar") === "keluar");
      const totalQty = list.reduce((s, t) => s + (t.qty_sold ?? 0), 0);
      const avg = calcAvgDailyUsage(list as unknown as Parameters<typeof calcAvgDailyUsage>[0], undefined, 14);
      rows.push({ id: sku.id, nama: sku.nama, totalQty, avg });
    }
    rows.sort((a, b) => b.avg - a.avg);
    return rows;
  }, [skus, transaksis]);

  const kecepatanKategori = useMemo<KecepatanRow[]>(() => {
    const rows: KecepatanRow[] = [];
    for (const kat of kategoris) {
      const skuIds = new Set(skus.filter((s) => s.kategori_id === kat.id).map((s) => s.id));
      const list = transaksis.filter((t) => skuIds.has(t.sku_id) && (t.jenis ?? "keluar") === "keluar");
      const totalQty = list.reduce((s, t) => s + (t.qty_sold ?? 0), 0);
      const avg = calcAvgDailyUsage(list as unknown as Parameters<typeof calcAvgDailyUsage>[0], undefined, 14);
      rows.push({ id: kat.id, nama: kat.nama, totalQty, avg });
    }
    rows.sort((a, b) => b.avg - a.avg);
    return rows;
  }, [kategoris, skus, transaksis]);

  const histori = useMemo(() => {
    const sorted = [...transaksis].sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());
    return sorted.slice(0, 20);
  }, [transaksis]);

  const hasTransaksi = transaksis.length > 0;

  if (loading) {
    return (
      <div data-testid="statistik-tab" className="w-full max-w-[640px] mx-auto space-y-4">
        <div data-testid="stats-header" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <StatsReport width={20} height={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral leading-tight">Statistik 14 Hari</h2>
            <p className="text-sm text-[#595959] mt-0.5">Rank, kecepatan, histori, dan omzet dari data real Dexie.</p>
          </div>
        </div>
        <div className="bg-white border border-[#D9D9D9] rounded-[12px] p-6 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>Memuat statistik...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="statistik-tab" className="w-full max-w-[640px] mx-auto space-y-6">
      <div data-testid="stats-header">
        <PageHeader
          title="Statistik 14 Hari"
          subtitle="Rank keluar-masuk, kecepatan per SKU & kategori, histori transaksi, omzet + margin — angka dari DB."
          icon={<StatsReport width={18} height={18} />}
          testId="statistik-header"
        />
      </div>

      {!hasTransaksi ? (
        <div
          data-testid="stats-empty"
          role="status"
          aria-live="polite"
          className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-8 text-center flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#FFF8E1] border border-[#FFE082]/60 flex items-center justify-center text-[#8D6E63] mb-4">
            <StatsReport width={28} height={28} strokeWidth={1.4} />
          </div>
          <h3 className="text-base font-bold text-neutral" style={{ fontSize: "16px" }}>Belum ada transaksi</h3>
          <p className="text-sm text-[#595959] mt-1.5 leading-relaxed max-w-sm" style={{ fontSize: "16px" }}>
            Belum ada statistik. Catat barang masuk atau keluar dulu untuk melihat rank dan omzet 14 hari.
          </p>
        </div>
      ) : null}

      {/* Omzet 14d — selalu render header, nilai 0 jika kosong */}
      <section data-testid="section-omzet" className="space-y-3">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2" style={{ fontSize: "16px" }}>
          <Box width={16} height={16} className="text-[#0F7A4A]" /> Omzet & Margin 14 Hari
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div data-testid="stats-omzet" className="card rounded-2xl shadow-sm border p-4 bg-[#E8F5E9] border-[#A5D6A7]/60">
            <p className="text-xs font-semibold tracking-wide opacity-70 uppercase">Omzet</p>
            <p data-testid="stats-omzet-value" className="text-xl font-extrabold leading-none mt-1 text-[#1B5E20]" style={{ fontSize: "18px" }}>
              {formatRp(omzetResult.omzet)}
            </p>
            <p className="text-xs opacity-70 mt-1">Σ harga × qty keluar 14 hari</p>
          </div>
          <div data-testid="stats-margin" className="card rounded-2xl shadow-sm border p-4 bg-base-100 border-base-300/50">
            <p className="text-xs font-semibold tracking-wide opacity-70 uppercase">Margin</p>
            <p data-testid="stats-margin-value" className="text-xl font-extrabold leading-none mt-1" style={{ fontSize: "18px" }}>
              {formatRp(omzetResult.margin)}
            </p>
            <p className="text-xs opacity-70 mt-1">Omzet − HPP terjual</p>
          </div>
          <div data-testid="stats-cashflow" className="card rounded-2xl shadow-sm border p-4 bg-base-100 border-base-300/50">
            <p className="text-xs font-semibold tracking-wide opacity-70 uppercase">Cashflow</p>
            <p data-testid="stats-cashflow-value" className="text-xl font-extrabold leading-none mt-1" style={{ fontSize: "18px" }}>
              {formatRp(omzetResult.cashflow)}
            </p>
            <p className="text-xs opacity-70 mt-1">Omzet − belanja 14 hari</p>
          </div>
          <div data-testid="stats-belanja" className="card rounded-2xl shadow-sm border p-4 bg-base-100 border-base-300/50">
            <p className="text-xs font-semibold tracking-wide opacity-70 uppercase">Belanja</p>
            <p data-testid="stats-belanja-value" className="text-xl font-extrabold leading-none mt-1" style={{ fontSize: "18px" }}>
              {formatRp(omzetResult.belanja)}
            </p>
            <p className="text-xs opacity-70 mt-1">Σ harga beli masuk 14 hari</p>
          </div>
        </div>
      </section>

      {/* Rank Masuk */}
      <section data-testid="section-rank-masuk" className="space-y-3">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2" style={{ fontSize: "16px" }}>
          <ArrowLeft width={16} height={16} className="text-[#0F7A4A]" /> Rank Masuk (qty)
        </h3>
        {rankMasuk.length === 0 ? (
          <div data-testid="rank-masuk-empty" className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <p className="text-sm text-[#595959]" style={{ fontSize: "16px" }}>Belum ada transaksi masuk</p>
          </div>
        ) : (
          <ul data-testid="rank-masuk-list" className="space-y-2" aria-label="Rank masuk">
            {rankMasuk.map((r, idx) => (
              <li
                key={r.skuId}
                data-testid={`rank-masuk-item-${r.skuId}`}
                className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 flex items-center justify-between gap-3"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-[#0F7A4A] text-white flex items-center justify-center text-sm font-bold shrink-0">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold text-[#1A1A1A] truncate" style={{ fontSize: "16px" }}>{r.skuName}</p>
                    <p className="text-xs text-[#595959] truncate">{r.kategoriName}</p>
                  </div>
                </div>
                <span className="text-[16px] font-bold text-[#0F7A4A] shrink-0" style={{ fontSize: "16px" }}>
                  {r.qty} pcs
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rank Keluar */}
      <section data-testid="section-rank-keluar" className="space-y-3">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2" style={{ fontSize: "16px" }}>
          <ArrowRight width={16} height={16} className="text-[#C62828]" /> Rank Keluar (qty)
        </h3>
        {rankKeluar.length === 0 ? (
          <div data-testid="rank-keluar-empty" className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <p className="text-sm text-[#595959]" style={{ fontSize: "16px" }}>Belum ada transaksi keluar</p>
          </div>
        ) : (
          <ul data-testid="rank-keluar-list" className="space-y-2" aria-label="Rank keluar">
            {rankKeluar.map((r, idx) => (
              <li
                key={r.skuId}
                data-testid={`rank-keluar-item-${r.skuId}`}
                className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 flex items-center justify-between gap-3"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-[#C62828] text-white flex items-center justify-center text-sm font-bold shrink-0">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold text-[#1A1A1A] truncate" style={{ fontSize: "16px" }}>{r.skuName}</p>
                    <p className="text-xs text-[#595959] truncate">{r.kategoriName}</p>
                  </div>
                </div>
                <span className="text-[16px] font-bold text-[#C62828] shrink-0" style={{ fontSize: "16px" }}>
                  {r.qty} pcs
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Kecepatan per SKU */}
      <section data-testid="section-kecepatan-sku" className="space-y-3">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2" style={{ fontSize: "16px" }}>
          <StatUp width={16} height={16} className="text-[#0F7A4A]" /> Kecepatan per SKU (avgUsage)
        </h3>
        {kecepatanSku.length === 0 ? (
          <div data-testid="kecepatan-sku-empty" className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center">
            <p className="text-sm text-[#595959]" style={{ fontSize: "16px" }}>Belum ada SKU</p>
          </div>
        ) : (
          <ul data-testid="kecepatan-sku-list" className="space-y-2" aria-label="Kecepatan per SKU">
            {kecepatanSku.map((r) => (
              <li
                key={r.id}
                data-testid={`kecepatan-sku-item-${r.id}`}
                className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 flex items-center justify-between gap-3"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold text-[#1A1A1A] truncate" style={{ fontSize: "16px" }}>{r.nama}</p>
                  <p className="text-xs text-[#595959]">Total keluar {r.totalQty} pcs</p>
                </div>
                <span data-testid={`kecepatan-sku-avg-${r.id}`} className="text-[16px] font-bold text-[#0F7A4A] shrink-0" style={{ fontSize: "16px" }}>
                  {formatAvg(r.avg)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Kecepatan per Kategori */}
      <section data-testid="section-kecepatan-kategori" className="space-y-3">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2" style={{ fontSize: "16px" }}>
          <Package width={16} height={16} className="text-[#0F7A4A]" /> Kecepatan per Kategori
        </h3>
        {kecepatanKategori.length === 0 ? (
          <div data-testid="kecepatan-kategori-empty" className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center">
            <p className="text-sm text-[#595959]" style={{ fontSize: "16px" }}>Belum ada kategori</p>
          </div>
        ) : (
          <ul data-testid="kecepatan-kategori-list" className="space-y-2" aria-label="Kecepatan per kategori">
            {kecepatanKategori.map((r) => (
              <li
                key={r.id}
                data-testid={`kecepatan-kategori-item-${r.id}`}
                className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 flex items-center justify-between gap-3"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold text-[#1A1A1A] truncate" style={{ fontSize: "16px" }}>{r.nama}</p>
                  <p className="text-xs text-[#595959]">Total keluar {r.totalQty} pcs</p>
                </div>
                <span data-testid={`kecepatan-kategori-avg-${r.id}`} className="text-[16px] font-bold text-[#0F7A4A] shrink-0" style={{ fontSize: "16px" }}>
                  {formatAvg(r.avg)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Histori keluar-masuk */}
      <section data-testid="section-histori-transaksi" className="space-y-3">
        <h3 className="text-[16px] font-bold text-neutral flex items-center gap-2" style={{ fontSize: "16px" }}>
          <Clock width={16} height={16} className="text-[#595959]" /> Histori Keluar-Masuk (20 terbaru)
        </h3>
        {histori.length === 0 ? (
          <div data-testid="histori-transaksi-empty" className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <p className="text-sm text-[#595959]" style={{ fontSize: "16px" }}>Belum ada histori transaksi</p>
          </div>
        ) : (
          <ul data-testid="histori-transaksi-list" className="space-y-2" aria-label="Histori keluar masuk">
            {histori.map((t) => {
              const sku = skuMap.get(t.sku_id);
              const jenis = (t.jenis ?? "keluar") as string;
              const isMasuk = jenis === "masuk";
              return (
                <li
                  key={t.id}
                  data-testid={`histori-transaksi-item-${t.id}`}
                  className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 flex items-center justify-between gap-3"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid={`histori-jenis-${t.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border"
                        style={{
                          backgroundColor: isMasuk ? "#E8F5E9" : "#FFEBEE",
                          color: isMasuk ? "#0F7A4A" : "#C62828",
                          borderColor: isMasuk ? "#A5D6A7" : "#FFCDD2",
                        }}
                      >
                        {isMasuk ? <ArrowLeft width={12} height={12} /> : <ArrowRight width={12} height={12} />} {isMasuk ? "Masuk" : "Keluar"}
                      </span>
                      <span className="text-[16px] font-semibold text-[#1A1A1A] truncate" style={{ fontSize: "16px" }}>
                        {sku?.nama ?? t.sku_id}
                      </span>
                    </div>
                    <p className="text-xs text-[#595959] mt-1">
                      {new Date(t.sold_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })} • {t.qty_sold} pcs
                      {typeof t.harga_jual_snapshot === "number" && t.harga_jual_snapshot > 0 ? ` • ${formatRp(t.harga_jual_snapshot)}` : ""}
                    </p>
                  </div>
                  <Shop width={16} height={16} className="text-[#595959] shrink-0" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Hidden debug for e2e numeric exact */}
      <div className="sr-only" aria-hidden data-testid="stats-debug">
        omzet:{omzetResult.omzet} margin:{omzetResult.margin} cashflow:{omzetResult.cashflow} belanja:{omzetResult.belanja}
      </div>
    </div>
  );
}

export default StatistikTab;
