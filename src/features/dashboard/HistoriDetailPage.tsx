import { useMemo } from "react";
import { Clock, WarningCircle, NavArrowLeft, Shop } from "iconoir-react";
import { createDemoHistori, type HistoriItem } from "../../lib/fakeHistoriRepository";

export type HistoriDetailPageProps = {
  id: string;
  itemsOverride?: HistoriItem[];
  onBack?: () => void;
};

function getHistoriById(id: string, items: HistoriItem[]): HistoriItem | undefined {
  return items.find((h) => h.id === id);
}

export function HistoriDetailPage({ id, itemsOverride, onBack }: HistoriDetailPageProps) {
  const allItems = useMemo(() => {
    if (itemsOverride) return itemsOverride;
    if (typeof window !== "undefined") {
      const w = window as unknown as { __HISTORI_ITEMS__?: HistoriItem[] };
      if (w.__HISTORI_ITEMS__) return w.__HISTORI_ITEMS__;
    }
    return createDemoHistori(10);
  }, [itemsOverride]);

  const item = useMemo(() => getHistoriById(id, allItems), [id, allItems]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    window.history.back();
    // fallback if no history
    setTimeout(() => {
      if (window.location.pathname.startsWith("/histori")) {
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }, 100);
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
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
      return iso;
    }
  };

  if (!item) {
    return (
      <div className="min-h-screen bg-[#F5F5F0]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        <div className="w-full max-w-[480px] mx-auto px-4 pt-4">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Kembali ke dashboard"
            className="btn btn-outline w-full min-h-[48px] text-base font-semibold rounded-[12px] flex items-center justify-center gap-2"
            style={{ minHeight: "48px", fontSize: "16px", borderColor: "#D9D9D9", color: "#1A1A1A", backgroundColor: "#FFFFFF", borderWidth: "1px" }}
            data-testid="btn-back-histori"
          >
            <NavArrowLeft width={18} height={18} aria-hidden="true" />
            Kembali
          </button>
          <div className="bg-white border border-[#D9D9D9] rounded-[12px] p-6 text-center mt-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <p className="text-base text-[#1A1A1A]" style={{ fontSize: "16px" }} role="status">
              Histori tidak ditemukan
            </p>
            <p className="text-sm text-[#595959] mt-1" style={{ fontSize: "14px" }}>
              ID {id} tidak ada di cache
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]" style={{ fontFamily: "Inter, system-ui, sans-serif" }} data-testid="histori-detail-page">
      <div className="w-full max-w-[480px] mx-auto px-4 pt-4 pb-8">
        {/* Back 48px */}
        <button
          type="button"
          onClick={handleBack}
          aria-label="Kembali ke dashboard"
          className="btn btn-outline w-full min-h-[48px] text-base font-semibold rounded-[12px] flex items-center justify-center gap-2"
          style={{ minHeight: "48px", fontSize: "16px", borderColor: "#D9D9D9", color: "#1A1A1A", backgroundColor: "#FFFFFF", borderWidth: "1px" }}
          data-testid="btn-back-histori"
        >
          <NavArrowLeft width={18} height={18} aria-hidden="true" />
          Kembali
        </button>

        {/* Detail card */}
        <div className="bg-white border border-[#D9D9D9] rounded-[12px] p-5 mt-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }} role="article" aria-label={`Detail histori ${item.aksi}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full border">
              <Shop width={14} height={14} aria-hidden="true" />
              Histori Saran
            </span>
            <span
              className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#E8F5E9", color: "#0F7A4A", border: "1px solid #0F7A4A", fontSize: "12px" }}
              data-testid="badge-confidence"
            >
              {item.confidence}
            </span>
          </div>

          <h1 className="text-[18px] font-bold text-[#1A1A1A] leading-tight" style={{ fontSize: "18px" }} data-testid="detail-aksi">
            {item.aksi}
          </h1>

          {/* timestamp 12px */}
          <p className="flex items-center gap-1 mt-2 text-[#595959]" style={{ fontSize: "12px" }} data-testid="detail-timestamp">
            <Clock width={14} height={14} aria-hidden="true" className="shrink-0" />
            <span style={{ fontSize: "12px" }}>{formatTimestamp(item.created_at)}</span>
            <span className="ml-1 text-[12px]">• {item.batch_name}</span>
          </p>

          <div className="bg-[#F5F5F0] rounded-[8px] p-3 mt-3 border border-[#D9D9D9]/60">
            <p className="text-[16px] font-semibold text-[#1A1A1A]" style={{ fontSize: "16px" }} data-testid="detail-pasangan">
              Pasangan: {item.pasangan} <span className="text-[#595959] font-normal">(laris)</span>
            </p>
            <p className="text-[14px] text-[#595959] mt-1 flex items-center gap-1" style={{ fontSize: "14px" }}>
              Harga tebus <span className="font-semibold text-[#0F7A4A]" data-testid="detail-harga">Rp{item.harga_tebus.toLocaleString("id-ID")}</span>
            </p>
          </div>

          <div className="mt-3">
            <p className="text-[14px] font-semibold text-[#1A1A1A]" style={{ fontSize: "14px" }}>
              Alasan:
            </p>
            <p className="text-[16px] text-[#1A1A1A] leading-relaxed mt-1" style={{ fontSize: "16px", lineHeight: 1.5 }} data-testid="detail-alasan">
              "{item.alasan}"
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[#595959]" style={{ fontSize: "12px" }}>
            <WarningCircle width={14} height={14} aria-hidden="true" className="shrink-0" />
            <span style={{ fontSize: "12px" }}>ID: {item.id} • org {item.org_id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoriDetailPage;
