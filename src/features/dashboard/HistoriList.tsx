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
  }, [limit, historiOverride]);

  if (loading) {
    return (
      <section className="w-full max-w-[480px] mx-auto px-4" aria-labelledby="histori-heading" data-testid="section-histori">
        <h2 id="histori-heading" className="text-[20px] font-bold text-[#1A1A1A] mb-3" style={{ fontSize: "20px" }}>
          Histori Saran
        </h2>
        <div className="bg-white border border-[#D9D9D9] rounded-[12px] p-6 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>
            Memuat histori...
          </p>
        </div>
      </section>
    );
  }

  if (histori.length === 0) {
    return (
      <section className="w-full max-w-[480px] mx-auto px-4" aria-labelledby="histori-heading" data-testid="section-histori">
        <h2 id="histori-heading" className="text-[20px] font-bold text-[#1A1A1A] mb-3" style={{ fontSize: "20px" }}>
          Histori Saran
        </h2>
        <div
          role="status"
          aria-live="polite"
          className="bg-white border border-[#D9D9D9] rounded-[12px] p-6 text-center flex flex-col items-center gap-3"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          data-testid="histori-empty"
        >
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
            <circle cx="24" cy="24" r="16" fill="none" stroke="#D9D9D9" strokeWidth="2" />
            <path d="M24 14 L24 24 L32 28" fill="none" stroke="#595959" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>
            Belum ada histori saran. Buat promo dulu.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-[480px] mx-auto px-4" aria-labelledby="histori-heading" data-testid="section-histori">
      <h2 id="histori-heading" className="text-[20px] font-bold text-[#1A1A1A] mb-3" style={{ fontSize: "20px" }}>
        Histori Saran
      </h2>
      <p className="text-sm text-[#595959] mb-2" style={{ fontSize: "12px" }}>
        Menampilkan {histori.length} terbaru dari {histori.length} saran
      </p>
      <ul className="space-y-3" aria-label="Daftar histori saran">
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
            className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 cursor-pointer hover:border-[#0F7A4A] transition-colors"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
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
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1A1A1A] leading-snug" style={{ fontSize: "16px" }}>
                  {h.aksi}
                </p>
                <p className="text-sm text-[#595959] mt-1 line-clamp-2" style={{ fontSize: "14px" }}>
                  {h.alasan}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-full"
                    style={{ backgroundColor: "#E8F5E9", color: "#0F7A4A", fontSize: "12px", border: "1px solid #0F7A4A" }}
                  >
                    <Shop width={12} height={12} aria-hidden="true" /> {h.pasangan}
                  </span>
                  <span className="text-[12px] text-[#595959] inline-flex items-center gap-1" style={{ fontSize: "12px" }}>
                    <Clock width={14} height={14} aria-hidden="true" />{" "}
                    {new Date(h.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p className="text-[12px] font-semibold mt-1" style={{ fontSize: "12px", color: "#0F7A4A" }}>
                  Rp{h.harga_tebus.toLocaleString("id-ID")} • floor Rp{h.harga_floor.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default HistoriList;
