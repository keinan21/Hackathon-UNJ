import { useEffect, useState, useCallback } from "react";
import { realRepo, dexieV2 } from "../../db/dexieRepository";
import type { SKU, Kategori, Batch, Tag } from "../../db/types";
import { daysToExpiry } from "../../engine/expiry";

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
      } catch {
        // tag table may not exist yet
      }
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
    // Kategori chip filter
    if (selectedKategori !== null && sku.kategori_id !== selectedKategori) return false;
    // Tag chip filter
    if (selectedTag !== null) {
      const tagsForSku = skuTagsMap[sku.id] ?? [];
      if (!tagsForSku.some((t) => t.id === selectedTag)) return false;
    }
    // Search debounce filter
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

  if (loading) {
    return (
      <div data-testid="katalog-page" className="w-full max-w-[480px] mx-auto px-4">
        <p className="text-base text-[#595959]" style={{ fontSize: "16px" }} role="status">
          Memuat katalog...
        </p>
      </div>
    );
  }

  const showEmptyAll = skus.length === 0;
  const showEmptySearch = skus.length > 0 && filtered.length === 0;

  return (
    <div data-testid="katalog-page" className="w-full max-w-[480px] mx-auto px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-bold text-[#1A1A1A]" style={{ fontSize: "20px" }}>
          Katalog SKU
        </h2>
        <button
          type="button"
          onClick={handleTambahSku}
          data-testid="btn-tambah-sku"
          className="btn btn-primary rounded-[12px] px-4 font-semibold"
          style={{ minHeight: "48px", fontSize: "16px", backgroundColor: "#0F7A4A", color: "#FFFFFF", border: "none" }}
        >
          Tambah SKU
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          type="search"
          placeholder="Cari nama, kode, barcode, tag..."
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          data-testid="katalog-search"
          aria-label="Cari SKU"
          className="w-full border border-[#D9D9D9] rounded-[12px] px-3"
          style={{ minHeight: "48px", fontSize: "16px" }}
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
          className="rounded-full px-3 border"
          style={{
            minHeight: "48px",
            fontSize: "16px",
            backgroundColor: selectedKategori === null && selectedTag === null ? "#0F7A4A" : "#FFFFFF",
            color: selectedKategori === null && selectedTag === null ? "#FFFFFF" : "#1A1A1A",
            borderColor: "#D9D9D9",
          }}
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
            className="rounded-full px-3 border"
            style={{
              minHeight: "48px",
              fontSize: "16px",
              backgroundColor: selectedKategori === k.id ? "#0F7A4A" : "#FFFFFF",
              color: selectedKategori === k.id ? "#FFFFFF" : "#1A1A1A",
              borderColor: "#D9D9D9",
            }}
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
            className="rounded-full px-3 border"
            style={{
              minHeight: "48px",
              fontSize: "16px",
              backgroundColor: selectedTag === t.id ? "#0F7A4A" : "#FFFFFF",
              color: selectedTag === t.id ? "#FFFFFF" : "#1A1A1A",
              borderColor: "#D9D9D9",
            }}
          >
            #{t.nama}
          </button>
        ))}
      </div>

      {/* List */}
      {showEmptyAll ? (
        <div
          data-testid="katalog-empty"
          className="bg-white border border-[#D9D9D9] rounded-[12px] p-6 text-center"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          role="status"
          aria-live="polite"
        >
          <p className="text-base text-[#595959] mb-4" style={{ fontSize: "16px" }}>
            Belum ada SKU → Tambah SKU
          </p>
          <button
            type="button"
            onClick={handleTambahSku}
            data-testid="btn-empty-tambah-sku"
            className="btn btn-primary rounded-[12px] px-4 font-semibold"
            style={{ minHeight: "48px", fontSize: "16px", backgroundColor: "#0F7A4A", color: "#FFFFFF", border: "none" }}
          >
            Tambah SKU
          </button>
        </div>
      ) : showEmptySearch ? (
        <div
          data-testid="katalog-empty-search"
          className="bg-white border border-[#D9D9D9] rounded-[12px] p-6 text-center"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          role="status"
          aria-live="polite"
        >
          <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>
            Tidak ada hasil untuk &quot;{debouncedSearch.trim()}&quot;
          </p>
          <p className="text-[14px] text-[#595959] mt-2" style={{ fontSize: "14px" }}>
            Coba kata kunci lain atau tambah SKU baru.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Daftar SKU" data-testid="katalog-list">
          {filtered.map((sku) => {
            const isKritis = isKritisForSku(sku);
            const batches = batchesBySku[sku.id] ?? [];
            const tagsForSku = skuTagsMap[sku.id] ?? [];
            const isExpanded = expandedSku === sku.id;
            const kategori = dedupedKategoris.find((k) => k.id === sku.kategori_id);
            return (
              <li
                key={sku.id}
                data-testid={`sku-card-${sku.id}`}
                className="bg-white border border-[#D9D9D9] rounded-[12px] p-4"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedSku((prev) => (prev === sku.id ? null : sku.id))}
                  data-testid={`sku-expand-${sku.id}`}
                  aria-expanded={isExpanded}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-[#1A1A1A]" style={{ fontSize: "16px" }}>
                        {sku.nama}
                      </p>
                      <p className="text-[14px] text-[#595959]" style={{ fontSize: "14px" }}>
                        {sku.kode ?? "-"} {sku.barcode ? `• ${sku.barcode}` : ""} • {kategori?.nama ?? "-"}
                      </p>
                      {tagsForSku.length > 0 && (
                        <p className="text-[12px] text-[#595959] mt-1" style={{ fontSize: "12px" }} data-testid={`sku-tags-${sku.id}`}>
                          {tagsForSku.map((t) => `#${t.nama}`).join(" ")}
                        </p>
                      )}
                      <p className="text-[14px] text-[#1A1A1A] mt-1" style={{ fontSize: "14px" }}>
                        HPP Rp{sku.hpp.toLocaleString("id-ID")} • Harga Rp{sku.harga_normal.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isKritis && (
                        <span
                          data-testid={`badge-kritis-${sku.id}`}
                          aria-label="Kritis - stok mepet kadaluarsa"
                          className="rounded-full px-2 py-1 text-[12px] font-semibold inline-flex items-center gap-1"
                          style={{ backgroundColor: "#C62828", color: "#FFFFFF", fontSize: "12px" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Kritis
                        </span>
                      )}
                      <span className="text-[12px] text-[#595959]" style={{ fontSize: "12px" }}>
                        {batches.length} batch
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 border-t border-[#D9D9D9] pt-3" data-testid={`batch-rows-${sku.id}`}>
                    {batches.length === 0 ? (
                      <p className="text-[14px] text-[#595959]" style={{ fontSize: "14px" }}>
                        Belum ada batch untuk SKU ini.
                      </p>
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
                              className="flex justify-between items-center text-[14px] border border-[#F0F0F0] rounded-[8px] px-3 py-2"
                              style={{ fontSize: "14px", backgroundColor: batchKritis ? "#FFEBEE" : "#FFFFFF" }}
                            >
                              <span>
                                {b.qty} pcs • exp {b.expiry_date ?? "Tanpa kadaluarsa"} {days !== null ? `(H-${days})` : ""} • Rp{b.hpp_snapshot.toLocaleString("id-ID")}
                              </span>
                              {batchKritis && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                  style={{ backgroundColor: "#C62828", color: "#FFFFFF", fontSize: "10px" }}
                                >
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
