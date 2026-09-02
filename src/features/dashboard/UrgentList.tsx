import { useMemo, useReducer, useState, useEffect } from "react";
import BatchCard, { type BatchCardVariant } from "../../components/BatchCard";
import { FakeRepository, type UrgentBatch } from "../../lib/fakeRepository";

function variantFromDays(days: number | null): BatchCardVariant {
  if (days === null) return "safe";
  if (days <= 1) return "danger";
  if (days <= 3) return "warning";
  if (days <= 7) return "caution";
  return "safe";
}

type FilterState = string[];
type FilterAction = { type: "TOGGLE"; payload: string };

const ALL_CATEGORIES = ["Semua", "Dairy", "Snack", "Beras"] as const;

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  const payload = action.payload;
  if (payload === "Semua") return ["Semua"];
  const withoutSemua = state.filter((s) => s !== "Semua");
  let next: string[];
  if (withoutSemua.includes(payload)) next = withoutSemua.filter((s) => s !== payload);
  else next = [...withoutSemua, payload];
  if (next.length === 0) return ["Semua"];
  return next;
}

export type UrgentListProps = {
  initialFilter?: FilterState;
  seedMode?: "demo" | "many" | "empty" | "expiryNull";
  batchesOverride?: UrgentBatch[];
};

export function UrgentList({ initialFilter, seedMode = "demo", batchesOverride }: UrgentListProps) {
  const [selected, dispatch] = useReducer(filterReducer, initialFilter ?? ["Semua"]);
  const [sortBy, setSortBy] = useState<"expiry" | "urgency">("expiry");
  const [visibleCount, setVisibleCount] = useState(50);
  const [repo] = useState(() => new FakeRepository());
  const today = useMemo(() => new Date(), []);
  const [urgentBatches, setUrgentBatches] = useState<UrgentBatch[]>(() => {
    if (batchesOverride) return batchesOverride;
    const win = typeof window !== "undefined" ? (window as unknown as { __FAKE_SEED_MODE?: string; __FAKE_MANY?: number }) : null;
    const mode = win?.__FAKE_SEED_MODE ?? seedMode;
    if (mode === "many") repo.seedManyUrgent(win?.__FAKE_MANY ?? 60, today);
    else if (mode === "empty") repo.clear();
    else if (mode === "expiryNull") {
      repo.clear();
      repo.batches = [
        {
          id: "b-null",
          sku_id: "sku-susu",
          sku_name: "Susu UHT 1L",
          kategori_id: "k-dairy",
          kategori_name: "Dairy",
          qty: 10,
          expiry_date: null,
          received_at: new Date().toISOString(),
          hpp_snapshot: 10000,
          org_id: "toko-01",
          avg_daily_usage: 2,
        },
      ];
    } else {
      repo.seedUrgentDemo(today);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("prototype") === "many") repo.seedManyUrgent(60, today);
        if (params.get("empty") === "1") repo.clear();
        if (params.get("seed") === "many") { repo.clear(); repo.seedManyUrgent(60, today); }
        if (params.get("seed") === "expiryNull") {
          repo.clear();
          repo.batches = [{ id: "b-null", sku_id: "sku-susu", sku_name: "Susu UHT 1L", kategori_id: "k-dairy", kategori_name: "Dairy", qty: 10, expiry_date: null, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01", avg_daily_usage: 2 }];
        }
        if (params.get("seed") === "empty") repo.clear();
      }
    }
    return repo.getUrgentBatches(today, "expiry");
  });

  useEffect(() => {
    if (batchesOverride) {
      const sorted = [...batchesOverride].sort((a, b) => {
        if (sortBy === "urgency") return a.urgencyScore - b.urgencyScore;
        if (a.daysToExpiry !== b.daysToExpiry) return a.daysToExpiry - b.daysToExpiry;
        return a.urgencyScore - b.urgencyScore;
      });
      setUrgentBatches(sorted);
      return;
    }
    setUrgentBatches(repo.getUrgentBatches(today, sortBy));
  }, [sortBy, repo, today, batchesOverride]);

  useEffect(() => {
    const handler = () => {
      const win = window as unknown as { __FAKE_SEED_MODE?: string };
      if (win.__FAKE_SEED_MODE === "many") repo.seedManyUrgent(60, today);
      else if (win.__FAKE_SEED_MODE === "demo") repo.seedUrgentDemo(today);
      setUrgentBatches(repo.getUrgentBatches(today, sortBy));
    };
    window.addEventListener("__reseed", handler as EventListener);
    return () => window.removeEventListener("__reseed", handler as EventListener);
  }, [repo, today, sortBy]);

  const filtered = useMemo(() => {
    if (selected.includes("Semua")) return urgentBatches;
    return urgentBatches.filter((b) => selected.includes(b.kategori_name ?? ""));
  }, [urgentBatches, selected]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;
  const totalCount = filtered.length;

  const handleChip = (cat: string) => {
    dispatch({ type: "TOGGLE", payload: cat });
    setVisibleCount(50);
  };

  const showExpiryNullSkipped = urgentBatches.length === 0 && seedMode === "expiryNull";

  return (
    <section className="w-full flex flex-col gap-md" aria-labelledby="urgent-heading">
      <h2 id="urgent-heading" className="font-headline-md text-headline-md text-primary">
        Stok Mepet
      </h2>

      {/* Filter chips — token persis dashboard */}
      <div className="flex flex-wrap gap-sm" role="group" aria-label="Filter kategori">
        {ALL_CATEGORIES.map((cat) => {
          const isPressed = selected.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={isPressed}
              aria-label={`Filter ${cat}`}
              onClick={() => handleChip(cat)}
              className={`min-h-[48px] px-4 py-2 rounded-full font-body-md text-body-md transition-colors ${
                isPressed
                  ? "bg-primary text-on-primary hover:bg-primary-pressed"
                  : "bg-surface-container-lowest border border-border-subtle text-text-primary hover:bg-surface-container-low"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Sort + count — minimal */}
      <div className="flex items-center justify-between">
        <span role="status" aria-live="polite" className="font-body-md text-body-md text-slate-gray text-sm">
          {totalCount} stok mepet
        </span>
        <button
          type="button"
          onClick={() => setSortBy((s) => (s === "expiry" ? "urgency" : "expiry"))}
          className="min-h-[48px] px-3 font-body-md text-body-md text-primary hover:underline"
          aria-label={`Urut ${sortBy === "expiry" ? "expiry terdekat" : "urgencyScore"}`}
        >
          Urut: {sortBy === "expiry" ? "Expiry terdekat" : "Urgency"}
        </button>
      </div>

      {filtered.length === 0 ? (
        urgentBatches.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md shadow-sm flex flex-col items-center gap-3 text-center py-8"
            data-testid="empty-stok-aman"
          >
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 0", fontSize: 48 }} aria-hidden="true">
              check_circle
            </span>
            <p className="font-body-md text-body-md text-text-primary">Stok aman, tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.</p>
            {showExpiryNullSkipped && (
              <p className="font-body-md text-body-md text-slate-gray text-sm">Batch tanpa tanggal kadaluarsa tidak masuk daftar.</p>
            )}
          </div>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md shadow-sm flex flex-col items-center gap-3 text-center py-8"
            data-testid="empty-filter-kategori"
          >
            <span className="material-symbols-outlined text-slate-gray" style={{ fontVariationSettings: "'FILL' 0", fontSize: 48 }} aria-hidden="true">
              filter_alt_off
            </span>
            <p className="font-body-md text-body-md text-text-primary">Tidak ada stok mepet di kategori ini. Coba pilih Semua.</p>
            <button
              type="button"
              onClick={() => { dispatch({ type: "TOGGLE", payload: "Semua" }); setVisibleCount(50); }}
              aria-label="Tampilkan semua kategori"
              className="min-h-[48px] w-full px-6 py-3 bg-surface-container-lowest border border-border-subtle text-primary font-body-md text-body-md rounded-lg hover:bg-surface-container-low transition-colors"
            >
              Tampilkan Semua
            </button>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-sm">
          {visible.map((b) => (
            <BatchCard
              key={b.id}
              batchId={b.id}
              skuName={b.sku_name ?? b.sku_id}
              qty={b.qty}
              expiryDate={b.expiry_date}
              daysToExpiry={b.daysToExpiry}
              urgencyScore={b.urgencyScore}
              variant={variantFromDays(b.daysToExpiry)}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount(filtered.length)}
          className="min-h-[48px] w-full bg-primary text-on-primary font-body-md text-body-md py-3 px-5 rounded-lg hover:bg-primary-pressed transition-colors"
        >
          Lihat semua ({filtered.length - visibleCount} lagi)
        </button>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {totalCount} item mepet kadaluarsa
      </div>
    </section>
  );
}

export default UrgentList;
