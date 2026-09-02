import { Clock, Shop } from "iconoir-react";
import { getHistoriTerbaru, demoHistori, type HistoriItem } from "../../lib/fakeHistoriRepository";

export type HistoriListProps = {
  onSelect?: (item: HistoriItem) => void;
  limit?: number;
  historiOverride?: HistoriItem[];
};

export function HistoriList({ onSelect, limit = 5, historiOverride }: HistoriListProps) {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const isEmpty = params?.get("histori") === "empty" || params?.get("seed") === "empty";
  const histori = isEmpty ? [] : (historiOverride ?? getHistoriTerbaru(limit));
  const total = demoHistori.length;

  if (histori.length === 0) {
    const handleReload = () => window.location.reload();
    return (
      <section className="w-full flex flex-col gap-md" aria-labelledby="histori-heading" data-testid="section-histori">
        <h2 id="histori-heading" className="font-headline-md text-headline-md text-primary">Histori Saran</h2>
        <div
          role="status"
          aria-live="polite"
          className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md shadow-sm flex flex-col items-center gap-3 text-center py-8"
          data-testid="histori-empty"
        >
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
            <circle cx="24" cy="24" r="16" fill="none" stroke="#D9D9D9" strokeWidth="2" />
            <path d="M24 14 L24 24 L32 28" fill="none" stroke="#595959" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="font-body-md text-body-md text-text-primary leading-relaxed">Belum ada saran. Saran baru muncul tiap jam 7 pagi atau saat ada stok mepet baru.</p>
          <button
            type="button"
            onClick={handleReload}
            aria-label="Muat ulang histori saran"
            className="min-h-[48px] w-full px-6 py-3 bg-surface-container-lowest border border-border-subtle text-primary font-body-md text-body-md rounded-lg hover:bg-surface-container-low transition-colors"
          >
            Muat Ulang
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full flex flex-col gap-md" aria-labelledby="histori-heading" data-testid="section-histori">
      <h2 id="histori-heading" className="font-headline-md text-headline-md text-primary">Histori Saran</h2>
      <p className="font-label-caps text-label-caps text-slate-gray">Menampilkan {histori.length} terbaru dari {total} saran</p>
      <ul className="flex flex-col gap-sm" aria-label="Daftar histori saran">
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
            className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md shadow-sm cursor-pointer hover:bg-surface-container-low transition-colors"
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
                <p className="font-semibold text-[#1A1A1A] leading-snug" style={{ fontSize: "16px" }}>{h.aksi}</p>
                <p className="text-sm text-[#595959] mt-1 line-clamp-2" style={{ fontSize: "14px" }}>{h.alasan}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "#E8F5E9", color: "#0F7A4A", fontSize: "12px", border: "1px solid #0F7A4A" }}>
                    <Shop width={12} height={12} aria-hidden="true" /> {h.pasangan}
                  </span>
                  <span className="text-[12px] text-[#595959] inline-flex items-center gap-1" style={{ fontSize: "12px" }}>
                    <Clock width={14} height={14} aria-hidden="true" /> {new Date(h.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p className="text-[12px] font-semibold mt-1" style={{ fontSize: "12px", color: "#0F7A4A" }}>Rp{h.harga_tebus.toLocaleString("id-ID")} • floor Rp{h.harga_floor.toLocaleString("id-ID")}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default HistoriList;
