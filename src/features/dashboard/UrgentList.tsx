import { useMemo, useReducer, useState, useEffect } from "react";
import { WarningCircle } from "iconoir-react";
import Badge from "../../components/Badge";
import { FakeRepository, type UrgentBatch } from "../../lib/fakeRepository";

type FilterState = string[];
type FilterAction = { type: "TOGGLE"; payload: string };

const ALL_CATEGORIES = ["Semua", "Dairy", "Snack", "Beras"] as const;

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  const payload = action.payload;
  if (payload === "Semua") {
    return ["Semua"];
  }
  // toggle kategori: deselect Semua, add/remove payload
  const withoutSemua = state.filter((s) => s !== "Semua");
  let next: string[];
  if (withoutSemua.includes(payload)) {
    next = withoutSemua.filter((s) => s !== payload);
  } else {
    next = [...withoutSemua, payload];
  }
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

  // Determine today once
  const today = useMemo(() => new Date(), []);

  // Seed repository based on mode or window injection
  const [urgentBatches, setUrgentBatches] = useState<UrgentBatch[]>(() => {
    if (batchesOverride) return batchesOverride;
    // Check window injection for e2e seeding
    const win = typeof window !== "undefined" ? (window as unknown as { __FAKE_SEED_MODE?: string; __FAKE_MANY?: number }) : null;
    const mode = win?.__FAKE_SEED_MODE ?? seedMode;
    if (mode === "many") {
      repo.seedManyUrgent(win?.__FAKE_MANY ?? 60, today);
    } else if (mode === "empty") {
      repo.clear();
    } else if (mode === "expiryNull") {
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
      // If URL param prototype=many, seed many
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("prototype") === "many") {
          repo.seedManyUrgent(60, today);
        }
        if (params.get("empty") === "1") {
          repo.clear();
        }
        if (params.get("seed") === "many") {
          repo.clear();
          repo.seedManyUrgent(60, today);
        }
        if (params.get("seed") === "expiryNull") {
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
        }
        if (params.get("seed") === "empty") {
          repo.clear();
        }
      }
    }
    return repo.getUrgentBatches(today, "expiry");
  });

  // Recompute when sortBy changes
  useEffect(() => {
    if (batchesOverride) {
      // sort override batches
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

  // Also handle window seed mode change after mount
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

  // badge count per SKU
  const badgePerSku = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of filtered) {
      m.set(b.sku_name ?? b.sku_id, (m.get(b.sku_name ?? b.sku_id) ?? 0) + b.qty);
    }
    return m;
  }, [filtered]);

  const handleChip = (cat: string) => {
    dispatch({ type: "TOGGLE", payload: cat });
    // reset pagination on filter change
    setVisibleCount(50);
  };

  const showExpiryNullSkipped = urgentBatches.length === 0 && seedMode === "expiryNull";

  return (
    <section className="w-full max-w-[480px] mx-auto px-4" aria-labelledby="urgent-heading">
      <h2 id="urgent-heading" className="text-[20px] font-bold text-[#1A1A1A] mb-3" style={{ fontSize: "20px" }}>
        Stok Mepet
      </h2>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter kategori">
        {ALL_CATEGORIES.map((cat) => {
          const isPressed = selected.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={isPressed}
              aria-label={`Filter ${cat}`}
              onClick={() => handleChip(cat)}
              className={`btn btn-sm min-h-[48px] text-base font-semibold rounded-full px-5 ${
                isPressed ? "btn-primary" : "btn-outline border-[#D9D9D9] text-[#1A1A1A]"
              }`}
              style={{ fontSize: "16px", minHeight: "48px" }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Sort toggle */}
      <div className="flex items-center justify-between mb-3">
        <div aria-live="polite" aria-atomic="true" className="text-sm text-[#595959]">
          <span role="status" aria-live="polite">
            {totalCount} stok mepet
          </span>
          {badgePerSku.size > 0 && (
            <span className="ml-2 text-xs">• {Array.from(badgePerSku.entries()).map(([k, v]) => `${k}: ${v} pcs`).join(", ")}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSortBy((s) => (s === "expiry" ? "urgency" : "expiry"))}
          className="btn btn-ghost btn-sm min-h-[48px] text-base"
          style={{ fontSize: "16px", minHeight: "48px" }}
          aria-label={`Urut ${sortBy === "expiry" ? "expiry terdekat" : "urgencyScore"}`}
        >
          Urut: {sortBy === "expiry" ? "Expiry terdekat" : "Urgency"}
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center"
        >
          <p className="text-base text-[#1A1A1A] leading-relaxed" style={{ fontSize: "16px" }}>
            Stok aman, tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.
          </p>
          {showExpiryNullSkipped && (
            <p className="text-sm text-[#595959] mt-2">Batch tanpa tanggal kadaluarsa tidak masuk daftar.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Daftar stok mepet">
          {visible.map((b) => (
            <li
              key={b.id}
              className="bg-white border border-[#D9D9D9] rounded-[12px] p-4"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <WarningCircle width={16} height={16} aria-hidden="true" className="text-[#1A1A1A] shrink-0" />
                    <span className="font-semibold text-[#1A1A1A] truncate" style={{ fontSize: "16px" }}>
                      {b.sku_name}
                    </span>
                  </div>
                  <p className="text-sm text-[#595959]" style={{ fontSize: "16px" }}>
                    {b.qty} pcs • exp {b.expiry_date}
                  </p>
                  <p className="text-xs text-[#595959] mt-1">Urgency: {b.urgencyScore.toFixed(1)} • {b.kategori_name}</p>
                </div>
                <Badge daysToExpiry={b.daysToExpiry} qty={b.qty} expiryDate={b.expiry_date as string} showIcon />
              </div>
              <button
                type="button"
                className="btn btn-primary w-full min-h-[48px] mt-3 text-base font-semibold"
                style={{ fontSize: "16px", minHeight: "48px" }}
                aria-label={`Lihat saran tebus untuk ${b.sku_name}`}
              >
                Lihat Saran Tebus
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount(filtered.length)}
          className="btn btn-primary w-full min-h-[48px] mt-4 text-base font-semibold"
          style={{ fontSize: "16px", minHeight: "48px" }}
        >
          Lihat semua ({filtered.length - visibleCount} lagi)
        </button>
      )}

      {/* Toast/banner */}
      <div role="status" aria-live="polite" className="sr-only">
        {totalCount} item mepet kadaluarsa
      </div>
    </section>
  );
}

export default UrgentList;
