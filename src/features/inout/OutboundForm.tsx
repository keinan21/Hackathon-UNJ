import { useEffect, useState } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { SKU, Batch } from "../../db/types";
import { PageHeader, AppButton } from "../../components/ui";
import { Package, WarningCircle, CheckCircle, ShoppingBag } from "iconoir-react";

export type OutboundFormProps = {
  /** Jika dari detail SKU, skuId read-only prefill */
  skuId?: string;
};

export function OutboundForm({ skuId: initialSkuId }: OutboundFormProps = {}) {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [skuId, setSkuId] = useState<string>(initialSkuId ?? "");
  const [qty, setQty] = useState<string>("");
  const [penerima, setPenerima] = useState<string>("");
  const [catatan, setCatatan] = useState<string>("");
  const [batches, setBatches] = useState<Batch[]>([]);

  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const isReadOnlySku = !!initialSkuId;

  useEffect(() => {
    (async () => {
      const list = await realRepo.listSkus("toko-01");
      setSkus(list);
      if (initialSkuId) setSkuId(initialSkuId);
    })();
  }, [initialSkuId]);

  // load batches preview when sku selected
  useEffect(() => {
    if (!skuId) {
      setBatches([]);
      return;
    }
    (async () => {
      try {
        const list = await realRepo.listBatchesBySku(skuId, "toko-01");
        // sort FEFO: expiry terdekat dulu, null di akhir
        const sorted = [...list].sort((a, b) => {
          if (a.expiry_date === null && b.expiry_date === null) return 0;
          if (a.expiry_date === null) return 1;
          if (b.expiry_date === null) return -1;
          return a.expiry_date.localeCompare(b.expiry_date);
        });
        setBatches(sorted);
      } catch {
        setBatches([]);
      }
    })();
  }, [skuId]);

  const stokTotal = batches.reduce((s, b) => s + b.qty, 0);
  const stokExpiring = batches.filter((b) => b.expiry_date !== null).reduce((s, b) => s + b.qty, 0);
  const stokAvailablePreview = (() => {
    const expiring = batches.filter((b) => b.expiry_date !== null && b.qty > 0);
    if (expiring.length > 0) return expiring.reduce((s, b) => s + b.qty, 0);
    return batches.filter((b) => b.expiry_date === null && b.qty > 0).reduce((s, b) => s + b.qty, 0);
  })();

  const selectedSku = skus.find((s) => s.id === skuId);

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
      setError("Qty harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const sku = await dexieV2.skus.get(skuId);
      if (!sku) {
        setError("SKU tidak ditemukan");
        return;
      }

      // FEFO consume + transaksi keluar atomic
      await dexieV2.transaction("rw", dexieV2.skus, dexieV2.batches, dexieV2.transaksis, async () => {
        // ambil batch qty>0 untuk sku ini
        const all: Batch[] = await dexieV2.batches
          .where("[org_id+sku_id]")
          .equals(["toko-01", skuId])
          .toArray();

        const expiring = all.filter((b) => b.expiry_date !== null && b.qty > 0).sort((a, b) => {
          if (a.expiry_date === null && b.expiry_date === null) return 0;
          if (a.expiry_date === null) return 1;
          if (b.expiry_date === null) return -1;
          return (a.expiry_date as string).localeCompare(b.expiry_date as string);
        });
        const nonPerishable = all.filter((b) => b.expiry_date === null && b.qty > 0);

        let target: Batch[];
        let totalAvailable: number;
        if (expiring.length > 0) {
          target = expiring;
          totalAvailable = expiring.reduce((s, b) => s + b.qty, 0);
        } else {
          target = nonPerishable;
          totalAvailable = nonPerishable.reduce((s, b) => s + b.qty, 0);
        }

        if (totalAvailable < qtyNum) {
          throw new Error("Stok tidak cukup");
        }

        let remaining = qtyNum;
        for (const batch of target) {
          if (remaining <= 0) break;
          const take = Math.min(batch.qty, remaining);
          const newQty = batch.qty - take;
          await dexieV2.batches.put({ ...batch, qty: newQty });
          remaining -= take;
        }

        const nowIso = new Date().toISOString();
        await (dexieV2.transaksis as unknown as { put: (x: unknown) => Promise<unknown> }).put({
          id: crypto.randomUUID(),
          sku_id: skuId,
          qty_sold: qtyNum,
          sold_at: nowIso,
          org_id: "toko-01",
          jenis: "keluar",
          harga_jual_snapshot: sku.harga_normal,
          pengirim: null,
          penerima: penerima.trim() || null,
          catatan: catatan.trim() || null,
        });
        // stash for event
        (globalThis as unknown as Record<string, string>).__outbound_sku_id = skuId;
      });

      const savedSkuId = (globalThis as unknown as Record<string, string>).__outbound_sku_id ?? skuId;
      delete (globalThis as unknown as Record<string, unknown>).__outbound_sku_id;

      setSuccess("Barang keluar berhasil dicatat");

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("outbound-created", { detail: { id: savedSkuId } }));
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Qty harus lebih dari 0")) setError("Qty harus lebih dari 0");
      else if (msg.includes("Stok tidak cukup")) setError("Stok tidak cukup");
      else if (msg.includes("SKU tidak ditemukan")) setError("SKU tidak ditemukan");
      else if (msg.includes("Pilih SKU")) setError("Pilih SKU terlebih dahulu");
      else setError(msg || "Gagal mencatat barang keluar");
    } finally {
      setSubmitting(false);
    }
  };

  const isEmptySku = skus.length === 0;

  return (
    <div data-testid="outbound-page" className="w-full max-w-[640px] mx-auto space-y-5">
      <PageHeader
        title="Barang Keluar"
        subtitle="Kurangi stok — pilih SKU, isi jumlah, penerima dan catatan. FEFO: batch kadaluarsa terdekat keluar dulu otomatis."
        icon={<ShoppingBag width={18} height={18} />}
      />

      {isEmptySku ? (
        <div
          data-testid="outbound-empty"
          className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-8 text-center flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#FFF8E1] border border-[#FFE082]/60 flex items-center justify-center text-[#8D6E63] mb-4">
            <Package width={28} height={28} strokeWidth={1.6} />
          </div>
          <h3 className="text-base font-bold text-neutral">Belum ada SKU</h3>
          <p className="text-sm text-[#595959] mt-1.5 leading-relaxed max-w-sm">Tambah SKU dulu sebelum mencatat barang keluar.</p>
          <AppButton
            onClick={() => {
              window.history.pushState({}, "", "/sku/baru");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            data-testid="outbound-empty-cta"
            className="mt-5 rounded-xl"
          >
            Tambah SKU
          </AppButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5 sm:p-6 space-y-5" noValidate>
          <div>
            <label htmlFor="outbound-sku" className="block text-[16px] font-semibold text-neutral mb-2 flex items-center gap-2">
              <Package width={16} height={16} className="text-[#0F7A4A]" /> SKU *
            </label>
            {isReadOnlySku && selectedSku ? (
              <div
                data-testid="outbound-sku-readonly"
                className="w-full min-h-[48px] flex items-center px-3 rounded-xl bg-base-200 border border-base-300 text-[16px] font-medium text-neutral"
              >
                {selectedSku.nama} — {selectedSku.kode ?? selectedSku.id.slice(0, 6)} (Rp{selectedSku.harga_normal.toLocaleString("id-ID")})
              </div>
            ) : (
              <select
                id="outbound-sku"
                data-testid="select-outbound-sku"
                value={skuId}
                onChange={(e) => setSkuId(e.target.value)}
                className="select select-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
              >
                <option value="">Pilih SKU</option>
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} — {s.kode ?? s.id.slice(0, 6)} (Rp{s.harga_normal.toLocaleString("id-ID")})
                  </option>
                ))}
              </select>
            )}
            {skuId && (
              <p data-testid="outbound-stok-info" className="text-xs text-[#595959] mt-1.5">
                Stok total: {stokTotal} pcs • Stok siap FEFO: {stokAvailablePreview} pcs
                {stokExpiring > 0 ? ` (expiry) • ${stokExpiring} expiring` : " (non-perishable)"}
              </p>
            )}
          </div>

          {/* Preview batch FEFO order kecil */}
          {batches.length > 0 && skuId && (
            <div data-testid="outbound-fefo-preview" className="rounded-xl bg-[#F5F5F0] border border-base-300/40 p-3">
              <p className="text-xs font-semibold text-neutral uppercase tracking-wide">Urutan FEFO (keluar terdekat dulu)</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {batches.slice(0, 3).map((b) => (
                  <li key={b.id} data-testid={`fefo-row-${b.id}`} className="text-xs text-[#595959] flex justify-between gap-2">
                    <span>
                      exp {b.expiry_date ?? "Tanpa kadaluarsa"} • {b.qty} pcs
                    </span>
                    <span className="font-medium">Rp{b.hpp_snapshot.toLocaleString("id-ID")}</span>
                  </li>
                ))}
                {batches.length > 3 && <li className="text-xs text-[#595959]">+{batches.length - 3} batch lagi</li>}
              </ul>
            </div>
          )}

          <div>
            <label htmlFor="outbound-qty" className="block text-[16px] font-semibold text-neutral mb-2">
              Jumlah *
            </label>
            <input
              id="outbound-qty"
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
            <label htmlFor="outbound-penerima" className="block text-[16px] font-semibold text-neutral mb-2">
              Penerima
            </label>
            <input
              id="outbound-penerima"
              data-testid="input-penerima"
              type="text"
              value={penerima}
              onChange={(e) => setPenerima(e.target.value)}
              placeholder="Contoh: Pelanggan / Cabang B"
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
            />
          </div>

          <div>
            <label htmlFor="outbound-catatan" className="block text-[16px] font-semibold text-neutral mb-2">
              Catatan
            </label>
            <textarea
              id="outbound-catatan"
              data-testid="textarea-catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Retur rusak, penjualan ecer"
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

          <AppButton type="submit" data-testid="btn-keluar-simpan" disabled={submitting} loading={submitting} fullWidth className="rounded-xl mt-2">
            {submitting ? "Menyimpan..." : "Simpan Barang Keluar"}
          </AppButton>

          <AppButton
            type="button"
            variant="outline"
            onClick={() => {
              window.history.pushState({}, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            data-testid="outbound-back"
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

export default OutboundForm;
