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
import { daysToExpiry, toJakartaStartOfDay } from "../../engine/expiry";
import { build14DaysJakarta, aggregateArus14, formatJakarta } from "../../engine/arus";
import { onBatchInserted } from "../../engine/notifScheduler";
import { AppButton, StatCard } from "../../components/ui";
import {
  ArrowLeft,
  Package,
  Hashtag,
  StatsReport,
  WarningCircle,
  Calendar,
  Box,
  Clock,
  Plus,
  ShoppingBag,
  CheckCircle,
} from "iconoir-react";

const ChartArus = lazy(() => import("../../components/ChartArus"));

function getMaxThreshold(kategori: Kategori | undefined): number {
  const arr = kategori?.threshold_h_minus ?? [7, 3, 1];
  if (arr.length === 0) return 7;
  return Math.max(...arr);
}

const JKT_OFFSET_MS = 7 * 60 * 60 * 1000;
function jakartaYMD(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function addDaysJakarta(startUtc: Date, days: number): string {
  return jakartaYMD(new Date(startUtc.getTime() + days * 86_400_000));
}
function jakartaMidnightFromYMD(ymd: string): Date {
  const s = ymd.slice(0, 10);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - JKT_OFFSET_MS);
}

function InoutMasukPane({ sku, onDone }: { sku: SKU; onDone: () => void }) {
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"tanggal" | "durasi">("tanggal");
  const [tanggal, setTanggal] = useState("");
  const [durasi, setDurasi] = useState("");
  const [pengirim, setPengirim] = useState("");
  const [hpp, setHpp] = useState(String(sku.hpp));
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || !(qtyNum > 0) || !Number.isInteger(qtyNum)) {
      setError("Jumlah harus lebih dari 0");
      return;
    }
    const hppNum = Number(hpp);
    if (!Number.isFinite(hppNum) || !(hppNum > 0)) {
      setError("Harga beli harus lebih dari 0");
      return;
    }
    const now = new Date();
    const receivedStart = toJakartaStartOfDay(now);
    let expiry_date: string | null = null;
    if (mode === "tanggal") {
      if (!tanggal) {
        setError("Tanggal kadaluarsa wajib diisi");
        return;
      }
      const expiryMidnight = jakartaMidnightFromYMD(tanggal);
      if (Number.isNaN(expiryMidnight.getTime()) || expiryMidnight.getTime() < receivedStart.getTime()) {
        setError("Tanggal tidak valid");
        return;
      }
      expiry_date = tanggal.slice(0, 10);
    } else {
      const durNum = Number(durasi);
      if (!Number.isFinite(durNum) || !(durNum > 0) || !Number.isInteger(durNum)) {
        setError("Durasi harus lebih dari 0");
        return;
      }
      expiry_date = addDaysJakarta(receivedStart, durNum);
      const expiryMidnight = jakartaMidnightFromYMD(expiry_date);
      if (expiryMidnight.getTime() < receivedStart.getTime()) {
        setError("Tanggal tidak valid");
        return;
      }
    }
    setSubmitting(true);
    try {
      const cur = await dexieV2.skus.get(sku.id);
      if (!cur) {
        setError("SKU tidak ditemukan");
        return;
      }
      const hppLama = cur.hpp;
      const nowIso = new Date().toISOString();
      let batchId = "";
      await dexieV2.transaction("rw", dexieV2.skus, dexieV2.hpp_history, dexieV2.batches, dexieV2.transaksis, async () => {
        await dexieV2.hpp_history.put({
          id: crypto.randomUUID(),
          sku_id: sku.id,
          hpp_lama: hppLama,
          hpp_baru: hppNum,
          created_at: nowIso,
          org_id: "toko-01",
        });
        await dexieV2.skus.put({ ...cur, hpp: hppNum });
        batchId = crypto.randomUUID();
        await dexieV2.batches.put({
          id: batchId,
          sku_id: sku.id,
          qty: qtyNum,
          expiry_date,
          received_at: nowIso,
          hpp_snapshot: hppNum,
          org_id: "toko-01",
        });
        await dexieV2.transaksis.put({
          id: crypto.randomUUID(),
          sku_id: sku.id,
          qty_sold: qtyNum,
          sold_at: nowIso,
          org_id: "toko-01",
          jenis: "masuk",
          harga_jual_snapshot: 0,
          pengirim: pengirim.trim() || null,
          penerima: null,
          catatan: catatan.trim() || null,
        });
      });
      setSuccess("Barang masuk berhasil dicatat");
      void onBatchInserted(batchId, "toko-01");
      window.dispatchEvent(new CustomEvent("inbound-created", { detail: { id: batchId, skuId: sku.id } }));
      setTimeout(() => onDone(), 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Tanggal tidak valid")) setError("Tanggal tidak valid");
      else setError(msg || "Gagal mencatat barang masuk");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="rounded-xl bg-[#F5F5F0] border border-base-300/40 px-3 py-2.5 flex items-center gap-2">
        <Package width={16} height={16} className="text-[#0F7A4A] shrink-0" />
        <span className="text-sm font-semibold text-neutral truncate" data-testid="inout-masuk-sku">
          {sku.nama} • {sku.kode ?? sku.id.slice(0, 6)}
        </span>
        <span className="ml-auto text-xs text-[#595959]">Rp{sku.hpp.toLocaleString("id-ID")}</span>
      </div>
      <div>
        <label htmlFor="inout-qty-masuk" className="block text-[16px] font-semibold text-neutral mb-2">
          Jumlah *
        </label>
        <input
          id="inout-qty-masuk"
          data-testid="input-qty"
          type="number"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Contoh: 10"
          className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
        />
      </div>
      <div>
        <p className="block text-[16px] font-semibold text-neutral mb-2">Mode kadaluarsa *</p>
        <div className="flex gap-3" role="radiogroup" aria-label="Mode kadaluarsa">
          <label className="flex items-center gap-2 cursor-pointer min-h-[48px] px-4 rounded-xl border border-base-300 bg-base-100 has-[input:checked]:border-[#0F7A4A] has-[input:checked]:bg-[#0F7A4A]/5">
            <input type="radio" name="inout-mode" value="tanggal" checked={mode === "tanggal"} onChange={() => setMode("tanggal")} data-testid="radio-tanggal" className="radio radio-sm" />
            <Calendar width={16} height={16} className="text-[#0F7A4A]" />
            <span className="text-[16px]">Tanggal</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer min-h-[48px] px-4 rounded-xl border border-base-300 bg-base-100 has-[input:checked]:border-[#0F7A4A] has-[input:checked]:bg-[#0F7A4A]/5">
            <input type="radio" name="inout-mode" value="durasi" checked={mode === "durasi"} onChange={() => setMode("durasi")} data-testid="radio-durasi" className="radio radio-sm" />
            <Clock width={16} height={16} className="text-[#0F7A4A]" />
            <span className="text-[16px]">Durasi</span>
          </label>
        </div>
      </div>
      {mode === "tanggal" ? (
        <div>
          <label htmlFor="inout-tanggal" className="block text-[16px] font-semibold text-neutral mb-2">
            Tanggal kadaluarsa *
          </label>
          <input
            id="inout-tanggal"
            data-testid="input-tanggal"
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="inout-durasi" className="block text-[16px] font-semibold text-neutral mb-2">
            Durasi (hari) *
          </label>
          <input
            id="inout-durasi"
            data-testid="input-durasi"
            type="number"
            inputMode="numeric"
            value={durasi}
            onChange={(e) => setDurasi(e.target.value)}
            placeholder="Contoh: 30"
            className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
          />
        </div>
      )}
      <div>
        <label htmlFor="inout-pengirim" className="block text-[16px] font-semibold text-neutral mb-2">
          Pengirim
        </label>
        <input
          id="inout-pengirim"
          data-testid="input-pengirim"
          type="text"
          value={pengirim}
          onChange={(e) => setPengirim(e.target.value)}
          placeholder="Supplier A"
          className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
        />
      </div>
      <div>
        <label htmlFor="inout-hpp" className="block text-[16px] font-semibold text-neutral mb-2">
          Harga beli (HPP) *
        </label>
        <input
          id="inout-hpp"
          data-testid="input-hpp"
          type="number"
          inputMode="numeric"
          value={hpp}
          onChange={(e) => setHpp(e.target.value)}
          placeholder="12000"
          className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
        />
      </div>
      <div>
        <label htmlFor="inout-catatan-masuk" className="block text-[16px] font-semibold text-neutral mb-2">
          Catatan
        </label>
        <textarea
          id="inout-catatan-masuk"
          data-testid="textarea-catatan"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Nota #123"
          rows={2}
          className="textarea textarea-bordered w-full min-h-[80px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3 py-3"
        />
      </div>
      {error && (
        <p data-testid="form-error" role="alert" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
          <WarningCircle width={16} height={16} className="shrink-0" /> {error}
        </p>
      )}
      {success && (
        <p data-testid="form-success" role="status" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#E8F5E9] text-[#0F7A4A] border border-[#C8E6C9]">
          <CheckCircle width={16} height={16} className="shrink-0" /> {success}
        </p>
      )}
      <AppButton type="submit" data-testid="btn-masuk-simpan" disabled={submitting} loading={submitting} fullWidth className="rounded-xl">
        {submitting ? "Menyimpan..." : "Simpan Barang Masuk"}
      </AppButton>
    </form>
  );
}

function InoutKeluarPane({ sku, batches, onDone }: { sku: SKU; batches: Batch[]; onDone: () => void }) {
  const [qty, setQty] = useState("");
  const [penerima, setPenerima] = useState("");
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stokTotal = batches.reduce((a, b) => a + b.qty, 0);
  const expiring = batches.filter((b) => b.expiry_date !== null && b.qty > 0).sort((a, b) => (a.expiry_date as string).localeCompare(b.expiry_date as string));
  const nonPerish = batches.filter((b) => b.expiry_date === null && b.qty > 0);
  const stokFEFO = expiring.length > 0 ? expiring.reduce((a, b) => a + b.qty, 0) : nonPerish.reduce((a, b) => a + b.qty, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || !(qtyNum > 0) || !Number.isInteger(qtyNum)) {
      setError("Qty harus lebih dari 0");
      return;
    }
    setSubmitting(true);
    try {
      const cur = await dexieV2.skus.get(sku.id);
      if (!cur) {
        setError("SKU tidak ditemukan");
        return;
      }
      await dexieV2.transaction("rw", dexieV2.skus, dexieV2.batches, dexieV2.transaksis, async () => {
        const all: Batch[] = await dexieV2.batches.where("[org_id+sku_id]").equals(["toko-01", sku.id]).toArray();
        const exp = all.filter((b) => b.expiry_date !== null && b.qty > 0).sort((a, b) => (a.expiry_date as string).localeCompare(b.expiry_date as string));
        const non = all.filter((b) => b.expiry_date === null && b.qty > 0);
        const target = exp.length > 0 ? exp : non;
        const total = target.reduce((a, b) => a + b.qty, 0);
        if (total < qtyNum) throw new Error("Stok tidak cukup");
        let remaining = qtyNum;
        for (const b of target) {
          if (remaining <= 0) break;
          const take = Math.min(b.qty, remaining);
          await dexieV2.batches.put({ ...b, qty: b.qty - take });
          remaining -= take;
        }
        await (dexieV2.transaksis as unknown as { put: (x: unknown) => Promise<unknown> }).put({
          id: crypto.randomUUID(),
          sku_id: sku.id,
          qty_sold: qtyNum,
          sold_at: new Date().toISOString(),
          org_id: "toko-01",
          jenis: "keluar",
          harga_jual_snapshot: cur.harga_normal,
          pengirim: null,
          penerima: penerima.trim() || null,
          catatan: catatan.trim() || null,
        });
      });
      setSuccess("Barang keluar berhasil dicatat");
      window.dispatchEvent(new CustomEvent("outbound-created", { detail: { id: sku.id } }));
      setTimeout(() => onDone(), 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Stok tidak cukup")) setError("Stok tidak cukup");
      else if (msg.includes("Qty harus lebih dari 0")) setError("Qty harus lebih dari 0");
      else setError(msg || "Gagal mencatat barang keluar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="rounded-xl bg-[#F5F5F0] border border-base-300/40 px-3 py-2.5">
        <p data-testid="outbound-stok-info" className="text-xs text-[#595959]">
          Stok total: {stokTotal} pcs • Stok siap FEFO: {stokFEFO} pcs {expiring.length > 0 ? `• ${expiring.length} batch expiring` : "(non-perishable)"}
        </p>
        {expiring.length > 0 && (
          <div data-testid="outbound-fefo-preview" className="mt-2">
            <p className="text-xs font-semibold text-neutral uppercase tracking-wide">FEFO terdekat</p>
            <ul className="mt-1 flex flex-col gap-1">
              {expiring.slice(0, 3).map((b) => (
                <li key={b.id} data-testid={`fefo-row-${b.id}`} className="text-xs text-[#595959] flex justify-between">
                  <span>exp {b.expiry_date} • {b.qty} pcs</span>
                  <span>Rp{b.hpp_snapshot.toLocaleString("id-ID")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="inout-qty-keluar" className="block text-[16px] font-semibold text-neutral mb-2">
          Jumlah *
        </label>
        <input
          id="inout-qty-keluar"
          data-testid="input-qty"
          type="number"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Contoh: 5"
          className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
        />
      </div>
      <div>
        <label htmlFor="inout-penerima" className="block text-[16px] font-semibold text-neutral mb-2">
          Penerima
        </label>
        <input
          id="inout-penerima"
          data-testid="input-penerima"
          type="text"
          value={penerima}
          onChange={(e) => setPenerima(e.target.value)}
          placeholder="Pelanggan / Cabang B"
          className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
        />
      </div>
      <div>
        <label htmlFor="inout-catatan-keluar" className="block text-[16px] font-semibold text-neutral mb-2">
          Catatan
        </label>
        <textarea
          id="inout-catatan-keluar"
          data-testid="textarea-catatan"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Retur rusak, penjualan ecer"
          rows={2}
          className="textarea textarea-bordered w-full min-h-[80px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3 py-3"
        />
      </div>
      {error && (
        <p data-testid="form-error" role="alert" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
          <WarningCircle width={16} height={16} className="shrink-0" /> {error}
        </p>
      )}
      {success && (
        <p data-testid="form-success" role="status" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#E8F5E9] text-[#0F7A4A] border border-[#C8E6C9]">
          <CheckCircle width={16} height={16} className="shrink-0" /> {success}
        </p>
      )}
      <AppButton type="submit" data-testid="btn-keluar-simpan" disabled={submitting} loading={submitting} fullWidth className="rounded-xl">
        {submitting ? "Menyimpan..." : "Simpan Barang Keluar"}
      </AppButton>
    </form>
  );
}

export function SkuDetailPage({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [sku, setSku] = useState<SKU | null>(null);
  const [kategori, setKategori] = useState<Kategori | undefined>(undefined);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transaksis, setTransaksis] = useState<Transaksi[]>([]);
  const [allRecent, setAllRecent] = useState<Transaksi[]>([]);
  const [activeTab, setActiveTab] = useState<"masuk" | "keluar">("masuk");

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

  const masukCount = transaksis.filter((t) => (t.jenis ?? "keluar") === "masuk").length;
  const keluarCount = transaksis.filter((t) => (t.jenis ?? "keluar") === "keluar").length;
  const hasAnyTransaksi = transaksis.length > 0;

  const reloadDetail = async () => {
    if (!sku) return;
    try {
      const [batchList, transList] = await Promise.all([
        realRepo.listBatchesBySku(sku.id, "toko-01"),
        realRepo.listTransaksisBySku(sku.id, "toko-01").catch(() => []),
      ]);
      setBatches(batchList);
      setTransaksis(transList);
      setAllRecent(transList);
    } catch {}
  };

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

      {/* In-Out sub-tabs — TASK-15 */}
      <div data-testid="inout-section" className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 overflow-hidden">
        <div className="flex border-b border-base-300/50" role="tablist" aria-label="Masuk Keluar">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "masuk"}
            data-testid="tab-masuk"
            onClick={() => setActiveTab("masuk")}
            className={[
              "flex-1 flex items-center justify-center gap-2 min-h-[48px] text-[16px] font-semibold transition-colors",
              activeTab === "masuk" ? "bg-[#0F7A4A] text-white" : "bg-base-100 text-[#595959] hover:bg-base-200",
            ].join(" ")}
          >
            <Plus width={18} height={18} /> Masuk {masukCount > 0 ? `• ${masukCount}` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "keluar"}
            data-testid="tab-keluar"
            onClick={() => setActiveTab("keluar")}
            className={[
              "flex-1 flex items-center justify-center gap-2 min-h-[48px] text-[16px] font-semibold transition-colors",
              activeTab === "keluar" ? "bg-[#0F7A4A] text-white" : "bg-base-100 text-[#595959] hover:bg-base-200",
            ].join(" ")}
          >
            <ShoppingBag width={18} height={18} /> Keluar {keluarCount > 0 ? `• ${keluarCount}` : ""}
          </button>
        </div>
        <div className="p-5">
          {!hasAnyTransaksi && (
            <p data-testid="inout-tab-empty" className="text-sm text-[#595959] text-center py-2">
              Tanpa transaksi
            </p>
          )}
          {activeTab === "masuk" ? (
            <div data-testid="inout-pane-masuk">
              {hasAnyTransaksi && masukCount === 0 && (
                <p data-testid="inout-tab-empty" className="text-sm text-[#595959] text-center py-2 mb-3">
                  Tanpa transaksi
                </p>
              )}
              <InoutMasukPane sku={sku} onDone={reloadDetail} />
            </div>
          ) : (
            <div data-testid="inout-pane-keluar">
              {hasAnyTransaksi && keluarCount === 0 && (
                <p data-testid="inout-tab-empty" className="text-sm text-[#595959] text-center py-2 mb-3">
                  Tanpa transaksi
                </p>
              )}
              <InoutKeluarPane sku={sku} batches={batches} onDone={reloadDetail} />
            </div>
          )}
        </div>
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
