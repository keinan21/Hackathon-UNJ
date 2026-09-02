import { useMemo } from "react";
import { Clock, WarningCircle, NavArrowRight } from "iconoir-react";
import { createDemoHistori, getHistoriTerbaru, type HistoriItem } from "../../lib/fakeHistoriRepository";

export type HistoriListProps = {
  itemsOverride?: HistoriItem[];
  onSelect?: (id: string) => void;
};

// SVG outline 48px for empty histori — simple clock outline
function EmptyHistoriIcon() {
  return (
    <svg
      width={48}
      height={48}
      viewBox="0 0 48 48"
      fill="none"
      stroke="#9E9E9E"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mx-auto"
      data-testid="empty-svg-histori"
    >
      <circle cx={24} cy={24} r={16} />
      <path d="M24 16 v8 l6 4" />
      <path d="M12 8 h24 M12 40 h24" opacity={0.3} />
    </svg>
  );
}

export function HistoriList({ itemsOverride, onSelect }: HistoriListProps) {
  const allItems = useMemo(() => {
    if (itemsOverride !== undefined) return itemsOverride;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("histori") === "empty") return [];
      const w = window as unknown as { __HISTORI_ITEMS__?: HistoriItem[]; __HISTORI_EMPTY__?: boolean };
      if (w.__HISTORI_EMPTY__) return [];
      if (w.__HISTORI_ITEMS__) return w.__HISTORI_ITEMS__;
      if (p.get("seed") === "historiEmpty") return [];
    }
    return createDemoHistori(10);
  }, [itemsOverride]);

  const terbaru = useMemo(() => getHistoriTerbaru(allItems, 5), [allItems]);

  const handleSelect = (id: string) => {
    if (onSelect) {
      onSelect(id);
      return;
    }
    // default: pushState to /histori/:id
    const url = `/histori/${id}`;
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      // format 2026-08-31 07:05 WIB in Asia/Jakarta
      const fmt = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = fmt.formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} WIB`;
    } catch {
      return iso.slice(0, 16);
    }
  };

  return (
    <section className="w-full max-w-[480px] mx-auto px-4" aria-labelledby="histori-heading">
      <h2
        id="histori-heading"
        className="text-[20px] font-bold text-[#1A1A1A] mb-3"
        style={{ fontSize: "20px", lineHeight: 1.25 }}
      >
        Histori Saran
      </h2>

      {terbaru.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="bg-white border border-[#D9D9D9] rounded-[12px] p-6 text-center"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          data-testid="histori-empty"
        >
          <EmptyHistoriIcon />
          <p className="text-base text-[#1A1A1A] mt-3 leading-relaxed" style={{ fontSize: "16px" }}>
            Belum ada saran. Saran baru muncul tiap jam 7 pagi atau saat ada stok mepet baru.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-outline w-full min-h-[48px] mt-3 text-base font-semibold rounded-[12px]"
            style={{ minHeight: "48px", fontSize: "16px", borderColor: "#D9D9D9", color: "#1A1A1A", backgroundColor: "#FFFFFF", borderWidth: "1px" }}
            data-testid="histori-reload"
          >
            Muat Ulang
          </button>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Daftar histori saran 5 terbaru" data-testid="histori-list">
          {terbaru.map((h) => (
            <li
              key={h.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(h.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(h.id);
                }
              }}
              aria-label={`Histori ${h.aksi} alasan ${h.alasan}`}
              className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 cursor-pointer hover:border-[#0F7A4A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F7A4A] focus-visible:ring-offset-2"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              data-testid="histori-card"
              data-histori-id={h.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-[#1A1A1A] leading-tight truncate" style={{ fontSize: "16px" }}>
                    {h.aksi}
                  </p>
                  <p className="text-[14px] text-[#595959] mt-1 leading-relaxed line-clamp-2" style={{ fontSize: "14px" }}>
                    "{h.alasan}"
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className="badge gap-1 border-none font-semibold text-white"
                      style={{ backgroundColor: "#0F7A4A", color: "#FFFFFF", fontSize: "12px", padding: "4px 8px", height: "22px", borderRadius: "8px" }}
                      data-testid="histori-badge-pasangan"
                    >
                      <WarningCircle width={14} height={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                      {h.pasangan}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#595959]" style={{ fontSize: "12px" }}>
                      <Clock width={14} height={14} aria-hidden="true" className="shrink-0" />
                      <span style={{ fontSize: "12px" }} data-testid="histori-timestamp">
                        {formatTimestamp(h.created_at)}
                      </span>
                    </span>
                  </div>
                </div>
                <span className="shrink-0 w-8 h-8 rounded-full bg-[#F5F5F0] flex items-center justify-center" aria-hidden="true">
                  <NavArrowRight width={16} height={16} className="text-[#595959]" />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {terbaru.length > 0 && (
        <p className="text-xs text-[#595959] mt-3 text-center" style={{ fontSize: "12px" }}>
          Menampilkan 5 terbaru dari {allItems.length} saran
        </p>
      )}
    </section>
  );
}

export default HistoriList;
