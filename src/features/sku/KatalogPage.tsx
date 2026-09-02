import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/db";
import { listKategoris } from "./skuService";
import { listBatchesBySKU } from "../batch/batchService";
import { daysToExpiry } from "../../engine/expiry";
import { BatchRows } from "../batch/BatchRows";
import type { Batch, Kategori, SKU } from "../../db/db";

type KatalogItem = {
  sku: SKU;
  kategoriNama: string;
  batches: Batch[];
  totalQty: number;
  kritisCount: number;
};

const CHIPS: Array<{ label: string; value: string }> = [
  { label: "Semua", value: "Semua" },
  { label: "Dairy", value: "Dairy" },
  { label: "Snack", value: "Snack" },
  { label: "Beras", value: "Beras" },
];

function kategoriIcon(nama: string): string {
  const n = nama.toLowerCase();
  if (n.includes("dairy") || n.includes("susu")) return "local_drink";
  if (n.includes("snack") || n.includes("roti") || n.includes("cookie")) return "cookie";
  if (n.includes("beras") || n.includes("grain") || n.includes("rice")) return "rice_bowl";
  return "inventory_2";
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function SkuCard({ item }: { item: KatalogItem }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((v) => !v);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  const skuCode = item.sku.barcode || `SKU-${String(item.sku.id).padStart(4, "0")}`;

  return (
    <div className="bg-surface-container-lowest border border-border rounded-xl shadow-[0px_2px_4px_rgba(30,41,59,0.05)] overflow-hidden">
      {/* Header summary */}
      <div
        className="p-4 flex items-start justify-between border-b border-border cursor-pointer hover:bg-surface-container-low transition-colors"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Buka detail SKU ${item.sku.nama}`}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0 border border-slate-gray/10">
            <span className="material-symbols-outlined text-primary" aria-hidden="true">
              {kategoriIcon(item.kategoriNama)}
            </span>
          </div>
          <div>
            <h3 className="font-headline-md text-headline-md text-primary">{item.sku.nama}</h3>
            <p className="font-body-md text-body-md text-slate-gray mt-1">
              SKU: {skuCode} • {item.kategoriNama}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="px-2 py-1 bg-surface-container text-slate-gray font-label-caps text-label-caps rounded">
                Total: {item.totalQty} pcs
              </span>
              {item.kritisCount > 0 ? (
                <span className="px-2 py-1 bg-danger text-white font-label-caps text-label-caps rounded flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    warning
                  </span>
                  {item.kritisCount} Batch Kritis
                </span>
              ) : (
                <span className="px-2 py-1 bg-safe text-black font-label-caps text-label-caps rounded border border-safe/30">
                  Aman
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Buka tutup detail batch"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full hover:bg-surface-container transition-colors shrink-0"
        >
          <span
            className={`material-symbols-outlined text-slate-gray transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>
      </div>

      {/* Batch detail expanded via React state */}
      {expanded && (
        <div className="bg-surface-bright p-4 flex flex-col gap-3">
          <BatchRows batches={item.batches} />
        </div>
      )}
    </div>
  );
}

export function KatalogPage() {
  const [kategoris, setKategoris] = useState<Kategori[]>([]);
  const [items, setItems] = useState<KatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeChip, setActiveChip] = useState("Semua");

  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const kats = await listKategoris();
        // Fallback: jika kategori belum ada (belum seed), coba langsung baca skus
        const katMap = new Map<number, string>();
        kats.forEach((k) => {
          if (k.id !== undefined) katMap.set(k.id, k.nama);
        });

        // Load semua SKU via db langsung (karena skuService hanya list per kategori)
        const allSkus: SKU[] = await db.skus.toArray();

        // Build katalog items
        const enriched: KatalogItem[] = await Promise.all(
          allSkus.map(async (sku) => {
            const batches = sku.id ? await listBatchesBySKU(sku.id) : [];
            const totalQty = batches.reduce((s, b) => s + b.qty, 0);
            const kritisCount = batches.filter((b) => {
              const d = daysToExpiry(b.expiry_date);
              return d !== null && d <= 3;
            }).length;
            const kategoriNama = sku.kategori_id ? katMap.get(sku.kategori_id) ?? "Tanpa Kategori" : "Tanpa Kategori";
            return { sku, kategoriNama, batches, totalQty, kritisCount };
          })
        );

        if (!cancelled) {
          setKategoris(kats);
          setItems(enriched);
        }
      } catch {
        // Dexie kosong / fake-indexeddb not injected di prod — biarkan empty
        if (!cancelled) {
          setKategoris([]);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return items.filter((it) => {
      // chip filter
      if (activeChip !== "Semua" && it.kategoriNama !== activeChip) return false;
      if (!q) return true;
      const skuName = it.sku.nama.toLowerCase();
      const skuCode = (it.sku.barcode || `sku-${it.sku.id}`).toLowerCase();
      const kat = it.kategoriNama.toLowerCase();
      const batchMatch = it.batches.some((b) => String(b.id).includes(q) || (b.expiry_date ?? "").toLowerCase().includes(q));
      return skuName.includes(q) || skuCode.includes(q) || kat.includes(q) || batchMatch;
    });
  }, [items, debouncedSearch, activeChip]);

  // Sidebar distribusi risiko dari semua batches
  const distribusi = useMemo(() => {
    const allBatches = items.flatMap((i) => i.batches);
    const total = allBatches.length;
    if (total === 0) return { danger: 15, caution: 25, safe: 60, totalBatches: 0, totalSku: items.length };
    let danger = 0;
    let caution = 0;
    let safe = 0;
    for (const b of allBatches) {
      const d = daysToExpiry(b.expiry_date);
      if (d === null) {
        safe += 1;
      } else if (d <= 1) {
        danger += 1;
      } else if (d <= 3) {
        danger += 1; // warning masuk danger bucket untuk histogram
      } else if (d <= 7) {
        caution += 1;
      } else {
        safe += 1;
      }
    }
    // distribusi sesuai html: danger, caution, safe
    // bulatkan percent, jaga total 100
    const pDanger = Math.round((danger / total) * 100);
    const pCaution = Math.round((caution / total) * 100);
    const pSafe = 100 - pDanger - pCaution;
    return { danger: pDanger, caution: pCaution, safe: pSafe, totalBatches: total, totalSku: items.length };
  }, [items]);

  return (
    <div className="w-full">
      {/* Mobile header sticky: h1 + search + chips */}
      <div className="md:hidden sticky top-0 z-10 bg-surface-muted pt-4 px-margin-mobile pb-2 -mx-margin-mobile">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tight mb-4">Katalog SKU</h1>
        <div className="relative w-full mb-4">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-gray" aria-hidden="true">
            search
          </span>
          <input
            aria-label="Cari SKU atau Batch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU atau Batch..."
            type="text"
            className="w-full bg-surface-container-lowest border border-slate-gray/30 rounded-xl py-3 pl-10 pr-4 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[48px]"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 -mx-margin-mobile px-margin-mobile" role="group" aria-label="Filter kategori">
          {CHIPS.map((chip) => {
            const active = activeChip === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveChip(chip.value)}
                className={`whitespace-nowrap min-h-[48px] px-4 py-2 rounded-full font-body-md text-body-md border transition-colors flex-shrink-0 ${
                  active
                    ? "bg-primary text-white border-primary"
                    : "bg-surface-container-lowest text-text-primary border-border hover:bg-surface-container-low hover:text-primary"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop search + chips inline — hidden di mobile karena sudah di sticky */}
      <div className="hidden md:flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Katalog SKU</h1>
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-gray" aria-hidden="true">
              search
            </span>
            <input
              aria-label="Cari SKU atau Batch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari SKU atau Batch..."
              type="text"
              className="w-full bg-surface-container-lowest border border-slate-gray/30 rounded-xl py-3 pl-10 pr-4 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[48px]"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar" role="group" aria-label="Filter kategori">
            {CHIPS.map((chip) => {
              const active = activeChip === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveChip(chip.value)}
                  className={`whitespace-nowrap min-h-[48px] px-4 py-2 rounded-full font-body-md text-body-md border transition-colors flex-shrink-0 ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-surface-container-lowest text-text-primary border-border hover:bg-surface-container-low hover:text-primary"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid layout: list 8 col + sidebar 4 col */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-4 md:grid-cols-12 gap-gutter-mobile md:gap-lg">
        {/* SKU List Column */}
        <div className="col-span-4 md:col-span-8 flex flex-col gap-4">
          {loading ? (
            <p className="font-body-md text-body-md text-slate-gray py-8 text-center" role="status">
              Memuat katalog...
            </p>
          ) : filtered.length === 0 ? (
            items.length === 0 ? (
              <div
                className="bg-surface-container-lowest border border-border rounded-xl p-6 text-center flex flex-col items-center gap-3"
                role="status"
                aria-live="polite"
                data-testid="empty-sku-kosong"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <span className="material-symbols-outlined text-[#595959]" style={{ fontSize: 48 }} aria-hidden="true">
                  inventory_2
                </span>
                <p className="font-body-md text-body-md text-text-primary leading-relaxed" style={{ fontSize: "16px", color: "#1A1A1A" }}>
                  Belum ada SKU. Tambah jenis barang dulu, contoh Susu UHT 1L.
                </p>
                <button
                  type="button"
                  aria-label="Tambah SKU baru"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("katalog:tambah-sku"));
                  }}
                  className="mt-1 min-h-[48px] w-full px-6 py-3 bg-primary text-white font-body-md text-body-md rounded-xl hover:bg-primary-pressed active:bg-primary-pressed transition-colors font-semibold"
                  style={{ minHeight: "48px", fontSize: "16px" }}
                >
                  Tambah SKU
                </button>
              </div>
            ) : (
              <div
                className="bg-surface-container-lowest border border-border rounded-xl p-6 text-center flex flex-col items-center gap-3"
                role="status"
                aria-live="polite"
                data-testid="empty-filter-sku"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <span className="material-symbols-outlined text-[#595959]" style={{ fontSize: 48 }} aria-hidden="true">
                  search_off
                </span>
                <p className="font-body-md text-body-md text-text-primary" style={{ fontSize: "16px", color: "#1A1A1A" }}>
                  Tidak ada hasil untuk &quot;{debouncedSearch}&quot;{activeChip !== "Semua" ? ` di ${activeChip}` : ""}.
                </p>
                <button
                  type="button"
                  aria-label="Hapus filter pencarian"
                  onClick={() => {
                    setSearch("");
                    setActiveChip("Semua");
                  }}
                  className="mt-1 min-h-[48px] w-full px-6 py-3 bg-white border border-border text-text-primary font-body-md text-body-md rounded-xl hover:bg-surface-container-low transition-colors font-semibold"
                  style={{ minHeight: "48px", fontSize: "16px" }}
                >
                  Hapus Filter
                </button>
              </div>
            )
          ) : (
            filtered.map((it) => <SkuCard key={it.sku.id} item={it} />)
          )}
        </div>

        {/* Sidebar Ringkasan */}
        <div className="col-span-4 md:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest/80 backdrop-blur-md border border-border rounded-xl p-6 shadow-[0px_2px_4px_rgba(30,41,59,0.05)] md:sticky md:top-24">
            <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-gray" aria-hidden="true">
                analytics
              </span>
              Ringkasan Katalog
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between font-body-md text-body-md mb-1">
                  <span className="text-slate-gray">Total SKU</span>
                  <span className="font-data-mono text-data-mono text-primary">{distribusi.totalSku}</span>
                </div>
                {kategoris.length > 0 && (
                  <p className="font-body-md text-body-md text-slate-gray text-[14px]">{kategoris.length} kategori • {distribusi.totalBatches} batch</p>
                )}
              </div>
              <div className="pt-4 border-t border-border">
                <p className="font-label-caps text-label-caps text-slate-gray mb-2">DISTRIBUSI RISIKO</p>
                <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-2">
                  <div className="bg-danger" style={{ width: `${distribusi.danger}%` }} />
                  <div className="bg-caution" style={{ width: `${distribusi.caution}%` }} />
                  <div className="bg-safe" style={{ width: `${distribusi.safe}%` }} />
                </div>
                <ul className="font-body-md text-body-md space-y-2">
                  <li className="flex justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-danger" />
                      Kritis
                    </span>
                    <span>{distribusi.danger}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-caution" />
                      Peringatan
                    </span>
                    <span>{distribusi.caution}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-safe" />
                      Aman
                    </span>
                    <span>{distribusi.safe}%</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KatalogPage;
