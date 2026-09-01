import { useEffect, useMemo, useState, useCallback } from "react";
import { CheckCircle, WarningCircle, Xmark, Shop, Timer } from "iconoir-react";
import ApproveDialog from "./ApproveDialog";
import type { Promo } from "./promo.types";
import { createDemoPromos, formatRupiah } from "./promo.types";

export type PromoAktifListProps = {
  /** Override promos for e2e seeding — if omitted uses demo proposed set */
  initialPromos?: Promo[];
  /** Force offline banner visible for test */
  forceOffline?: boolean;
  /** Force stale cache banner */
  staleCache?: boolean;
};

export function PromoAktifList({ initialPromos, forceOffline, staleCache }: PromoAktifListProps) {
  // Allow window injection for e2e: __PROMO_SEED__ , __OFFLINE_STALE__
  const injectedInitial = useMemo(() => {
    if (typeof window !== "undefined") {
      const w = window as unknown as { __PROMO_INITIAL__?: Promo[]; __OFFLINE_STALE__?: boolean };
      if (w.__PROMO_INITIAL__) return w.__PROMO_INITIAL__;
    }
    return initialPromos;
  }, [initialPromos]);

  const [promos, setPromos] = useState<Promo[]>(() => {
    if (injectedInitial) return injectedInitial;
    // Check URL param for test modes
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("promo") === "active") return createDemoPromos().map((pr) => ({ ...pr, status: "active" as const }));
      if (p.get("promo") === "guardrailFail") {
        const bad = createDemoPromos()[0];
        return [{ ...bad, harga_tebus: 8400, keuntungan_tipis: 8400 - bad.harga_floor }];
      }
      if (p.get("promo") === "empty") return [];
    }
    return createDemoPromos();
  });

  const [selected, setSelected] = useState<Promo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [offline, setOffline] = useState<boolean>(() => {
    if (forceOffline) return true;
    if (typeof window !== "undefined") {
      const w = window as unknown as { __OFFLINE_STALE__?: boolean };
      if (w.__OFFLINE_STALE__) return true;
      const p = new URLSearchParams(window.location.search);
      if (p.get("offline") === "1") return true;
      if (p.get("stale") === "1") return true;
      return !navigator.onLine;
    }
    return false;
  });

  // Determine stale cache banner: offline + staleCache or offline prop
  const showOfflineBanner = useMemo(() => {
    if (staleCache) return true;
    if (forceOffline) return true;
    if (typeof window !== "undefined") {
      const w = window as unknown as { __OFFLINE_STALE__?: boolean };
      if (w.__OFFLINE_STALE__) return true;
      const p = new URLSearchParams(window.location.search);
      if (p.get("stale") === "1") return true;
      if (p.get("offline") === "1") return true;
    }
    return offline;
  }, [offline, staleCache, forceOffline]);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Listen custom stale event for e2e
    const onStale = () => setOffline(true);
    window.addEventListener("__offline_stale", onStale as EventListener);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("__offline_stale", onStale as EventListener);
    };
  }, []);

  // Toast lifecycle 4s + GPU translateY 200ms
  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const t = setTimeout(() => {
      setToastVisible(false);
      // after transition, clear
      setTimeout(() => setToast(null), 220);
    }, 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRequestApprove = useCallback((promo: Promo) => {
    setSelected(promo);
    setDialogOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected) return;
    // Mock update: proposed -> active via local state (real would be Repository)
    setPromos((prev) => prev.map((p) => (p.id === selected.id ? { ...p, status: "active" as const } : p)));
    setDialogOpen(false);
    setSelected(null);
    setToast("Tebus murah aktif, tampil di Dashboard");
  }, [selected]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setSelected(null);
  }, []);

  const dismissToast = useCallback(() => {
    setToastVisible(false);
    setTimeout(() => setToast(null), 200);
  }, []);

  const proposedCount = promos.filter((p) => p.status === "proposed").length;
  const activePromos = promos.filter((p) => p.status === "active");

  // For isolated demo, also show proposed section + active section
  return (
    <section className="w-full max-w-[480px] mx-auto px-4" aria-labelledby="promo-heading">
      <h2 id="promo-heading" className="text-[20px] font-bold text-[#1A1A1A] mb-3" style={{ fontSize: "20px" }}>
        Promo Tebus Murah
      </h2>

      {/* Offline banner kuning */}
      {showOfflineBanner && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded-[12px] border px-3 py-3 flex items-center gap-2 text-[16px]"
          style={{
            backgroundColor: "#FFF8E1",
            borderColor: "#F9A825",
            color: "#1A1A1A",
            fontSize: "16px",
          }}
          data-testid="offline-banner"
        >
          <WarningCircle width={18} height={18} aria-hidden="true" className="text-[#EF6C00] shrink-0" />
          <span>Kamu offline, saran kemarin tetap tampil</span>
        </div>
      )}

      {/* Empty state for promo */}
      {promos.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <p className="text-base text-[#1A1A1A]" style={{ fontSize: "16px" }}>
            Belum ada promo aktif. Buat tebus murah dari stok mepet biar tidak jadi sampah.
          </p>
          <button
            type="button"
            className="btn btn-primary w-full min-h-[48px] mt-3 text-base font-semibold rounded-[12px]"
            style={{ minHeight: "48px", fontSize: "16px", backgroundColor: "#0F7A4A", color: "#FFFFFF", border: "none" }}
          >
            Lihat Stok Mepet
          </button>
        </div>
      ) : (
        <>
          {/* Proposed section — needs approve */}
          {proposedCount > 0 && (
            <div className="mb-4">
              <h3 className="text-[16px] font-semibold text-[#1A1A1A] mb-2" style={{ fontSize: "16px" }}>
                Usulan Tebus Murah ({proposedCount})
              </h3>
              <ul className="space-y-3" aria-label="Daftar usulan tebus murah">
                {promos
                  .filter((p) => p.status === "proposed")
                  .map((p) => (
                    <PromoCard key={p.id} promo={p} onApprove={() => handleRequestApprove(p)} />
                  ))}
              </ul>
            </div>
          )}

          {/* Active section */}
          <div>
            <h3 className="text-[16px] font-semibold text-[#1A1A1A] mb-2" style={{ fontSize: "16px" }}>
              Promo Aktif {activePromos.length > 0 ? `(${activePromos.length})` : ""}
            </h3>
            {activePromos.length === 0 ? (
              <div
                role="status"
                className="bg-white border border-[#D9D9D9] rounded-[12px] p-4 text-center"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                data-testid="promo-aktif-empty"
              >
                <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>
                  Belum ada promo aktif
                </p>
              </div>
            ) : (
              <ul className="space-y-3" aria-label="Daftar promo aktif" data-testid="promo-aktif-list">
                {activePromos.map((p) => (
                  <PromoCard key={p.id} promo={p} onApprove={() => handleRequestApprove(p)} isActiveList />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Dialog */}
      <ApproveDialog open={dialogOpen} promo={selected} onConfirm={handleConfirm} onCancel={handleCancel} />

      {/* Toast success 4s + dismiss X role=status aria-live=polite success-bg #E8F5E9, GPU translateY */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-32px)] max-w-[480px] flex items-center justify-between gap-3 px-4 py-3 rounded-[12px] border"
          style={{
            backgroundColor: "#E8F5E9",
            borderColor: "#0F7A4A",
            color: "#1A1A1A",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            transform: toastVisible ? "translate(-50%, 0)" : "translate(-50%, 16px)",
            opacity: toastVisible ? 1 : 0,
            transition: "transform 200ms ease, opacity 200ms ease",
            willChange: "transform",
          }}
          data-testid="promo-toast"
        >
          <span className="flex items-center gap-2 text-[16px] font-medium" style={{ fontSize: "16px" }}>
            <CheckCircle width={18} height={18} aria-hidden="true" className="text-[#0F7A4A] shrink-0" />
            {toast}
          </span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Tutup notifikasi"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
            data-testid="toast-dismiss-x"
          >
            <Xmark width={16} height={16} aria-hidden="true" className="text-[#1A1A1A]" />
          </button>
        </div>
      )}

      {/* Hidden badge count helper for dashboard integration */}
      <span className="sr-only" data-testid="badge-active-count">
        {activePromos.length} promo aktif
      </span>
    </section>
  );
}

function PromoCard({
  promo,
  onApprove,
  isActiveList = false,
}: {
  promo: Promo;
  onApprove: () => void;
  isActiveList?: boolean;
}) {
  const isActive = promo.status === "active";
  const isProposed = promo.status === "proposed";
  const modalText = formatRupiah(promo.modal);
  const tebusText = formatRupiah(promo.harga_tebus);
  const floorText = promo.harga_floor.toLocaleString("id-ID");
  const showGuardrailFail = promo.harga_tebus < promo.harga_floor;

  return (
    <li
      role="article"
      aria-label={`Tebus murah ${promo.sku_name} dengan ${promo.sku_pasangan_name}`}
      className="bg-white border border-[#D9D9D9] rounded-[12px] p-4"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
      data-testid={isActive ? "promo-card-active" : "promo-card-proposed"}
      data-promo-id={promo.id}
      data-status={promo.status}
    >
      {/* Header badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full border">
          <Shop width={14} height={14} aria-hidden="true" />
          Tebus Murah
        </span>
        <span
          className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: isActive ? "#E8F5E9" : "#FFF8E1",
            color: isActive ? "#0F7A4A" : "#EF6C00",
            border: `1px solid ${isActive ? "#0F7A4A" : "#F9A825"}`,
            fontSize: "12px",
          }}
          data-testid="promo-status-badge"
        >
          {isActive ? (
            <>
              <CheckCircle width={12} height={12} aria-hidden="true" /> Aktif
            </>
          ) : (
            <>
              <Timer width={12} height={12} aria-hidden="true" /> Diulas
            </>
          )}
        </span>
      </div>

      {/* Batch info */}
      <div className="mb-2">
        <p className="text-[16px] font-semibold text-[#1A1A1A] leading-tight" style={{ fontSize: "16px" }}>
          {promo.sku_name} • {promo.qty} pcs
        </p>
        <p className="text-[14px] text-[#595959] mt-0.5 flex items-center gap-1" style={{ fontSize: "14px" }}>
          <Timer width={14} height={14} aria-hidden="true" className="shrink-0" />
          Kadaluarsa: {promo.expiry_date} [H-{promo.daysToExpiry}]
        </p>
      </div>

      {/* Pricing — Modal 14px secondary + Tebus 18px/600 primary + guardrail caption */}
      <div className="bg-[#F5F5F0] rounded-[8px] p-3 mb-2 border border-[#D9D9D9]/60">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] text-[#595959]" style={{ fontSize: "14px" }}>
            Modal {modalText}
          </span>
          <span className="text-[12px] text-[#595959]" style={{ fontSize: "12px" }}>
            Harga normal {formatRupiah(promo.harga_normal)}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span
            className="text-[#0F7A4A]"
            style={{ fontSize: "18px", fontWeight: 600, lineHeight: 1.25 }}
            data-testid="harga-tebus"
          >
            Tebus {tebusText}
          </span>
          <span
            title={`HPP*0.85=${floorText}`}
            className="inline-flex items-center gap-1 text-[12px]"
            style={{ fontSize: "12px", color: showGuardrailFail ? "#C62828" : "#595959" }}
            data-testid="guardrail-caption"
          >
            {showGuardrailFail ? (
              <WarningCircle width={12} height={12} aria-hidden="true" className="text-[#C62828]" />
            ) : (
              <CheckCircle width={12} height={12} aria-hidden="true" className="text-[#0F7A4A]" />
            )}
            {showGuardrailFail ? `Di bawah floor Rp${floorText}` : `Untung tipis ${formatRupiah(promo.keuntungan_tipis)}`}
          </span>
        </div>
        {showGuardrailFail && (
          <p className="text-[12px] text-[#C62828] mt-1" role="alert" style={{ fontSize: "12px" }}>
            Harga tebus tidak boleh di bawah HPP x 0.85 (Rp {floorText})
          </p>
        )}
      </div>

      {/* Pairing + alasan */}
      <div className="mb-3 space-y-1">
        <p className="text-[16px] text-[#1A1A1A]" style={{ fontSize: "16px" }}>
          <span className="font-semibold">Beli:</span> {promo.sku_pasangan_name} <span className="text-[#595959]">(laris)</span>
        </p>
        <p className="text-[14px] text-[#595959] leading-relaxed" style={{ fontSize: "14px" }}>
          <span className="font-medium text-[#1A1A1A]">Alasan AI:</span> “{promo.alasan}”
        </p>
      </div>

      {/* Action */}
      {isProposed && !isActiveList && (
        <button
          type="button"
          onClick={onApprove}
          aria-label={`Setujui tebus murah ${promo.sku_name} dengan ${promo.sku_pasangan_name} harga ${promo.harga_tebus.toLocaleString("id-ID")}`}
          className="btn btn-primary w-full min-h-[48px] text-base font-semibold rounded-[12px]"
          style={{
            minHeight: "48px",
            fontSize: "16px",
            backgroundColor: "#0F7A4A",
            color: "#FFFFFF",
            border: "none",
            width: "100%",
          }}
          data-testid="btn-setujui-tebus"
        >
          Setujui Tebus Murah
        </button>
      )}
      {isProposed && !isActiveList && (
        <button
          type="button"
          className="btn btn-outline w-full min-h-[48px] mt-2 text-base font-semibold rounded-[12px]"
          style={{
            minHeight: "48px",
            fontSize: "16px",
            borderColor: "#D9D9D9",
            color: "#1A1A1A",
            backgroundColor: "#FFFFFF",
            borderWidth: "1px",
            width: "100%",
          }}
          data-testid="btn-ubah-harga"
        >
          Ubah Harga
        </button>
      )}
      {isActive && (
        <div
          className="w-full rounded-[12px] px-3 py-2.5 text-center text-[14px] font-medium border"
          style={{
            backgroundColor: "#E8F5E9",
            borderColor: "#0F7A4A",
            color: "#0F7A4A",
            fontSize: "14px",
            minHeight: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
          data-testid="badge-aktif-hijau"
        >
          <CheckCircle width={16} height={16} aria-hidden="true" /> Tampil di Dashboard dan badge SKU
        </div>
      )}
    </li>
  );
}

export default PromoAktifList;
