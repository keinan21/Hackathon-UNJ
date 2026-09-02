import { useEffect, useState } from "react";
import { NavArrowLeft, Clock, Shop } from "iconoir-react";
import { getHistoriById, type HistoriItem } from "../../lib/fakeHistoriRepository";

export function HistoriDetailPage({ id, onBack }: { id: string; onBack?: () => void }) {
  const [item, setItem] = useState<HistoriItem | null>(null);

  useEffect(() => {
    const found = getHistoriById(id) ?? null;
    setItem(found);
  }, [id]);

  const handleBack = () => {
    if (onBack) onBack();
    else {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  if (!item) {
    return (
      <section className="w-full max-w-[480px] mx-auto px-4 py-4" data-testid="histori-detail-notfound">
        <button type="button" onClick={handleBack} className="btn btn-outline w-full min-h-[48px] text-base font-semibold rounded-[12px]" style={{ minHeight: "48px", fontSize: "16px", borderColor: "#D9D9D9", color: "#1A1A1A" }} data-testid="histori-back">
          <NavArrowLeft width={18} height={18} aria-hidden="true" /> Kembali ke Dashboard
        </button>
        <p className="text-center text-[#595959] mt-6" style={{ fontSize: "16px" }}>Histori tidak ditemukan</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-[480px] mx-auto px-4 py-4" aria-labelledby="detail-heading" data-testid="histori-detail">
      <button type="button" onClick={handleBack} aria-label="Kembali ke Dashboard" className="btn btn-outline w-full min-h-[48px] text-base font-semibold rounded-[12px] mb-4" style={{ minHeight: "48px", fontSize: "16px", borderColor: "#D9D9D9", color: "#1A1A1A", backgroundColor: "#FFFFFF" }} data-testid="histori-back">
        <NavArrowLeft width={18} height={18} aria-hidden="true" /> Kembali ke Dashboard
      </button>
      <div className="bg-white border border-[#D9D9D9] rounded-[12px] p-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h2 id="detail-heading" className="text-[18px] font-bold text-[#1A1A1A] leading-tight" style={{ fontSize: "18px" }}>{item.aksi}</h2>
        <p className="text-sm text-[#595959] mt-2 leading-relaxed" style={{ fontSize: "16px" }}>{item.alasan}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "#E8F5E9", color: "#0F7A4A", fontSize: "12px", border: "1px solid #0F7A4A" }}>
            <Shop width={14} height={14} aria-hidden="true" /> {item.pasangan}
          </span>
          <span className="text-[12px] text-[#595959] inline-flex items-center gap-1" style={{ fontSize: "12px" }}>
            <Clock width={14} height={14} aria-hidden="true" /> {new Date(item.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[16px] font-semibold" style={{ fontSize: "16px", color: "#0F7A4A", fontWeight: 600 }}>Rp{item.harga_tebus.toLocaleString("id-ID")}</span>
          <span className="text-[12px] text-[#595959]" style={{ fontSize: "12px" }}>floor Rp{item.harga_floor.toLocaleString("id-ID")} (HPP*0.85)</span>
        </div>
        <p className="text-[12px] text-[#595959] mt-1" style={{ fontSize: "12px" }}>ID {item.id} • org {item.org_id}</p>
      </div>
    </section>
  );
}

export default HistoriDetailPage;
