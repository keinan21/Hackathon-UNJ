import { useEffect, useState } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { Kategori, SKU, Tag, SkuTag } from "../../db/types";
import { getPrefixForKategori, computeNextKode } from "../../db/kode";
import { PageHeader, AppButton } from "../../components/ui";
import { Package, Plus, ScanBarcode, Hashtag, WarningCircle, CheckCircle } from "iconoir-react";

function isSkuWithKode(s: SKU): s is SKU & { kode: string } {
  return typeof s.kode === "string" && s.kode.length > 0;
}

export function SkuForm() {
  const [kategoris, setKategoris] = useState<Kategori[]>([]);
  const [nama, setNama] = useState("");
  const [kategoriId, setKategoriId] = useState<string>("");
  const [hpp, setHpp] = useState<string>("");
  const [hargaJual, setHargaJual] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [tags, setTags] = useState<string>("");

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ barcode: string }>;
      const val = ce.detail?.barcode;
      if (typeof val === "string" && val.trim()) setBarcode(val.trim());
    };
    window.addEventListener("barcode-scanned", handler as EventListener);
    try {
      const sess = sessionStorage.getItem("scan-barcode");
      if (sess && sess.trim()) {
        setBarcode(sess.trim());
        sessionStorage.removeItem("scan-barcode");
      }
    } catch {}
    return () => window.removeEventListener("barcode-scanned", handler as EventListener);
  }, []);
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
          .filter(isSkuWithKode)
          .filter((s) => s.kategori_id === kategoriId && s.kode.startsWith(`${prefix}-`))
          .map((s) => s.kode);
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
        .filter(isSkuWithKode)
        .filter((s) => s.kategori_id === kategoriId && s.kode.startsWith(`${prefix}-`))
        .map((s) => s.kode);
      const kode = computeNextKode(existingKodes, prefix);

      const id = crypto.randomUUID();
      const sku: SKU = {
        id,
        nama: nama.trim(),
        kategori_id: kategoriId,
        hpp: hppNum,
        harga_normal: hargaNum,
        kode,
        org_id: "toko-01",
        ...(barcodeTrim ? { barcode: barcodeTrim } : {}),
      };
      await realRepo.createSku(sku);

      const tagNames = tags.split(",").map((t) => t.trim()).filter(Boolean);
      for (const tagNama of tagNames) {
        let tag: Tag | undefined = await dexieV2.tags.where("[org_id+nama]").equals(["toko-01", tagNama]).first().catch(() => undefined);
        if (!tag) {
          const tagId = crypto.randomUUID();
          const newTag: Tag = { id: tagId, nama: tagNama, org_id: "toko-01" };
          await dexieV2.tags.put(newTag);
          tag = newTag;
        }
        const tagIdForLink = tag.id;
        const linkId = crypto.randomUUID();
        const exists = await dexieV2.sku_tags.where("[sku_id+tag_id]").equals([id, tagIdForLink]).first().catch(() => undefined);
        if (!exists) {
          const link: SkuTag = { id: linkId, sku_id: id, tag_id: tagIdForLink, org_id: "toko-01" };
          await dexieV2.sku_tags.put(link);
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
    <div data-testid="sku-baru-page" className="w-full max-w-[640px] mx-auto space-y-5">
      <PageHeader
        title="Tambah SKU"
        subtitle="Isi data barang dengan jelas — kode dibuat otomatis, harga ramah diperiksa."
        icon={<Plus width={18} height={18} />}
      />

      <div
        data-testid="preview-kode"
        className="card bg-[#FFF8E1] border border-[#FFE082]/60 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm"
      >
        <span className="text-sm text-[#8D6E63] font-medium flex items-center gap-2">
          <Package width={16} height={16} /> Preview kode
        </span>
        <span className="font-mono font-bold text-[#0F7A4A] text-[16px]">{previewKode}</span>
      </div>

      <form onSubmit={handleSubmit} className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-5 sm:p-6 space-y-5" noValidate>
        <div>
          <label htmlFor="sku-nama" className="block text-[16px] font-semibold text-neutral mb-2">
            Nama SKU *
          </label>
          <input
            id="sku-nama"
            data-testid="input-nama"
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Susu UHT 1L"
            className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
          />
        </div>

        <div>
          <label htmlFor="sku-kategori" className="block text-[16px] font-semibold text-neutral mb-2">
            Kategori *
          </label>
          <select
            id="sku-kategori"
            data-testid="select-kategori"
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value)}
            className="select select-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
          >
            {kategoris.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sku-hpp" className="block text-[16px] font-semibold text-neutral mb-2">
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
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
            />
          </div>

          <div>
            <label htmlFor="sku-harga" className="block text-[16px] font-semibold text-neutral mb-2">
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
              className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
            />
            {warningHarga && (
              <p data-testid="warning-harga" className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium bg-[#FFF3CD] text-[#856404] border border-[#FFE69C]">
                <WarningCircle width={16} height={16} className="shrink-0" />
                {warningHarga}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="sku-barcode" className="block text-[16px] font-semibold text-neutral mb-2 flex items-center gap-2">
            <ScanBarcode width={16} height={16} className="text-[#0F7A4A]" /> Barcode (opsional)
          </label>
          <div className="flex gap-2">
            <input
              id="sku-barcode"
              data-testid="input-barcode"
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Contoh: 8991234567890"
              className="input input-bordered flex-1 min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
            />
            <AppButton
              type="button"
              variant="outline"
              data-testid="btn-scan-barcode"
              onClick={() => {
                window.history.pushState({}, "", "/scan");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="shrink-0 rounded-xl gap-1.5 min-w-[96px]"
            >
              <ScanBarcode width={16} height={16} /> Scan
            </AppButton>
          </div>
        </div>

        <div>
          <label htmlFor="sku-tags" className="block text-[16px] font-semibold text-neutral mb-2 flex items-center gap-2">
            <Hashtag width={16} height={16} className="text-[#0F7A4A]" /> Tag (pisah koma)
          </label>
          <input
            id="sku-tags"
            data-testid="input-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Contoh: laris, kulkas"
            className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none px-3"
          />
          <p className="text-xs text-[#595959] mt-1.5">Pisahkan dengan koma — membantu pencarian dan pengelompokan.</p>
        </div>

        {error && (
          <p data-testid="form-error" role="alert" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
            <WarningCircle width={16} height={16} className="shrink-0" />
            {error}
          </p>
        )}

        {toast && (
          <p data-testid="form-toast" role="status" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium bg-[#E8F5E9] text-[#0F7A4A] border border-[#C8E6C9]">
            <CheckCircle width={16} height={16} className="shrink-0" />
            {toast}
          </p>
        )}

        <AppButton type="submit" data-testid="btn-simpan-sku" disabled={submitting} loading={submitting} fullWidth className="rounded-xl mt-2">
          {submitting ? "Menyimpan..." : "Simpan SKU"}
        </AppButton>

        <AppButton
          type="button"
          variant="outline"
          onClick={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          data-testid="sku-baru-back"
          fullWidth
          className="rounded-xl"
        >
          Kembali ke katalog
        </AppButton>
      </form>
    </div>
  );
}

export default SkuForm;
