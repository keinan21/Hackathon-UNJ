import { useEffect, useState } from "react";
import { NavArrowLeft, Clock, Shop } from "iconoir-react";
import { realRepo } from "../../db/dexieRepository";

type HistoriItem = {
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

export function HistoriDetailPage({ id, onBack }: { id: string; onBack?: () => void }) {
  const [item, setItem] = useState<HistoriItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cache = await realRepo.listAdvisorCache("toko-01").catch(() => []);
        const promos = await realRepo.listPromos("toko-01").catch(() => []);
        if (cancelled) return;
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
        const all = [...fromCache, ...fromPromos];
        const found = all.find((h) => h.id === id) ?? null;
        if (!cancelled) setItem(found);
      } catch {
        if (!cancelled) setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleBack = () => {
    if (onBack) onBack();
    else {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  if (loading) {
    return (
      <section className="w-full max-w-2xl" data-testid="histori-detail">
        <p className="text-center text-base-content/70 text-base">Memuat histori...</p>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="w-full max-w-2xl" data-testid="histori-detail-notfound">
        <button type="button" onClick={handleBack} className="btn btn-outline border-base-300 text-base-content w-full min-h-[48px] text-base font-semibold rounded-xl" data-testid="histori-back">
          <NavArrowLeft width={18} height={18} aria-hidden="true" /> Kembali ke Dashboard
        </button>
        <p className="text-center text-base-content/70 text-base mt-6">Histori tidak ditemukan</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-2xl" aria-labelledby="detail-heading" data-testid="histori-detail">
      <button type="button" onClick={handleBack} aria-label="Kembali ke Dashboard" className="btn btn-outline border-base-300 text-base-content w-full min-h-[48px] text-base font-semibold rounded-xl mb-4" data-testid="histori-back">
        <NavArrowLeft width={18} height={18} aria-hidden="true" /> Kembali ke Dashboard
      </button>
      <div className="card bg-base-100 border border-base-300 rounded-xl p-4 shadow-sm">
        <h2 id="detail-heading" className="text-lg font-bold text-base-content leading-tight">{item.aksi}</h2>
        <p className="text-sm text-base-content/70 mt-2 leading-relaxed text-base">{item.alasan}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className="badge badge-success gap-1 text-xs font-semibold px-2 py-1">
            <Shop width={14} height={14} aria-hidden="true" /> {item.pasangan}
          </span>
          <span className="text-xs text-base-content/70 inline-flex items-center gap-1">
            <Clock width={14} height={14} aria-hidden="true" /> {new Date(item.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-base font-semibold text-primary">Rp{item.harga_tebus.toLocaleString("id-ID")}</span>
          <span className="text-xs text-base-content/70">floor Rp{item.harga_floor.toLocaleString("id-ID")} (HPP*0.85)</span>
        </div>
        <p className="text-xs text-base-content/70 mt-1">ID {item.id} • org {item.org_id}</p>
      </div>
    </section>
  );
}

export default HistoriDetailPage;
