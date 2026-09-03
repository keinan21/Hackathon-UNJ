import { useEffect, useState } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { Kategori } from "../../db/types";
import { getPrefixForKategori, computeNextKode } from "../../db/kode";

export function SkuForm() {
  const [kategoris, setKategoris] = useState<Kategori[]>([]);
  const [nama, setNama] = useState("");
  const [kategoriId, setKategoriId] = useState<string>("");
  const [hpp, setHpp] = useState<string>("");
  const [hargaJual, setHargaJual] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [previewKode, setPreviewKode] = useState<string>("-");
  const [error, setError] = useState<string>("");
  const [warningHarga, setWarningHarga] = useState<string>("");
  const [toast, setToast] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await realRepo.listKategoris("toko-01");
      setKategoris(list);
      if (list.length > 0 && !kategoriId) setKategoriId(list[0].id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!kategoriId) {
        setPreviewKode("-");
        return;
      }
      const kat = kategoris.find((k) => k.id === kategoriId);
      if (!kat) {
        setPreviewKode("-");
        return;
      }
      const prefix = getPrefixForKategori(kat.nama);
      try {
        const skus = await dexieV2.skus.where("org_id").equals("toko-01").toArray();
        const existingKodes = skus
          .filter((s) => s.kategori_id === kategoriId && !!s.kode && (s.kode as string).startsWith(`${prefix}-`))
          .map((s) => s.kode as string);
        const next = computeNextKode(existingKodes, prefix);
        setPreviewKode(next);
      } catch {
        setPreviewKode(`${prefix}-001`);
      }
    })();
  }, [kategoriId, kategoris]);

  useEffect(() => {
    const hppNum = Number(hpp);
    const hargaNum = Number(hargaJual);
    if (hpp && hargaJual && Number.isFinite(hppNum) && Number.isFinite(hargaNum) && hppNum > 0 && hargaNum < hppNum) {
      setWarningHarga("Harga jual di bawah HPP");
    } else {
      setWarningHarga("");
    }
  }, [hpp, hargaJual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setToast("");

    if (!nama.trim()) {
      setError("Nama SKU tidak boleh kosong");
      return;
    }
    if (!kategoriId) {
      setError("Kategori wajib dipilih");
      return;
    }
    const hppNum = Number(hpp);
    if (!Number.isFinite(hppNum) || !(hppNum > 0)) {
      setError("HPP harus lebih dari 0");
      return;
    }
    const hargaNum = Number(hargaJual);
    if (!Number.isFinite(hargaNum) || hargaNum < 0) {
      setError("Harga jual tidak valid");
      return;
    }

    const barcodeTrim = barcode.trim();
    if (barcodeTrim) {
      try {
        const dup = await dexieV2.skus.where("org_id").equals("toko-01").filter((s) => s.barcode === barcodeTrim).first();
        if (dup) {
          setError("Barcode sudah dipakai");
          return;
        }
      } catch {}
    }

    setSubmitting(true);
    try {
      const kat = kategoris.find((k) => k.id === kategoriId);
      const kategoriNama = kat?.nama ?? "SK";
      const prefix = getPrefixForKategori(kategoriNama);
      const allSkus = await dexieV2.skus.where("org_id").equals("toko-01").toArray();
      const existingKodes = allSkus
        .filter((s) => s.kategori_id === kategoriId && !!s.kode && (s.kode as string).startsWith(`${prefix}-`))
        .map((s) => s.kode as string);
      const kode = computeNextKode(existingKodes, prefix);

      const id = crypto.randomUUID();
      const sku = {
        id,
        nama: nama.trim(),
        kategori_id: kategoriId,
        hpp: hppNum,
        harga_normal: hargaNum,
        barcode: barcodeTrim || undefined,
        kode,
        org_id: "toko-01",
      };
      await realRepo.createSku(sku as any);

      const tagNames = tags.split(",").map((t) => t.trim()).filter(Boolean);
      for (const tagNama of tagNames) {
        let tag = await dexieV2.tags.where("[org_id+nama]").equals(["toko-01", tagNama]).first().catch(() => undefined);
        if (!tag) {
          const tagId = crypto.randomUUID();
          const newTag = { id: tagId, nama: tagNama, org_id: "toko-01" };
          await dexieV2.tags.put(newTag as any);
          tag = newTag as any;
        }
        const tagIdForLink = tag!.id;
        const linkId = crypto.randomUUID();
        const exists = await dexieV2.sku_tags.where("[sku_id+tag_id]").equals([id, tagIdForLink]).first().catch(() => undefined);
        if (!exists) {
          await dexieV2.sku_tags.put({ id: linkId, sku_id: id, tag_id: tagIdForLink, org_id: "toko-01" } as any);
        }
      }

      setToast("SKU berhasil dibuat");
      setTimeout(() => {
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
        window.dispatchEvent(new CustomEvent("sku-created", { detail: { id, kode } }));
      }, 400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Barcode sudah dipakai")) setError("Barcode sudah dipakai");
      else if (msg.includes("HPP harus lebih dari 0")) setError("HPP harus lebih dari 0");
      else if (msg.includes("Nama SKU tidak boleh kosong")) setError("Nama SKU tidak boleh kosong");
      else setError(msg || "Gagal membuat SKU");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="sku-baru-page" className="w-full max-w-[480px] mx-auto px-4 space-y-4">
      <h2 className="text-[20px] font-bold text-[#1A1A1A]" style={{ fontSize: "20px" }}>
        Tambah SKU
      </h2>

      <div
        data-testid="preview-kode"
        className="bg-white border border-[#D9D9D9] rounded-[12px] p-3 flex items-center justify-between"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
      >
        <span className="text-[14px] text-[#595959]" style={{ fontSize: "14px" }}>
          Preview kode
        </span>
        <span className="font-mono font-semibold text-[#0F7A4A]" style={{ fontSize: "16px" }}>
          {previewKode}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="sku-nama" className="block text-[14px] font-medium text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
            Nama SKU *
          </label>
          <input
            id="sku-nama"
            data-testid="input-nama"
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Susu UHT 1L"
            className="w-full border border-[#D9D9D9] rounded-[12px] px-3"
            style={{ minHeight: "48px", fontSize: "16px" }}
          />
        </div>

        <div>
          <label htmlFor="sku-kategori" className="block text-[14px] font-medium text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
            Kategori *
          </label>
          <select
            id="sku-kategori"
            data-testid="select-kategori"
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value)}
            className="w-full border border-[#D9D9D9] rounded-[12px] px-3 bg-white"
            style={{ minHeight: "48px", fontSize: "16px" }}
          >
            {kategoris.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sku-hpp" className="block text-[14px] font-medium text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
            HPP *
          </label>
          <input
            id="sku-hpp"
            data-testid="input-hpp"
            type="number"
            inputMode="numeric"
            value={hpp}
            onChange={(e) => setHpp(e.target.value)}
            placeholder="Contoh: 12000"
            className="w-full border border-[#D9D9D9] rounded-[12px] px-3"
            style={{ minHeight: "48px", fontSize: "16px" }}
          />
        </div>

        <div>
          <label htmlFor="sku-harga" className="block text-[14px] font-medium text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
            Harga jual *
          </label>
          <input
            id="sku-harga"
            data-testid="input-harga"
            type="number"
            inputMode="numeric"
            value={hargaJual}
            onChange={(e) => setHargaJual(e.target.value)}
            placeholder="Contoh: 15000"
            className="w-full border border-[#D9D9D9] rounded-[12px] px-3"
            style={{ minHeight: "48px", fontSize: "16px" }}
          />
          {warningHarga && (
            <p data-testid="warning-harga" className="mt-1 rounded-[8px] px-3 py-2 text-[14px] font-medium" style={{ fontSize: "14px", backgroundColor: "#FFF3CD", color: "#856404", border: "1px solid #FFE69C" }}>
              {warningHarga}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="sku-barcode" className="block text-[14px] font-medium text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
            Barcode (opsional)
          </label>
          <input
            id="sku-barcode"
            data-testid="input-barcode"
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Contoh: 8991234567890"
            className="w-full border border-[#D9D9D9] rounded-[12px] px-3"
            style={{ minHeight: "48px", fontSize: "16px" }}
          />
        </div>

        <div>
          <label htmlFor="sku-tags" className="block text-[14px] font-medium text-[#1A1A1A] mb-1" style={{ fontSize: "14px" }}>
            Tag (pisah koma)
          </label>
          <input
            id="sku-tags"
            data-testid="input-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Contoh: laris, kulkas"
            className="w-full border border-[#D9D9D9] rounded-[12px] px-3"
            style={{ minHeight: "48px", fontSize: "16px" }}
          />
        </div>

        {error && (
          <p data-testid="form-error" role="alert" className="rounded-[8px] px-3 py-2 text-[14px] font-medium" style={{ fontSize: "14px", backgroundColor: "#FFEBEE", color: "#C62828", border: "1px solid #FFCDD2" }}>
            {error}
          </p>
        )}

        {toast && (
          <p data-testid="form-toast" role="status" className="rounded-[8px] px-3 py-2 text-[14px] font-medium" style={{ fontSize: "14px", backgroundColor: "#E8F5E9", color: "#0F7A4A", border: "1px solid #C8E6C9" }}>
            {toast}
          </p>
        )}

        <button
          type="submit"
          data-testid="btn-simpan-sku"
          disabled={submitting}
          className="w-full rounded-[12px] font-semibold disabled:opacity-50"
          style={{ minHeight: "48px", fontSize: "16px", backgroundColor: "#0F7A4A", color: "#FFFFFF", border: "none" }}
        >
          {submitting ? "Menyimpan..." : "Simpan SKU"}
        </button>

        <button
          type="button"
          onClick={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          data-testid="sku-baru-back"
          className="w-full rounded-[12px] font-semibold border border-[#0F7A4A] text-[#0F7A4A] bg-white"
          style={{ minHeight: "48px", fontSize: "16px" }}
        >
          Kembali ke katalog
        </button>
      </form>
    </div>
  );
}

export default SkuForm;
