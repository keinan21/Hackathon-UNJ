import { useEffect, useState, useCallback } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { SKU, Kategori, Batch, Tag } from "../../db/types";
import { daysToExpiry } from "../../engine/expiry";
import { PageHeader, EmptyState, AppButton, BadgeKritis } from "../../components/ui";
import { Package, Search, Plus, WarningCircle, ArrowRight } from "iconoir-react";
import { namaTampilKategori } from "../../lib/kategoriTampil";

type BatchMap = Record<string, Batch[]>;
type SkuTagsMap = Record<string, Tag[]>;

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function getMaxThreshold(kategori: Kategori | undefined): number {
  const arr = kategori?.threshold_h_minus ?? [7, 3, 1];
  if (arr.length === 0) return 7;
  return Math.max(...arr);
}

function dedupeKategoris(list: Kategori[]): Kategori[] {
  const seen = new Map<string, Kategori>();
  for (const k of list) {
    const key = `${k.org_id}::${k.nama}`;
    if (!seen.has(key)) seen.set(key, k);
  }
  return [...seen.values()];
}

export function KatalogPage() {
  const [kategoris, setKategoris] = useState<Kategori[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [batchesBySku, setBatchesBySku] = useState<BatchMap>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [skuTagsMap, setSkuTagsMap] = useState<SkuTagsMap>({});
  const [loading, setLoading] = useState(true);
  const [searchRaw, setSearchRaw] = useState("");
  const debouncedSearch = useDebouncedValue(searchRaw, 300);
  const [selectedKategori, setSelectedKategori] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kats, skuList, tagList] = await Promise.all([
        realRepo.listKategoris("toko-01"),
        realRepo.listSkus("toko-01"),
        dexieV2.tags.where("org_id").equals("toko-01").toArray().catch(() => [] as Tag[]),
      ]);
      setKategoris(kats);
      setSkus(skuList);
      setTags(tagList);

      const batchMap: BatchMap = {};
      for (const s of skuList) {
        const batches = await realRepo.listBatchesBySku(s.id, "toko-01");
        batchMap[s.id] = batches;
      }
      setBatchesBySku(batchMap);

      const skuTagMap: SkuTagsMap = {};
      try {
        const allSkuTags = await dexieV2.sku_tags.where("org_id").equals("toko-01").toArray();
        const tagById = new Map(tagList.map((t) => [t.id, t]));
        for (const link of allSkuTags) {
          const tag = tagById.get(link.tag_id);
          if (!tag) continue;
          if (!skuTagMap[link.sku_id]) skuTagMap[link.sku_id] = [];
          skuTagMap[link.sku_id].push(tag);
        }
      } catch {}
      setSkuTagsMap(skuTagMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTambahSku = () => {
    window.history.pushState({}, "", "/sku/baru");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const goBarangMasuk = () => {
    window.history.pushState({}, "", "/masuk");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const goSkuDetail = (skuId: string) => {
    window.history.pushState({}, "", `/sku/${skuId}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const dedupedKategoris = dedupeKategoris(kategoris);
  const searchLower = debouncedSearch.trim().toLowerCase();

  const filtered = skus.filter((sku) => {
    if (selectedKategori !== null && sku.kategori_id !== selectedKategori) return false;
    if (selectedTag !== null) {
      const tagsForSku = skuTagsMap[sku.id] ?? [];
      if (!tagsForSku.some((t) => t.id === selectedTag)) return false;
    }
    if (searchLower === "") return true;
    const tagsForSku = skuTagsMap[sku.id] ?? [];
    const tagNames = tagsForSku.map((t) => t.nama.toLowerCase());
    return (
      sku.nama.toLowerCase().includes(searchLower) ||
      (sku.kode ?? "").toLowerCase().includes(searchLower) ||
      (sku.barcode ?? "").toLowerCase().includes(searchLower) ||
      tagNames.some((n) => n.includes(searchLower))
    );
  });

  const isKritisForSku = (sku: SKU): boolean => {
    const kategori = dedupedKategoris.find((k) => k.id === sku.kategori_id);
    const maxThreshold = getMaxThreshold(kategori);
    const batches = batchesBySku[sku.id] ?? [];
    for (const b of batches) {
      if (b.expiry_date === null) continue;
      const days = daysToExpiry(b.expiry_date);
      if (days === null) continue;
      if (days <= maxThreshold) return true;
    }
    return false;
  };

  const kritisDaysForSku = (sku: SKU): number | null => {
    const kategori = dedupedKategoris.find((k) => k.id === sku.kategori_id);
    const maxThreshold = getMaxThreshold(kategori);
    const batches = batchesBySku[sku.id] ?? [];
    let min: number | null = null;
    for (const b of batches) {
      if (b.expiry_date === null) continue;
      const d = daysToExpiry(b.expiry_date);
      if (d === null) continue;
      if (d <= maxThreshold) {
        if (min === null || d < min) min = d;
      }
    }
    return min;
  };

  if (loading) {
    return (
      <div data-testid="katalog-page" className="w-full max-w-5xl">
        <p className="text-base text-[#595959] text-[16px]" role="status">
          Memuat katalog...
        </p>
      </div>
    );
  }

  const showEmptyAll = skus.length === 0;
  const showEmptySearch = skus.length > 0 && filtered.length === 0;

  return (
    <div data-testid="katalog-page" className="w-full max-w-[720px] mx-auto space-y-5">
      <PageHeader
        title="Katalog SKU"
        subtitle="Cari, filter, dan kelola barang — semua stok di satu tempat."
        icon={<Package width={18} height={18} />}
        action={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <AppButton
              variant="outline"
              onClick={goBarangMasuk}
              data-testid="btn-barang-masuk"
              className="rounded-xl"
            >
              Barang Masuk
            </AppButton>
            <AppButton
              onClick={handleTambahSku}
              data-testid="btn-tambah-sku"
              className="gap-1.5 rounded-xl"
            >
              <Plus width={16} height={16} /> Tambah SKU
            </AppButton>
          </div>
        }
      />

      {/* Search — hangat rounded-xl */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#595959] pointer-events-none">
          <Search width={18} height={18} />
        </span>
        <input
          type="search"
          placeholder="Cari nama, kode, barcode, tag..."
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          data-testid="katalog-search"
          aria-label="Cari SKU"
          className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl bg-base-100 border-base-300 focus:border-[#0F7A4A] focus:outline-none pl-10 pr-3"
        />
      </div>

      {/* Filter — dropdown kategori + tag, ringkas di HP maupun desktop */}
      <div data-testid="katalog-filter" className="flex flex-col sm:flex-row gap-2" role="group" aria-label="Filter kategori dan tag">
        <label className="sr-only" htmlFor="filter-kategori">
          Filter kategori
        </label>
        <select
          id="filter-kategori"
          data-testid="filter-kategori"
          aria-label="Filter kategori"
          value={selectedKategori ?? ""}
          onChange={(e) => {
            setSelectedKategori(e.target.value === "" ? null : e.target.value);
            setSelectedTag(null);
          }}
          className="select select-bordered min-h-12 text-base font-medium w-full sm:max-w-60"
        >
          <option value="">Semua kategori</option>
          {dedupedKategoris.map((k) => (
            <option key={k.id} value={k.id}>
              {namaTampilKategori(k.nama)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-tag">
          Filter tag
        </label>
        <select
          id="filter-tag"
          data-testid="filter-tag"
          aria-label="Filter tag"
          value={selectedTag ?? ""}
          onChange={(e) => {
            setSelectedTag(e.target.value === "" ? null : e.target.value);
            setSelectedKategori(null);
          }}
          className="select select-bordered min-h-12 text-base font-medium w-full sm:max-w-60"
        >
          <option value="">Semua tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.nama}
            </option>
          ))}
        </select>
        {selectedKategori !== null || selectedTag !== null ? (
          <button
            type="button"
            data-testid="filter-reset"
            aria-label="Tampilkan semua"
            onClick={() => {
              setSelectedKategori(null);
              setSelectedTag(null);
            }}
            className="btn btn-ghost min-h-12 text-base font-semibold sm:w-auto"
          >
            Reset
          </button>
        ) : null}
      </div>

      {/* List */}
      {showEmptyAll ? (
        <div data-testid="katalog-empty" role="status" aria-live="polite">
          <EmptyState
            icon={<Package width={28} height={28} strokeWidth={1.4} />}
            title="Belum ada SKU"
            description="Mulai dengan tambah barang pertama. Mudah — cukup nama, kategori, dan harga."
            actionLabel="Tambah SKU"
            onAction={handleTambahSku}
            actionTestId="btn-empty-tambah-sku"
            className="mt-2"
          />
        </div>
      ) : showEmptySearch ? (
        <div
          data-testid="katalog-empty-search"
          className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-8 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#FFF8E1] border border-[#FFE082]/60 flex items-center justify-center text-[#8D6E63] mx-auto mb-4">
            <Search width={26} height={26} strokeWidth={1.6} />
          </div>
          <h3 className="text-base font-bold text-neutral">Tidak ada hasil</h3>
          <p className="text-sm text-[#595959] mt-1">Untuk &quot;{debouncedSearch.trim()}&quot; tidak ditemukan</p>
          <p className="text-sm text-[#595959] mt-1">Coba kata kunci lain atau tambah SKU baru.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-label="Daftar SKU" data-testid="katalog-list">
          {filtered.map((sku) => {
            const isKritis = isKritisForSku(sku);
            const batches = batchesBySku[sku.id] ?? [];
            const tagsForSku = skuTagsMap[sku.id] ?? [];
            const kategori = dedupedKategoris.find((k) => k.id === sku.kategori_id);
            return (
              <li
                key={sku.id}
                data-testid={`sku-card-${sku.id}`}
                className="card card-border bg-base-100 hover:border-primary transition-colors"
              >
                <button
                  type="button"
                  onClick={() => goSkuDetail(sku.id)}
                  data-testid={`sku-open-${sku.id}`}
                  aria-label={`Lihat detail ${sku.nama}`}
                  className="w-full text-left p-4 min-h-12"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-field">
                          <Package width={16} height={16} />
                        </div>
                        <p className="text-base font-semibold truncate">{sku.nama}</p>
                      </div>
                      <p className="text-sm text-base-content/70 mt-2 ml-1">
                        {sku.kode ?? "-"} {sku.barcode ? `• ${sku.barcode}` : ""} • {kategori ? namaTampilKategori(kategori.nama) : "-"}
                      </p>
                      {tagsForSku.length > 0 && (
                        <p className="text-xs text-base-content/70 mt-1 ml-1" data-testid={`sku-tags-${sku.id}`}>
                          {tagsForSku.map((t) => `#${t.nama}`).join(" ")}
                        </p>
                      )}
                      <p className="text-sm mt-1.5 ml-1">
                        HPP Rp{sku.hpp.toLocaleString("id-ID")} • Harga Rp{sku.harga_normal.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {isKritis ? (
                        <span
                          data-testid={`badge-kritis-${sku.id}`}
                          aria-label="Kritis - stok mepet kadaluarsa"
                          className="badge badge-sm badge-error gap-1 font-bold"
                        >
                          <WarningCircle width={12} height={12} aria-hidden /> Kritis
                        </span>
                      ) : null}
                      {sku.harga_normal < sku.hpp ? (
                        <span
                          data-testid={`badge-rugi-${sku.id}`}
                          aria-label="Harga jual di bawah modal"
                          className="badge badge-sm badge-warning gap-1 font-bold"
                        >
                          Di bawah modal
                        </span>
                      ) : null}
                      <span className="badge badge-soft badge-sm">
                        {batches.length} batch
                      </span>
                      <ArrowRight width={18} height={18} aria-hidden="true" className="text-base-content/40" />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="sr-only" role="status" aria-live="polite" data-testid="katalog-count">
        {filtered.length} SKU ditemukan
      </p>
    </div>
  );
}

export default KatalogPage;
