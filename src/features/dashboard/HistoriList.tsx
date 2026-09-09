import { useEffect, useState } from "react";
import { Clock, Shop } from "iconoir-react";
import { realRepo } from "../../db/dexieRepository";

export type HistoriItem = {
  id: string;
  aksi: string;
  alasan: string;
  pasangan: string;
  harga_tebus: number;
  harga_floor: number;
  sku_name: string;
  sku_pasangan_name: string;
  created_at: string;
  confidence: number;
  org_id: string;
};

export type HistoriListProps = {
  onSelect?: (item: HistoriItem) => void;
  limit?: number;
  historiOverride?: HistoriItem[];
};

export function HistoriList({ onSelect, limit = 5, historiOverride }: HistoriListProps) {
  const [histori, setHistori] = useState<HistoriItem[]>(() => {
    if (historiOverride) return historiOverride;
    return [];
  });
  const [loading, setLoading] = useState(!historiOverride);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (historiOverride) return;
    const onCreated = () => setReloadToken((t) => t + 1);
    window.addEventListener("promo-created", onCreated as EventListener);
    return () => window.removeEventListener("promo-created", onCreated as EventListener);
  }, [historiOverride]);

  useEffect(() => {
    if (historiOverride) return;
    let cancelled = false;
    (async () => {
      try {
        const cache = await realRepo.listAdvisorCache("toko-01").catch(() => []);
        const promos = await realRepo.listPromos("toko-01").catch(() => []);
        if (cancelled) return;
        if (cache.length === 0 && promos.length === 0) {
          setHistori([]);
        } else {
          const fromCache: HistoriItem[] = cache.map((c) => {
            const s = c.suggestion;
            return {
              id: c.batch_id,
              aksi: s.aksi,
              alasan: s.alasan,
              pasangan: s.pasangan_tebus_murah ?? "-",
              harga_tebus: s.harga_tebus,
              harga_floor: Math.round((s.harga_tebus - s.estimasi_margin) * 0.85),
              sku_name: s.batch_id,
              sku_pasangan_name: s.pasangan_tebus_murah ?? "-",
              created_at: s.created_at,
              confidence: s.confidence === "Tinggi" ? 0.92 : s.confidence === "Sedang" ? 0.75 : 0.6,
              org_id: c.org_id,
            } as unknown as HistoriItem;
          });
          const fromPromos: HistoriItem[] = promos.map((p) => ({
            id: p.id,
            aksi: `Tebus Murah ${p.batch_id}`,
            alasan: "Promo tebus murah",
            pasangan: p.sku_pasangan_id ?? "-",
            harga_tebus: p.harga_tebus,
            harga_floor: 0,
            sku_name: p.batch_id,
            sku_pasangan_name: p.sku_pasangan_id ?? "-",
            created_at: p.created_at,
            confidence: 0.9,
            org_id: p.org_id,
          } as unknown as HistoriItem));
          const merged = [...fromCache, ...fromPromos];
          const dedup = new Map<string, HistoriItem>();
          for (const h of merged) {
            const existing = dedup.get(h.id);
            if (!existing || new Date(h.created_at).getTime() > new Date(existing.created_at).getTime()) dedup.set(h.id, h);
          }
          const mapped = [...dedup.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
          setHistori(mapped);
        }
      } catch (e) {
        console.error("Histori real fetch error", e);
        if (!cancelled) setHistori([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, historiOverride, reloadToken]);

  if (loading) {
    return (
      <section className="w-full" aria-labelledby="histori-heading" data-testid="section-histori">
        <h2 id="histori-heading" className="text-lg font-bold mb-3">
          Histori Saran
        </h2>
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      </section>
    );
  }

  if (histori.length === 0) {
    return (
      <section className="w-full" aria-labelledby="histori-heading" data-testid="section-histori">
        <h2 id="histori-heading" className="text-lg font-bold mb-3">
          Histori Saran
        </h2>
        <div
          role="status"
          className="card card-border bg-base-100"
          data-testid="histori-empty"
        >
          <div className="card-body items-center text-center">
            <div className="bg-base-200 text-base-content/70 flex h-14 w-14 items-center justify-center rounded-field">
              <Clock width={26} height={26} aria-hidden="true" />
            </div>
            <p className="text-base font-semibold">Belum ada saran tersimpan</p>
            <p className="text-base text-base-content/70 leading-relaxed">
              Saran baru muncul tiap jam 7 pagi, atau saat ada stok yang mepet.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full" aria-labelledby="histori-heading" data-testid="section-histori">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="histori-heading" className="text-lg font-bold">
          Histori Saran
        </h2>
        <span className="text-sm text-base-content/70 shrink-0">
          {histori.length} terakhir
        </span>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-label="Daftar histori saran">
        {histori.map((h) => (
          <li
            key={h.id}
            role="article"
            data-testid={`histori-${h.id}`}
            onClick={() => {
              if (onSelect) onSelect(h);
              else {
                const url = `/histori/${h.id}`;
                window.history.pushState({}, "", url);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }
            }}
            className="card card-border bg-base-100 cursor-pointer hover:border-primary transition-colors"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const url = `/histori/${h.id}`;
                window.history.pushState({}, "", url);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }
            }}
            aria-label={`${h.aksi} pasangan ${h.pasangan}`}
          >
            <div className="card-body gap-2 p-4">
              <p className="card-title text-base leading-snug">
                {h.aksi}
              </p>
              <p className="text-sm text-base-content/70 line-clamp-2 leading-relaxed">
                {h.alasan}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="badge badge-soft badge-success badge-sm gap-1">
                  <Shop width={12} height={12} aria-hidden="true" /> {h.pasangan}
                </span>
                <span className="text-xs text-base-content/70 inline-flex items-center gap-1">
                  <Clock width={14} height={14} aria-hidden="true" />{" "}
                  {new Date(h.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="text-sm font-semibold text-success">
                Rp{h.harga_tebus.toLocaleString("id-ID")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default HistoriList;
