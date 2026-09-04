import { useEffect, useState } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { SKU } from "../../db/types";
import { PageHeader, AppButton } from "../../components/ui";
import { toJakartaStartOfDay } from "../../engine/expiry";
import { Package, Plus, WarningCircle, CheckCircle, Calendar, Clock } from "iconoir-react";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function formatJakartaYMD(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA gives YYYY-MM-DD
  return fmt.format(d);
}

function addDaysJakarta(startMidnightUtc: Date, days: number): string {
  // startMidnightUtc is Jakarta 00:00 in UTC representation (from toJakartaStartOfDay)
  const expiryUtc = new Date(startMidnightUtc.getTime() + days * 86400000);
  return formatJakartaYMD(expiryUtc);
}

function jakartaMidnightFromYMD(ymd: string): Date {
  const s = ymd.slice(0, 10);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - JAKARTA_OFFSET_MS);
}

export function InboundForm() {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [skuId, setSkuId] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [mode, setMode] = useState<"tanggal" | "durasi">("tanggal");
  const [tanggal, setTanggal] = useState<string>("");
  const [durasi, setDurasi] = useState<string>("");
  const [pengirim, setPengirim] = useState<string>("");
  const [hpp, setHpp] = useState<string>("");
  const [catatan, setCatatan] = useState<string>("");

  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await realRepo.listSkus("toko-01");
      setSkus(list);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!skuId) {
      setError("Pilih SKU terlebih dahulu");
      return;
    }
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
      // tanggal is YYYY-MM-DD
      const expiryMidnight = jakartaMidnightFromYMD(tanggal);
      if (Number.isNaN(expiryMidnight.getTime())) {
        setError("Tanggal tidak valid");
        return;
      }
      if (expiryMidnight.getTime() < receivedStart.getTime()) {
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
      // sanity validate
      const expiryMidnight = jakartaMidnightFromYMD(expiry_date);
      if (expiryMidnight.getTime() < receivedStart.getTime()) {
        setError("Tanggal tidak valid");
        return;
      }
    }

    setSubmitting(true);
    try {
      const selected = skus.find((s) => s.id === skuId);
      if (!selected) {
        setError("SKU tidak ditemukan");
        return;
      }

      // HPP timpa: update SKU.hpp + arsip hpp_history atomic via dexieV2 transaction
      const sku = await dexieV2.skus.get(skuId);
      if (!sku) {
        setError("SKU tidak ditemukan");
        return;
      }
      const hppLama = sku.hpp;
      const hppBaru = hppNum;
      const nowIso = new Date().toISOString();

      await dexieV2.transaction("rw", dexieV2.skus, dexieV2.hpp_history, dexieV2.batches, dexieV2.transaksis, async () => {
        // arsip hpp_history
        await dexieV2.hpp_history.put({
          id: crypto.randomUUID(),
          sku_id: skuId,
          hpp_lama: hppLama,
          hpp_baru: hppBaru,
          created_at: nowIso,
          org_id: "toko-01",
        });
        // timpa sku.hpp
        await dexieV2.skus.put({ ...sku, hpp: hppBaru });

        // create batch
        const batchId = crypto.randomUUID();
        await dexieV2.batches.put({
          id: batchId,
          sku_id: skuId,
          qty: qtyNum,
          expiry_date,
          received_at: nowIso,
          hpp_snapshot: hppBaru,
          org_id: "toko-01",
        });

        // create transaksi jenis masuk
        await dexieV2.transaksis.put({
          id: crypto.randomUUID(),
          sku_id: skuId,
          qty_sold: qtyNum,
          sold_at: nowIso,
          org_id: "toko-01",
          jenis: "masuk",
          harga_jual_snapshot: 0,
          pengirim: pengirim.trim() || null,
          penerima: null,
          catatan: catatan.trim() || null,
        });

        // stash for event after transaction
        (globalThis as unknown as Record<string, string>).__inbound_batch_id = batchId;
      });

      const batchId = (globalThis as unknown as Record<string, string>).__inbound_batch_id;
      // clear temp
      delete (globalThis as unknown as Record<string, unknown>).__inbound_batch_id;

      setSuccess("Barang masuk berhasil dicatat");

      // emit event and redirect after short delay to allow toast visible
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("inbound-created", { detail: { id: batchId ?? skuId, kode: selected.kode ?? skuId } }));
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Tanggal tidak valid")) setError("Tanggal tidak valid");
      else if (msg.includes("Harga beli harus lebih dari 0")) setError("Harga beli harus lebih dari 0");
      else if (msg.includes("Jumlah harus lebih dari 0")) setError("Jumlah harus lebih dari 0");
      else setError(msg || "Gagal mencatat barang masuk");
    } finally {
      setSubmitting(false);
    }
  };

  const isEmptySku = skus.length === 0;

  return (
    <div data-testid="inbound-page" className="w-full max-w-[640px] mx-auto space-y-5">
      <PageHeader
        title="Barang Masuk"
        subtitle="Catat stok masuk — pilih SKU, isi jumlah, tanggal atau durasi, pengirim dan harga."
        icon={<Plus width={18} height={18} />}
      />

      {isEmptySku ? (
        <div
          data-testid="inbound-empty"
          className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-8 text-center flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#FFF8E1] border border-[#FFE082]/60 flex items-center justify-center text-[#8D6E63] mb-4">
            <Package width={28} height={28} strokeWidth={1.6} />
          </div>
          <h3 className="text-base font-bold text-neutral">Belum ada SKU</h3>
          <p className="text-sm text-[#595959] mt-1.5 leading-relaxed max-w-sm">Tambah SKU dulu sebelum mencatat barang masuk.</p>
          <AppButton
            onClick={() => {
              window.history.pushState({}, "", "/sku/baru");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            data-testid="inbound-empty-cta"
            className="mt-5 rounded-xl"
          >
            Tambah SKU
          </AppButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5 sm:p-6 space-y-5" noValidate>
          <div>
            <label htmlFor="inbound-sku" className="block text-[16px] font-semibold text-neutral mb-2 flex items-center gap-2">
              <Package width={16} height={16} className="text-[#0F7A4A]" /> SKU *
            </label>
            <select
              id="inbound-sku"
              data-testid="select-inbound-sku"
              value={skuId}
              onChange={(e) => setSkuId(e.target.value)}
              className="select select-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
            >
              <option value="">Pilih SKU</option>
              {skus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama} — {s.kode ?? s.id.slice(0, 6)} (Rp{s.hpp.toLocaleString("id-ID")})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inbound-qty" className="block text-[16px] font-semibold text-neutral mb-2">
              Jumlah *
            </label>
            <input
              id="inbound-qty"
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
                <input
                  type="radio"
                  name="mode"
                  value="tanggal"
                  checked={mode === "tanggal"}
                  onChange={() => setMode("tanggal")}
                  data-testid="radio-tanggal"
                  className="radio radio-sm"
                />
                <Calendar width={16} height={16} className="text-[#0F7A4A]" />
                <span className="text-[16px]">Tanggal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer min-h-[48px] px-4 rounded-xl border border-base-300 bg-base-100 has-[input:checked]:border-[#0F7A4A] has-[input:checked]:bg-[#0F7A4A]/5">
                <input
                  type="radio"
                  name="mode"
                  value="durasi"
                  checked={mode === "durasi"}
                  onChange={() => setMode("durasi")}
                  data-testid="radio-durasi"
                  className="radio radio-sm"
                />
                <Clock width={16} height={16} className="text-[#0F7A4A]" />
                <span className="text-[16px]">Durasi</span>
              </label>
            </div>
          </div>

          {mode === "tanggal" ? (
            <div>
              <label htmlFor="inbound-tanggal" className="block text-[16px] font-semibold text-neutral mb-2 flex items-center gap-2">
                <Calendar width={16} height={16} className="text-[#0F7A4A]" /> Tanggal kadaluarsa *
              </label>
              <input
                id="inbound-tanggal"
                data-testid="input-tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="inbound-durasi" className="block text-[16px] font-semibold text-neutral mb-2 flex items-center gap-2">
                <Clock width={16} height={16} className="text-[#0F7A4A]" /> Durasi (hari) *
              </label>
              <input
                id="inbound-durasi"
                data-testid="input-durasi"
                type="number"
                inputMode="numeric"
                value={durasi}
                onChange={(e) => setDurasi(e.target.value)}
                placeholder="Contoh: 30"
                className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
              />
              <p className="text-xs text-[#595959] mt-1.5">Akan jadi expiry = hari masuk + durasi (startOfDay Asia/Jakarta).</p>
            </div>
          )}

          <div>
            <label htmlFor="inbound-pengirim" className="block text-[16px] font-semibold text-neutral mb-2">
              Pengirim
            </label>
            <input
              id="inbound-pengirim"
              data-testid="input-pengirim"
              type="text"
              value={pengirim}
              onChange={(e) => setPengirim(e.target.value)}
              placeholder="Contoh: Supplier A"
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
            />
          </div>

          <div>
            <label htmlFor="inbound-hpp" className="block text-[16px] font-semibold text-neutral mb-2">
              Harga beli (HPP) *
            </label>
            <input
              id="inbound-hpp"
              data-testid="input-hpp"
              type="number"
              inputMode="numeric"
              value={hpp}
              onChange={(e) => setHpp(e.target.value)}
              placeholder="Contoh: 12000"
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
            />
            <p className="text-xs text-[#595959] mt-1.5">Akan timpa HPP SKU dan arsip ke riwayat (hpp_snapshot = harga beli).</p>
          </div>

          <div>
            <label htmlFor="inbound-catatan" className="block text-[16px] font-semibold text-neutral mb-2">
              Catatan
            </label>
            <textarea
              id="inbound-catatan"
              data-testid="textarea-catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Nota #123, kondisi baik"
              rows={3}
              className="textarea textarea-bordered w-full min-h-[80px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3 py-3"
            />
          </div>

          {error && (
            <p data-testid="form-error" role="alert" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
              <WarningCircle width={16} height={16} className="shrink-0" />
              {error}
            </p>
          )}

          {success && (
            <p data-testid="form-success" role="status" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#E8F5E9] text-[#0F7A4A] border border-[#C8E6C9]">
              <CheckCircle width={16} height={16} className="shrink-0" />
              {success}
            </p>
          )}

          <AppButton type="submit" data-testid="btn-masuk-simpan" disabled={submitting} loading={submitting} fullWidth className="rounded-xl mt-2">
            {submitting ? "Menyimpan..." : "Simpan Barang Masuk"}
          </AppButton>

          <AppButton
            type="button"
            variant="outline"
            onClick={() => {
              window.history.pushState({}, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            data-testid="inbound-back"
            fullWidth
            className="rounded-xl"
          >
            Kembali
          </AppButton>
        </form>
      )}
    </div>
  );
}

export default InboundForm;
