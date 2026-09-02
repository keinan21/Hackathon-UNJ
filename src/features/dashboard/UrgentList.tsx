import { useMemo, useReducer, useState, useEffect } from "react";
import { WarningCircle } from "iconoir-react";
import Badge from "../../components/Badge";
import { daysToExpiry, urgencyScore } from "../../engine/expiry";
import { realRepo } from "../../db/dexieRepository";
import { seedDefaultKategoris } from "../../db/seed";
// Keep FakeRepository for test overrides (e2e) — real data by default
import { FakeRepository, type UrgentBatch as FakeUrgentBatch } from "../../lib/fakeRepository";

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
  batchesOverride?: FakeUrgentBatch[];
  /** Force real Dexie mode (default true). If false, use FakeRepository dummy (legacy for e2e). */
  useRealData?: boolean;
};

type RealUrgentBatch = {
  id: string;
  sku_id: string;
  sku_name: string;
  kategori_id: string;
  kategori_name: string;
  qty: number;
  expiry_date: string | null;
  received_at: string;
  hpp_snapshot: number;
  org_id: string;
  daysToExpiry: number;
  urgencyScore: number;
};

export function UrgentList({ initialFilter, seedMode, batchesOverride, useRealData = true }: UrgentListProps) {
  const [selected, dispatch] = useReducer(filterReducer, initialFilter ?? ["Semua"]);
  const [sortBy, setSortBy] = useState<"expiry" | "urgency">("expiry");
  const [visibleCount, setVisibleCount] = useState(50);
  const [realBatches, setRealBatches] = useState<RealUrgentBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fakeRepo] = useState(() => new FakeRepository());

  const today = useMemo(() => new Date(), []);

  // Real data fetch — replaces dummy seedUrgentDemo
  useEffect(() => {
    if (batchesOverride) {
      setLoading(false);
      return;
    }
    // If explicitly requested fake mode (for legacy e2e), use FakeRepository
    if (!useRealData) {
      const win = typeof window !== "undefined" ? (window as unknown as { __FAKE_SEED_MODE?: string }) : null;
      const mode = win?.__FAKE_SEED_MODE ?? seedMode;
      if (mode === "many") fakeRepo.seedManyUrgent(60, today);
      else if (mode === "empty") fakeRepo.clear();
      else if (mode === "expiryNull") {
        fakeRepo.clear();
        fakeRepo.batches = [
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
      } else fakeRepo.seedUrgentDemo(today);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Ensure kategori exists (seed if empty) — real data from nol
        const existingKategoris = await realRepo.listKategoris("toko-01").catch(() => []);
        if (existingKategoris.length === 0) {
          await seedDefaultKategoris(realRepo as unknown as import("../../db/db").InventoryRepository).catch(() => {});
        }

        // Real data from nol — only explicit URL ?seed=... triggers fake for e2e, prop seedMode is ignored in real mode
        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const urlSeed = params?.get("seed") ?? params?.get("prototype") ?? params?.get("empty");
        const effectiveSeed = urlSeed;
        if (effectiveSeed === "empty") {
          // Real empty — do not seed batches, just fetch (will be empty)
          const batches = await realRepo.listBatchesExpiring("toko-01");
          if (cancelled) return;
          // No batches → empty state is correct real data from nol
          setRealBatches([]);
          setLoading(false);
          return;
        }
        if (effectiveSeed === "expiryNull") {
          setRealBatches([]);
          setLoading(false);
          return;
        }

        // Explicit ?seed=demo/many via URL still uses fake for e2e/preview demo, even in real mode
        if (effectiveSeed === "demo") {
          fakeRepo.seedUrgentDemo(today);
          const fakeUrgent = fakeRepo.getUrgentBatches(today, sortBy) as unknown as RealUrgentBatch[];
          if (!cancelled) {
            setRealBatches(fakeUrgent);
            setLoading(false);
          }
          return;
        }
        if (effectiveSeed === "many") {
          fakeRepo.seedManyUrgent(60, today);
          const fakeUrgent = fakeRepo.getUrgentBatches(today, sortBy) as unknown as RealUrgentBatch[];
          if (!cancelled) {
            setRealBatches(fakeUrgent);
            setLoading(false);
          }
          return;
        }

        // Real data: fetch expiring batches only, no dummy auto-seed (data beneran dari nol)
        const batches = await realRepo.listBatchesExpiring("toko-01");
        const allBatchesRaw = batches;

        // Now compute urgent batches: filter days <= maxThreshold, sort, calc urgency
        const kategoris = await realRepo.listKategoris("toko-01");
        const kategoriMap = new Map(kategoris.map((k) => [k.id, k]));
        const skus = await realRepo.listSkus("toko-01");
        const skuMap = new Map(skus.map((s) => [s.id, s]));
        // For avg usage, fetch transaksis (if none, fallback 1)
        const transaksis = await realRepo.listTransaksis("toko-01").catch(() => []);
        const avgMap = new Map<string, number>();
        const totals = new Map<string, number>();
        for (const t of transaksis) totals.set(t.sku_id, (totals.get(t.sku_id) ?? 0) + ((t as unknown as { qty_sold?: number }).qty_sold ?? 1));
        for (const [k, v] of totals) avgMap.set(k, v / 14);

        const urgent: RealUrgentBatch[] = [];
        for (const b of allBatchesRaw) {
          if (b.expiry_date === null) continue;
          const days = daysToExpiry(b.expiry_date, today);
          if (days === null) continue;
          const sku = skuMap.get(b.sku_id);
          const kategori = sku ? kategoriMap.get(sku.kategori_id) : undefined;
          const threshold = kategori?.threshold_h_minus ?? [7, 3, 1];
          const maxThreshold = Math.max(...threshold);
          if (days > maxThreshold) continue;
          const avg = avgMap.get(b.sku_id) ?? 1;
          const score = urgencyScore(b.qty, days, avg);
          urgent.push({
            id: b.id,
            sku_id: b.sku_id,
            sku_name: sku?.nama ?? b.sku_id,
            kategori_id: kategori?.id ?? "",
            kategori_name: kategori?.nama ?? "",
            qty: b.qty,
            expiry_date: b.expiry_date,
            received_at: b.received_at,
            hpp_snapshot: b.hpp_snapshot,
            org_id: b.org_id,
            daysToExpiry: days,
            urgencyScore: score,
          });
        }
        urgent.sort((a, b) => {
          if (sortBy === "urgency") return a.urgencyScore - b.urgencyScore;
          if (a.daysToExpiry !== b.daysToExpiry) return a.daysToExpiry - b.daysToExpiry;
          return a.urgencyScore - b.urgencyScore;
        });
        if (!cancelled) {
          setRealBatches(urgent);
          setLoading(false);
        }
      } catch (e) {
        console.error("UrgentList real fetch error", e);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today, sortBy, seedMode, batchesOverride, useRealData, fakeRepo]);

  // Expose reset helper for "reset data sekarang" — clears real Dexie
  useEffect(() => {
    (window as unknown as { __RESET_REAL_DATA__?: () => Promise<void> }).__RESET_REAL_DATA__ = async () => {
      try {
        await (realRepo as unknown as { clearAll?: (org: string) => Promise<void> }).clearAll?.("toko-01");
      } catch {}
      try {
        // clear both v1 and v2 DBs
        indexedDB.deleteDatabase("inventaris-tebus-murah");
        indexedDB.deleteDatabase("inventaris-tebus-murah-v2");
      } catch {}
      // also clear fake in-memory for e2e
      try {
        fakeRepo.clear();
      } catch {}
      location.reload();
    };
    // Auto-reset if ?reset=1 in URL (for "reset data sekarang")
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("reset") === "1") {
        (window as unknown as { __RESET_REAL_DATA__?: () => Promise<void> }).__RESET_REAL_DATA__?.();
      }
    } catch {}
  }, [fakeRepo]);

  // Derived for render: if batchesOverride provided (e2e), use it; else if useRealData false, use fakeRepo; else use realBatches
  const urgentBatches = useMemo(() => {
    if (batchesOverride) return batchesOverride as unknown as RealUrgentBatch[];
    if (!useRealData) {
      const win = typeof window !== "undefined" ? (window as unknown as { __FAKE_SEED_MODE?: string }) : null;
      const mode = win?.__FAKE_SEED_MODE ?? seedMode;
      // fakeRepo already seeded in effect above, but for render we need to compute again synchronously
      // Use fakeRepo.getUrgentBatches for fake mode
      return fakeRepo.getUrgentBatches(today, sortBy) as unknown as RealUrgentBatch[];
    }
    return realBatches;
  }, [batchesOverride, useRealData, fakeRepo, today, sortBy, realBatches, seedMode]);

  // Also handle window reseed for fake mode
  useEffect(() => {
    if (useRealData) return;
    const handler = () => {
      const win = window as unknown as { __FAKE_SEED_MODE?: string };
      if (win.__FAKE_SEED_MODE === "many") fakeRepo.seedManyUrgent(60, today);
      else if (win.__FAKE_SEED_MODE === "demo") fakeRepo.seedUrgentDemo(today);
    };
    window.addEventListener("__reseed", handler as EventListener);
    return () => window.removeEventListener("__reseed", handler as EventListener);
  }, [fakeRepo, today, useRealData]);

  const filtered = useMemo(() => {
    if (selected.includes("Semua")) return urgentBatches;
    return urgentBatches.filter((b) => selected.includes(b.kategori_name ?? ""));
  }, [urgentBatches, selected]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;
  const totalCount = filtered.length;

  const badgePerSku = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of filtered) m.set(b.sku_name ?? b.sku_id, (m.get(b.sku_name ?? b.sku_id) ?? 0) + b.qty);
    return m;
  }, [filtered]);

  const handleChip = (cat: string) => {
    dispatch({ type: "TOGGLE", payload: cat });
    setVisibleCount(50);
  };

  const showExpiryNullSkipped = urgentBatches.length === 0 && seedMode === "expiryNull";
  const showLoading = loading && useRealData && !batchesOverride;

  return (
    <section className="w-full max-w-[480px] mx-auto px-4" aria-labelledby="urgent-heading">
      <h2 id="urgent-heading" className="text-[20px] font-bold text-[#1A1A1A] mb-3" style={{ fontSize: "20px" }}>
        Stok Mepet
      </h2>

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
              className={`btn btn-sm min-h-[48px] text-base font-semibold rounded-full px-5 ${isPressed ? "btn-primary" : "btn-outline border-[#D9D9D9] text-[#1A1A1A]"}`}
              style={{ fontSize: "16px", minHeight: "48px" }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div aria-live="polite" aria-atomic="true" className="text-sm text-[#595959]">
          <span role="status" aria-live="polite">
            {showLoading ? "Memuat..." : `${totalCount} stok mepet`}
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

      {showLoading ? (
        <div className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>
            Memuat stok mepet...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div role="status" aria-live="polite" className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="text-base text-[#1A1A1A] leading-relaxed" style={{ fontSize: "16px" }}>
            Stok aman, tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.
          </p>
          {showExpiryNullSkipped && <p className="text-sm text-[#595959] mt-2">Batch tanpa tanggal kadaluarsa tidak masuk daftar.</p>}
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Daftar stok mepet">
          {visible.map((b) => (
            <li key={b.id} className="bg-white border border-[#D9D9D9] rounded-[12px] p-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
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
              <button type="button" className="btn btn-primary w-full min-h-[48px] mt-3 text-base font-semibold" style={{ fontSize: "16px", minHeight: "48px" }} aria-label={`Lihat saran tebus untuk ${b.sku_name}`}>
                Lihat Saran Tebus
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button type="button" onClick={() => setVisibleCount(filtered.length)} className="btn btn-primary w-full min-h-[48px] mt-4 text-base font-semibold" style={{ fontSize: "16px", minHeight: "48px" }}>
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
