import { useEffect, useState } from "react";
import { realRepo } from "../../db/dexieRepository";
import { seedDefaultKategoris } from "../../db/seed";
import type { SKU, Kategori, Batch } from "../../db/types";

export function SkuBatchManager() {
  const [kategoris, setKategoris] = useState<Kategori[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [batchesBySku, setBatchesBySku] = useState<Record<string, Batch[]>>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: "", kategori_id: "", hpp: "", harga_normal: "", barcode: "" });
  const [batchForm, setBatchForm] = useState<Record<string, { qty: string; expiry_date: string; tanpaExpiry: boolean }>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let kats = await realRepo.listKategoris("toko-01");
      if (kats.length === 0) {
        // Seed 3 kategori real untuk string ids (v2)
        const defaults = [
          { id: "k-dairy", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" },
          { id: "k-snack", nama: "Snack", threshold_h_minus: [7, 3, 1], org_id: "toko-01" },
          { id: "k-beras", nama: "Beras", threshold_h_minus: [7, 3, 1], org_id: "toko-01" },
        ];
        for (const k of defaults) {
          try {
            await realRepo.createKategori(k as any);
          } catch {}
        }
        kats = await realRepo.listKategoris("toko-01");
        // Fallback to old seed if still empty (for numeric DB)
        if (kats.length === 0) {
          await seedDefaultKategoris(realRepo as unknown as import("../../db/db").InventoryRepository).catch(() => {});
          kats = await realRepo.listKategoris("toko-01");
        }
      }
      setKategoris(kats);
      if (kats.length > 0 && !form.kategori_id) setForm((f) => ({ ...f, kategori_id: kats[0].id }));
      const skuList = await realRepo.listSkus("toko-01");
      setSkus(skuList);
      const map: Record<string, Batch[]> = {};
      for (const s of skuList) {
        const batches = await realRepo.listBatchesBySku(s.id, "toko-01");
        map[s.id] = batches;
      }
      setBatchesBySku(map);
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAddSku = async () => {
    setError(null);
    try {
      const hpp = Number(form.hpp);
      const harga = Number(form.harga_normal);
      if (!form.nama.trim()) throw new Error("Nama SKU wajib diisi");
      if (!form.kategori_id) throw new Error("Kategori wajib dipilih");
      if (!(hpp > 0)) throw new Error("HPP harus lebih dari 0");
      if (harga < hpp) throw new Error("Harga normal tidak boleh di bawah HPP");
      const id = `sku-${Date.now()}`;
      const sku: SKU = {
        id,
        nama: form.nama.trim(),
        kategori_id: form.kategori_id,
        hpp,
        harga_normal: harga,
        barcode: form.barcode.trim() || undefined,
        org_id: "toko-01",
      };
      await realRepo.createSku(sku);
      setForm({ nama: "", kategori_id: kategoris[0]?.id ?? "", hpp: "", harga_normal: "", barcode: "" });
      setToast("SKU berhasil ditambahkan");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAddBatch = async (skuId: string) => {
    const bf = batchForm[skuId] ?? { qty: "", expiry_date: "", tanpaExpiry: false };
    setError(null);
    try {
      const qty = Number(bf.qty);
      if (!(qty > 0)) throw new Error("Qty harus lebih dari 0");
      const sku = skus.find((s) => s.id === skuId);
      if (!sku) throw new Error("SKU tidak ditemukan");
      let expiry: string | null = bf.tanpaExpiry ? null : bf.expiry_date || null;
      if (!bf.tanpaExpiry && !expiry) throw new Error("Tanggal kadaluarsa wajib diisi atau centang Tanpa kadaluarsa");
      // hpp_snapshot copy dari SKU
      const batch: Batch = {
        id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sku_id: skuId,
        qty,
        expiry_date: expiry,
        received_at: new Date().toISOString(),
        hpp_snapshot: sku.hpp,
        org_id: "toko-01",
      };
      await realRepo.createBatch(batch);
      setBatchForm((prev) => ({ ...prev, [skuId]: { qty: "", expiry_date: "", tanpaExpiry: false } }));
      setToast("Batch berhasil ditambahkan");
      await load();
      // Trigger advisor on-demand if urgent
      try {
        const { createLLMFromPinStore } = await import("../../advisor/RealJustwokerLLM");
        const llm = await createLLMFromPinStore("2005");
        const { LangChainGeminiAdvisor } = await import("../../advisor/LangChainGeminiAdvisor");
        const advisor = new LangChainGeminiAdvisor(realRepo, llm, { now: () => new Date() });
        await advisor.onBatchInserted(batch.id, "toko-01").catch(() => {});
      } catch {}
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-[480px] mx-auto px-4">
        <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>
          Memuat SKU...
        </p>
      </div>
    );
  }

  return (
    <div data-testid="sku-page" className="w-full max-w-[480px] mx-auto px-4 space-y-6">
      <h2 className="text-[20px] font-bold text-[#1A1A1A]" style={{ fontSize: "20px" }}>
        SKU & Batch
      </h2>

      {error && (
        <div role="alert" className="bg-[#FFEBEE] border border-[#C62828] text-[#C62828] rounded-[12px] px-3 py-3 text-[14px]" style={{ fontSize: "14px" }}>
          {error}
        </div>
      )}
      {toast && (
        <div role="status" className="bg-[#E8F5E9] border border-[#0F7A4A] text-[#0F7A4A] rounded-[12px] px-3 py-3 text-[14px]" style={{ fontSize: "14px" }}>
          {toast}
        </div>
      )}

      {/* Form Tambah SKU */}
      <section className="bg-white border border-[#D9D9D9] rounded-[12px] p-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h3 className="text-[16px] font-semibold text-[#1A1A1A] mb-3" style={{ fontSize: "16px" }}>
          Tambah SKU
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[14px] font-semibold text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
              Nama SKU *
            </label>
            <input
              type="text"
              placeholder="Contoh: Susu UHT 1L"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="w-full border border-[#D9D9D9] rounded-[8px] px-3 text-base focus:outline-none focus:border-[#0F7A4A] focus:ring-1 focus:ring-[#0F7A4A]"
              style={{ minHeight: "48px", fontSize: "16px" }}
              data-testid="sku-nama"
            />
          </div>
          <div>
            <label className="block text-[14px] font-semibold text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
              Kategori *
            </label>
            <select
              value={form.kategori_id}
              onChange={(e) => setForm({ ...form, kategori_id: e.target.value })}
              className="w-full border border-[#D9D9D9] rounded-[8px] px-3 text-base focus:outline-none focus:border-[#0F7A4A]"
              style={{ minHeight: "48px", fontSize: "16px" }}
              data-testid="sku-kategori"
            >
              {kategoris.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} [H-{k.threshold_h_minus.join(",")}]
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[14px] font-semibold text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
                HPP *
              </label>
              <input
                type="number"
                placeholder="10000"
                value={form.hpp}
                onChange={(e) => setForm({ ...form, hpp: e.target.value })}
                className="w-full border border-[#D9D9D9] rounded-[8px] px-3 text-base"
                style={{ minHeight: "48px", fontSize: "16px" }}
                data-testid="sku-hpp"
              />
            </div>
            <div>
              <label className="block text-[14px] font-semibold text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
                Harga Normal *
              </label>
              <input
                type="number"
                placeholder="15000"
                value={form.harga_normal}
                onChange={(e) => setForm({ ...form, harga_normal: e.target.value })}
                className="w-full border border-[#D9D9D9] rounded-[8px] px-3 text-base"
                style={{ minHeight: "48px", fontSize: "16px" }}
                data-testid="sku-harga"
              />
            </div>
          </div>
          <div>
            <label className="block text-[14px] font-semibold text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
              Barcode (opsional)
            </label>
            <input
              type="text"
              placeholder="899..."
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className="w-full border border-[#D9D9D9] rounded-[8px] px-3 text-base"
              style={{ minHeight: "48px", fontSize: "16px" }}
              data-testid="sku-barcode"
            />
          </div>
          <button
            type="button"
            onClick={handleAddSku}
            className="btn btn-primary w-full min-h-[48px] text-base font-semibold rounded-[12px]"
            style={{ minHeight: "48px", fontSize: "16px", backgroundColor: "#0F7A4A", color: "#FFFFFF", border: "none" }}
            data-testid="sku-submit"
          >
            Simpan SKU
          </button>
        </div>
      </section>

      {/* List SKU + Batch */}
      <section>
        <h3 className="text-[16px] font-semibold text-[#1A1A1A] mb-2" style={{ fontSize: "16px" }}>
          Daftar SKU ({skus.length})
        </h3>
        {skus.length === 0 ? (
          <div className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>
              Belum ada SKU. Tambah jenis barang dulu, contoh Susu UHT 1L.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {skus.map((s) => {
              const batches = batchesBySku[s.id] ?? [];
              const bf = batchForm[s.id] ?? { qty: "", expiry_date: "", tanpaExpiry: false };
              return (
                <li key={s.id} className="bg-white border border-[#D9D9D9] rounded-[12px] p-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <p className="font-semibold text-[#1A1A1A]" style={{ fontSize: "16px" }}>
                    {s.nama}
                  </p>
                  <p className="text-[14px] text-[#595959]" style={{ fontSize: "14px" }}>
                    HPP Rp{s.hpp.toLocaleString("id-ID")} • Harga Rp{s.harga_normal.toLocaleString("id-ID")} • {kategoris.find((k) => k.id === s.kategori_id)?.nama}
                  </p>
                  {batches.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {batches.map((b) => (
                        <li key={b.id} className="text-[14px] text-[#1A1A1A] flex justify-between" style={{ fontSize: "14px" }}>
                          <span>
                            {b.qty} pcs • exp {b.expiry_date ?? "Tanpa kadaluarsa"} • HPP Rp{b.hpp_snapshot.toLocaleString("id-ID")}
                          </span>
                          <span className="text-[#595959]">#{b.id.slice(-4)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="Qty"
                      value={bf.qty}
                      onChange={(e) => setBatchForm((prev) => ({ ...prev, [s.id]: { ...bf, qty: e.target.value } }))}
                      className="border border-[#D9D9D9] rounded-[8px] px-2 text-base"
                      style={{ minHeight: "48px", fontSize: "16px" }}
                      data-testid={`batch-qty-${s.id}`}
                    />
                    <input
                      type="date"
                      value={bf.expiry_date}
                      disabled={bf.tanpaExpiry}
                      onChange={(e) => setBatchForm((prev) => ({ ...prev, [s.id]: { ...bf, expiry_date: e.target.value } }))}
                      className="border border-[#D9D9D9] rounded-[8px] px-2 text-base disabled:bg-[#F5F5F0]"
                      style={{ minHeight: "48px", fontSize: "16px" }}
                      data-testid={`batch-expiry-${s.id}`}
                    />
                    <label className="flex items-center gap-1 text-[12px] text-[#595959]" style={{ fontSize: "12px" }}>
                      <input type="checkbox" checked={bf.tanpaExpiry} onChange={(e) => setBatchForm((prev) => ({ ...prev, [s.id]: { ...bf, tanpaExpiry: e.target.checked } }))} data-testid={`batch-tanpa-${s.id}`} /> Tanpa
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddBatch(s.id)}
                    className="btn btn-primary w-full min-h-[48px] mt-2 text-base font-semibold rounded-[12px]"
                    style={{ minHeight: "48px", fontSize: "16px", backgroundColor: "#0F7A4A", color: "#FFFFFF", border: "none" }}
                    data-testid={`batch-submit-${s.id}`}
                  >
                    Simpan Batch
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={async () => {
          if (confirm("Reset semua data SKU/Batch?")) {
            await (realRepo as unknown as { clearAll: (org: string) => Promise<void> }).clearAll("toko-01");
            location.reload();
          }
        }}
        className="btn btn-outline w-full min-h-[48px] text-base font-semibold rounded-[12px] border-[#C62828] text-[#C62828]"
        style={{ minHeight: "48px", fontSize: "16px", borderColor: "#C62828", color: "#C62828", backgroundColor: "#FFFFFF" }}
        data-testid="btn-reset-data"
      >
        Reset Data
      </button>
    </div>
  );
}

export default SkuBatchManager;
