import { useEffect, useState, useCallback } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { SKU, Kategori, Batch, Tag } from "../../db/types";
import { daysToExpiry } from "../../engine/expiry";
import { PageHeader, EmptyState, AppButton, BadgeKritis } from "../../components/ui";
import { Package, Search, Plus, WarningCircle } from "iconoir-react";

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
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

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
      <div data-testid="katalog-page" className="w-full max-w-[720px] mx-auto">
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
          <AppButton
            onClick={handleTambahSku}
            data-testid="btn-tambah-sku"
            className="gap-1.5 rounded-xl"
          >
            <Plus width={16} height={16} /> Tambah SKU
          </AppButton>
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

      {/* Chips kategori + tag */}
      <div data-testid="katalog-chips" className="flex flex-wrap gap-2" role="group" aria-label="Filter kategori dan tag">
        <button
          type="button"
          onClick={() => {
            setSelectedKategori(null);
            setSelectedTag(null);
          }}
          data-testid="chip-semua"
          aria-pressed={selectedKategori === null && selectedTag === null ? "true" : "false"}
          className={[
            "badge min-h-[48px] px-4 rounded-full border text-[16px] font-medium transition-colors",
            selectedKategori === null && selectedTag === null
              ? "bg-[#0F7A4A] text-white border-[#0F7A4A]"
              : "bg-base-100 text-neutral border-base-300 hover:bg-base-200",
          ].join(" ")}
        >
          Semua
        </button>
        {dedupedKategoris.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => {
              setSelectedKategori((prev) => (prev === k.id ? null : k.id));
              setSelectedTag(null);
            }}
            data-testid={`chip-kategori-${k.id}`}
            aria-pressed={selectedKategori === k.id ? "true" : "false"}
            aria-label={`Filter ${k.nama}`}
            className={[
              "badge min-h-[48px] px-4 rounded-full border text-[16px] font-medium transition-colors",
              selectedKategori === k.id
                ? "bg-[#0F7A4A] text-white border-[#0F7A4A]"
                : "bg-base-100 text-neutral border-base-300 hover:bg-base-200",
            ].join(" ")}
          >
            {k.nama}
          </button>
        ))}
        {tags.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSelectedTag((prev) => (prev === t.id ? null : t.id));
              setSelectedKategori(null);
            }}
            data-testid={`chip-tag-${t.id}`}
            aria-pressed={selectedTag === t.id ? "true" : "false"}
            aria-label={`Filter tag ${t.nama}`}
            className={[
              "badge min-h-[48px] px-4 rounded-full border text-[16px] font-medium transition-colors",
              selectedTag === t.id
                ? "bg-[#0F7A4A] text-white border-[#0F7A4A]"
                : "bg-[#FFF8E1] text-[#8D6E63] border-[#FFE082]/60 hover:bg-[#FFF3C4]",
            ].join(" ")}
          >
            #{t.nama}
          </button>
        ))}
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
        <ul className="space-y-3" aria-label="Daftar SKU" data-testid="katalog-list">
          {filtered.map((sku) => {
            const isKritis = isKritisForSku(sku);
            const kritisDays = kritisDaysForSku(sku);
            const batches = batchesBySku[sku.id] ?? [];
            const tagsForSku = skuTagsMap[sku.id] ?? [];
            const isExpanded = expandedSku === sku.id;
            const kategori = dedupedKategoris.find((k) => k.id === sku.kategori_id);
            return (
              <li
                key={sku.id}
                data-testid={`sku-card-${sku.id}`}
                className="card bg-base-100 rounded-2xl shadow-sm border border-base-300/50 p-4 hover:shadow-md transition-shadow"
              >
                <button
                  type="button"
                  onClick={() => setExpandedSku((prev) => (prev === sku.id ? null : sku.id))}
                  data-testid={`sku-expand-${sku.id}`}
                  aria-expanded={isExpanded}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#0F7A4A]/10 text-[#0F7A4A] flex items-center justify-center shrink-0">
                          <Package width={16} height={16} />
                        </div>
                        <p className="font-semibold text-neutral text-[16px] truncate">{sku.nama}</p>
                      </div>
                      <p className="text-sm text-[#595959] mt-2 ml-1">
                        {sku.kode ?? "-"} {sku.barcode ? `• ${sku.barcode}` : ""} • {kategori?.nama ?? "-"}
                      </p>
                      {tagsForSku.length > 0 && (
                        <p className="text-xs text-[#595959] mt-1 ml-1" data-testid={`sku-tags-${sku.id}`}>
                          {tagsForSku.map((t) => `#${t.nama}`).join(" ")}
                        </p>
                      )}
                      <p className="text-sm text-neutral mt-1.5 ml-1">
                        HPP Rp{sku.hpp.toLocaleString("id-ID")} • Harga Rp{sku.harga_normal.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {isKritis ? (
                        <span
                          data-testid={`badge-kritis-${sku.id}`}
                          aria-label="Kritis - stok mepet kadaluarsa"
                          className="badge gap-1 border-none font-bold rounded-full text-white"
                          style={{ backgroundColor: "#C62828", fontSize: 12, padding: "2px 10px", height: 24 }}
                        >
                          <WarningCircle width={12} height={12} aria-hidden style={{ flexShrink: 0 }} />
                          Kritis
                        </span>
                      ) : null}
                      <span className="text-xs text-[#595959] bg-base-200 rounded-full px-2.5 py-1 border border-base-300/50">
                        {batches.length} batch
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 border-t border-base-200 pt-3" data-testid={`batch-rows-${sku.id}`}>
                    {batches.length === 0 ? (
                      <p className="text-sm text-[#595959]">Belum ada batch untuk SKU ini.</p>
                    ) : (
                      <ul className="space-y-2" aria-label="Daftar batch">
                        {batches.map((b) => {
                          const days = b.expiry_date !== null ? daysToExpiry(b.expiry_date) : null;
                          const maxThreshold = getMaxThreshold(kategori);
                          const batchKritis = b.expiry_date !== null && days !== null && days <= maxThreshold;
                          return (
                            <li
                              key={b.id}
                              data-testid={`batch-row-${b.id}`}
                              className={[
                                "flex justify-between items-center text-sm rounded-xl px-3 py-2.5 border gap-2",
                                batchKritis ? "bg-[#FFEBEE] border-[#FFCDD2]" : "bg-base-200/60 border-base-300/50",
                              ].join(" ")}
                            >
                              <span className="text-sm">
                                {b.qty} pcs • exp {b.expiry_date ?? "Tanpa kadaluarsa"} {days !== null ? `(H-${days})` : ""} • Rp{b.hpp_snapshot.toLocaleString("id-ID")}
                              </span>
                              {batchKritis && (
                                <span className="badge badge-sm font-bold rounded-full text-white border-none" style={{ backgroundColor: "#C62828" }}>
                                  Kritis
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
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
