import { useEffect, useMemo, useState, useCallback } from "react";
import { CheckCircle, WarningCircle, Xmark, Shop, Timer, EditPencil } from "iconoir-react";
import ApproveDialog from "./ApproveDialog";
import type { Promo } from "./promo.types";
import { formatRupiah } from "./promo.types";
import { realRepo } from "../../db/dexieRepository";
import { daysToExpiry } from "../../engine/expiry";
import { validatePromoUsul } from "../../lib/validation";

export type PromoAktifListProps = {
  initialPromos?: Promo[];
  forceOffline?: boolean;
  staleCache?: boolean;
  actions?: boolean;
};

export function PromoAktifList({ initialPromos, forceOffline, staleCache, actions = true }: PromoAktifListProps) {
  const goPromo = () => {
    window.history.pushState({}, "", "/promo");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const injectedInitial = useMemo(() => {
    if (typeof window !== "undefined") {
      const w = window as unknown as { __PROMO_INITIAL__?: Promo[]; __OFFLINE_STALE__?: boolean };
      if (w.__PROMO_INITIAL__) return w.__PROMO_INITIAL__;
    }
    return initialPromos;
  }, [initialPromos]);

  const [promos, setPromos] = useState<Promo[]>(() => {
    if (injectedInitial) return injectedInitial;
    return [];
  });

  const [loading, setLoading] = useState(!injectedInitial);
  const [selected, setSelected] = useState<Promo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
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

  useEffect(() => {
    if (injectedInitial) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        if (params?.get("promo") === "empty") {
          if (!cancelled) {
            setPromos([]);
            setLoading(false);
          }
          return;
        }
        const dbPromos = await realRepo.listPromos("toko-01").catch(() => []);
        if (cancelled) return;
        if (dbPromos.length === 0) {
          setPromos([]);
          setLoading(false);
          return;
        }
        const mapped: Promo[] = [];
        for (const p of dbPromos) {
          const batch = await realRepo.getBatch(p.batch_id).catch(() => undefined);
          if (!batch) continue;
          const sku = batch ? await realRepo.getSku(batch.sku_id).catch(() => undefined) : undefined;
          const pasanganSku = p.sku_pasangan_id ? await realRepo.getSku(p.sku_pasangan_id).catch(() => undefined) : undefined;
          const days = batch.expiry_date ? daysToExpiry(batch.expiry_date, new Date()) ?? 0 : 0;
          const cache = await realRepo.getAdvisorCache(p.batch_id, "toko-01").catch(() => undefined);
          const alasan = cache?.suggestion.alasan ?? "Tebus murah untuk stok mepet.";
          const harga_tebus = p.harga_tebus;
          const modal = batch.modal_snapshot;
          const harga_floor = Math.round(modal * 0.85);
          mapped.push({
            id: p.id,
            batch_id: p.batch_id,
            sku_name: sku?.nama ?? p.batch_id,
            expiry_date: batch.expiry_date ?? "",
            daysToExpiry: days,
            qty: batch.qty,
            modal,
            harga_normal: sku?.harga_normal ?? modal * 1.5,
            harga_tebus,
            harga_floor,
            keuntungan_tipis: harga_tebus - harga_floor,
            sku_pasangan_id: p.sku_pasangan_id ?? "",
            sku_pasangan_name: pasanganSku?.nama ?? p.sku_pasangan_id ?? "-",
            alasan,
            status: p.status,
            created_at: p.created_at,
            org_id: p.org_id,
          });
        }
        if (!cancelled) {
          mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setPromos(mapped);
        }
      } catch (e) {
        console.error("Promo real fetch error", e);
        if (!cancelled) setPromos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [injectedInitial, reloadToken]);

  useEffect(() => {
    const onCreated = () => setReloadToken((t) => t + 1);
    window.addEventListener("promo-created", onCreated as EventListener);
    return () => window.removeEventListener("promo-created", onCreated as EventListener);
  }, []);

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
    const onStale = () => setOffline(true);
    window.addEventListener("__offline_stale", onStale as EventListener);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("__offline_stale", onStale as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const t = setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToast(null), 220);
    }, 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRequestApprove = useCallback((promo: Promo) => {
    setSelected(promo);
    setDialogOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selected) return;
    try {
      const dbPromo = await realRepo.getPromo(selected.id);
      if (!dbPromo) throw new Error("Promo tidak ditemukan");
      const batch = await realRepo.getBatch(dbPromo.batch_id);
      if (!batch) throw new Error("Batch tidak ditemukan");
      if (batch.qty <= 0) throw new Error("Stok habis, tidak bisa approve tebus murah");
      const sku = await realRepo.getSku(batch.sku_id);
      if (!sku) throw new Error("SKU tidak ditemukan");
      const guard = validatePromoUsul("tebus", { hpp: batch.modal_snapshot, harga_tebus: dbPromo.harga_tebus, harga_normal: sku.harga_normal });
      if (!guard.valid) throw new Error(guard.error ?? "Harga tebus tidak valid");
      await realRepo.updatePromo({ ...dbPromo, status: "active", updated_at: new Date().toISOString() });
      setPromos((prev) => prev.map((p) => (p.id === selected.id ? { ...p, status: "active" as const } : p)));
      setDialogOpen(false);
      setSelected(null);
      setPromoError(null);
      setToast("Tebus murah aktif, tampil di Dashboard");
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal approve tebus murah";
      setPromoError(msg);
      setToast(msg);
      return;
    }
  }, [selected]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setSelected(null);
    setPromoError(null);
  }, []);

  const handleTolak = useCallback(async (promo: Promo) => {
    try {
      const dbPromo = await realRepo.getPromo(promo.id);
      if (dbPromo) await realRepo.deletePromo(dbPromo.id);
    } catch {}
    setPromos((prev) => prev.filter((p) => p.id !== promo.id));
    setToast("Usulan ditolak");
    setPromoError(null);
  }, []);

  const [ubahOpen, setUbahOpen] = useState(false);
  const [ubahSelected, setUbahSelected] = useState<Promo | null>(null);
  const [ubahHarga, setUbahHarga] = useState("");
  const [ubahError, setUbahError] = useState("");

  const handleUbahBuka = useCallback((promo: Promo) => {
    setUbahSelected(promo);
    setUbahHarga(String(promo.harga_tebus));
    setUbahError("");
    setUbahOpen(true);
  }, []);

  const handleUbahSimpan = useCallback(async () => {
    if (!ubahSelected) return;
    const hargaNum = Number(ubahHarga);
    if (!Number.isFinite(hargaNum) || !(hargaNum > 0)) {
      setUbahError("Harga tebus harus lebih dari 0");
      return;
    }
    try {
      const batch = await realRepo.getBatch(ubahSelected.batch_id);
      if (!batch) throw new Error("Batch tidak ditemukan");
      const sku = await realRepo.getSku(batch.sku_id);
      if (!sku) throw new Error("SKU tidak ditemukan");
      const guard = validatePromoUsul("tebus", { hpp: batch.modal_snapshot, harga_tebus: hargaNum, harga_normal: sku.harga_normal });
      if (!guard.valid) {
        setUbahError(guard.error ?? "Harga tidak valid");
        return;
      }
      await realRepo.updatePromo({ ...ubahSelected, harga_tebus: hargaNum, updated_at: new Date().toISOString() });
      setPromos((prev) => prev.map((p) => (p.id === ubahSelected.id ? { ...p, harga_tebus: hargaNum } : p)));
      setUbahOpen(false);
      setUbahSelected(null);
      setUbahHarga("");
      setUbahError("");
      setToast("Harga tebus diperbarui");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal ubah harga";
      setUbahError(msg);
      setToast(msg);
    }
  }, [ubahSelected, ubahHarga]);

  const handleUbahBatal = useCallback(() => {
    setUbahOpen(false);
    setUbahSelected(null);
    setUbahHarga("");
    setUbahError("");
  }, []);

  const dismissToast = useCallback(() => {
    setToastVisible(false);
    setTimeout(() => setToast(null), 200);
  }, []);

  const proposedCount = promos.filter((p) => p.status === "proposed").length;
  const activePromos = promos.filter((p) => p.status === "active");

  if (loading) {
    return (
      <section className="w-full" aria-labelledby="promo-heading">
        <h2 id="promo-heading" className="text-lg font-bold mb-3">
          Promo Tebus Murah
        </h2>
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skeleton h-32 w-full" />
        </div>
      </section>
    );
  }

  const scrollToUrgent = () => {
    document.querySelector('[data-testid="section-urgent"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="w-full" aria-labelledby="promo-heading">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="promo-heading" className="text-lg font-bold">
          Promo Tebus Murah
        </h2>
        {promos.length > 0 && (
          <span className="text-sm text-base-content/70 shrink-0">
            {proposedCount > 0 ? `${proposedCount} menunggu putusan` : `${activePromos.length} jalan`}
          </span>
        )}
      </div>

      {showOfflineBanner && (
        <div role="status" className="alert alert-warning alert-soft mb-3" data-testid="offline-banner">
          <WarningCircle width={18} height={18} aria-hidden="true" />
          <span>Kamu offline, saran kemarin tetap tampil</span>
        </div>
      )}

      {promos.length === 0 ? (
        <div role="status" className="card card-border bg-base-100">
          <div className="card-body items-center text-center">
            <p className="text-base font-semibold">Belum ada promo</p>
            <p className="text-base text-base-content/70 leading-relaxed">
              Buat tebus murah dari stok mepet biar tidak jadi sampah.
            </p>
            <div className="card-actions">
              <button type="button" onClick={scrollToUrgent} className="btn btn-primary btn-block min-h-12 text-base font-semibold">
                Lihat Stok Mepet
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {proposedCount > 0 && (
            <div>
              <h3 className="text-base font-semibold mb-2">
                Perlu putusan ({proposedCount})
              </h3>
              <ul className="space-y-3" aria-label="Daftar usulan tebus murah" data-testid="promo-proposed-list">
                {promos
                  .filter((p) => p.status === "proposed")
                  .map((p) => (
                    <PromoCard key={p.id} promo={p} actions={actions} onViewList={goPromo} onApprove={() => handleRequestApprove(p)} onTolak={() => handleTolak(p)} onUbahHarga={() => handleUbahBuka(p)} />
                  ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-base font-semibold mb-2">
              Lagi jalan {activePromos.length > 0 ? `(${activePromos.length})` : ""}
            </h3>
            {activePromos.length === 0 ? (
              <div role="status" className="card card-border bg-base-100" data-testid="promo-aktif-empty">
                <div className="card-body items-center text-center py-5">
                  <p className="text-base text-base-content/70">
                    Belum ada yang aktif — setujui usulan di atas biar langsung jalan.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-3" aria-label="Daftar promo aktif" data-testid="promo-aktif-list">
                {activePromos.map((p) => (
                  <PromoCard key={p.id} promo={p} actions={actions} onViewList={goPromo} onApprove={() => handleRequestApprove(p)} onUbahHarga={() => handleUbahBuka(p)} isActiveList />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {promoError && (
        <div role="alert" data-testid="promo-error" className="alert alert-error alert-soft mt-3 text-sm">
          <WarningCircle width={18} height={18} aria-hidden="true" />
          <span>{promoError}</span>
        </div>
      )}

      <ApproveDialog open={dialogOpen} promo={selected} onConfirm={handleConfirm} onCancel={handleCancel} />

      {ubahOpen && ubahSelected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          data-testid="ubah-harga-dialog"
          aria-hidden={!ubahOpen}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleUbahBatal} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ubah-harga-title"
            className="relative w-full max-w-[480px] bg-white rounded-[12px] p-5 border border-[#D9D9D9] max-h-[90vh] overflow-auto"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="shrink-0 w-10 h-10 rounded-full bg-[#FFF8E1] flex items-center justify-center text-[#8D6E63]">
                <EditPencil width={20} height={20} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <h3 id="ubah-harga-title" className="text-[18px] font-bold text-[#1A1A1A] leading-tight" style={{ fontSize: "18px" }}>
                  Ubah harga tebus {ubahSelected.sku_name}
                </h3>
                <p className="text-[16px] text-[#595959] mt-1 leading-relaxed">
                  Harga normal {formatRupiah(ubahSelected.harga_normal)} • modal {formatRupiah(ubahSelected.modal)}
                </p>
              </div>
            </div>
            <div className="bg-[#F5F5F0] rounded-[12px] p-3 mb-4 border border-[#D9D9D9]">
              <p className="text-[16px] text-[#595959]">Harga jual saat ini: {formatRupiah(ubahSelected.harga_tebus)}</p>
              <label htmlFor="input-ubah-harga" className="block text-[16px] font-semibold text-[#1A1A1A] mt-2 mb-1">
                Harga tebus baru
              </label>
              <input
                id="input-ubah-harga"
                type="number"
                inputMode="numeric"
                value={ubahHarga}
                onChange={(e) => { setUbahHarga(e.target.value); if (ubahError) setUbahError(""); }}
                placeholder="Contoh: 12000"
                aria-label="Harga tebus baru"
                className="input input-bordered w-full min-h-[48px] text-[16px] rounded-xl px-3"
                style={{ minHeight: "48px" }}
                data-testid="input-ubah-harga"
              />
              {ubahError ? (
                <p role="alert" data-testid="ubah-harga-error" className="text-[16px] text-[#C62828] mt-1">{ubahError}</p>
              ) : ubahSelected.harga_floor ? (
                <p className="text-[16px] text-[#595959] mt-1">Floor: Rp{ubahSelected.harga_floor.toLocaleString("id-ID")} (HPP×0.85)</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleUbahSimpan}
                className="btn btn-primary w-full min-h-[48px] text-base font-semibold rounded-[12px]"
                style={{ minHeight: "48px", fontSize: "16px" }}
                data-testid="btn-ubah-simpan"
              >
                Simpan Harga
              </button>
              <button
                type="button"
                onClick={handleUbahBatal}
                className="btn btn-outline w-full min-h-[48px] text-base font-semibold rounded-[12px]"
                style={{ minHeight: "48px", fontSize: "16px" }}
                data-testid="btn-ubah-batal"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast toast-center toast-bottom z-40 pb-20 lg:pb-4">
          <div
            role="status"
            data-testid="promo-toast"
            className={`alert ${toastVisible ? "" : "opacity-0"} alert-success shadow-lg transition-opacity`}
          >
            <CheckCircle width={18} height={18} aria-hidden="true" />
            <span className="text-base font-medium">{toast}</span>
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Tutup notifikasi"
              className="btn btn-ghost btn-circle btn-sm shrink-0"
              data-testid="toast-dismiss-x"
            >
              <Xmark width={16} height={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <span className="sr-only" data-testid="badge-active-count">
        {activePromos.length} promo aktif
      </span>
    </section>
  );
}

function PromoCard({ promo, onApprove, onTolak, onViewList, onUbahHarga, isActiveList = false, actions = true }: { promo: Promo; onApprove: () => void; onTolak?: () => void; onViewList?: () => void; onUbahHarga?: () => void; isActiveList?: boolean; actions?: boolean }) {
  const isActive = promo.status === "active";
  const isProposed = promo.status === "proposed";
  const modalText = formatRupiah(promo.modal);
  const tebusText = formatRupiah(promo.harga_tebus);
  const floorText = promo.harga_floor.toLocaleString("id-ID");
  const showGuardrailFail = promo.harga_tebus < promo.harga_floor;

  return (
    <li role="article" aria-label={`Tebus murah ${promo.sku_name} dengan ${promo.sku_pasangan_name}`} className="card card-border bg-base-100" data-testid={isActive ? "promo-card-active" : "promo-card-proposed"} data-promo-id={promo.id} data-status={promo.status}>
      <div className="card-body gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="badge badge-outline badge-sm gap-1">
            <Shop width={12} height={12} aria-hidden="true" />
            Tebus Murah
          </span>
          <span
            className={`badge badge-sm gap-1 ${isActive ? "badge-soft badge-success" : "badge-soft badge-warning"}`}
            data-testid="promo-status-badge"
          >
            {isActive ? (
              <>
                <CheckCircle width={12} height={12} aria-hidden="true" /> Jalan
              </>
            ) : (
              <>
                <Timer width={12} height={12} aria-hidden="true" /> Minta putusan
              </>
            )}
          </span>
        </div>

        <div>
          <p className="card-title text-base leading-snug">
            {promo.sku_name} <span className="font-normal text-base-content/70">• sisa {promo.qty}</span>
          </p>
          <p className="text-sm text-base-content/70 mt-0.5 flex items-center gap-1">
            <Timer width={14} height={14} aria-hidden="true" className="shrink-0" />
            Kedaluwarsa {promo.expiry_date} (H-{promo.daysToExpiry})
          </p>
        </div>

        <div className="bg-base-200 rounded-field p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-base-content/70">
              Modal {modalText}
            </span>
            <span className="text-xs text-base-content/70">
              Normal {formatRupiah(promo.harga_normal)}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1">
            <span className="text-lg font-semibold text-primary" data-testid="harga-tebus">
              Tebus {tebusText}
            </span>
            <span title={`Batas aman Rp${floorText}`} className={`inline-flex items-center gap-1 text-xs ${showGuardrailFail ? "text-error" : "text-base-content/70"}`} data-testid="guardrail-caption">
              {showGuardrailFail ? <WarningCircle width={12} height={12} aria-hidden="true" /> : <CheckCircle width={12} height={12} aria-hidden="true" className="text-success" />}
              {showGuardrailFail ? `Kemurahan — batas Rp${floorText}` : `Masih untung ${formatRupiah(promo.keuntungan_tipis)}`}
            </span>
          </div>
          {showGuardrailFail && (
            <p className="text-xs text-error mt-1" role="alert">
              Harga tebus kelewat murah — minimal Rp{floorText} biar tidak rugi.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-base">
            <span className="font-semibold">Syaratnya beli:</span> {promo.sku_pasangan_name} <span className="text-base-content/70">(laris)</span>
          </p>
          <p className="text-sm text-base-content/70 leading-relaxed">
            <span className="font-medium text-base-content">Kenapa disarankan:</span> “{promo.alasan}”
          </p>
        </div>

        {!actions && onViewList && (
          <div className="card-actions flex-col items-stretch gap-2">
            <button
              type="button"
              onClick={onViewList}
              aria-label={`Lihat promo tebus murah ${promo.sku_name}`}
              className="btn btn-outline btn-block min-h-12 text-base font-semibold"
              data-testid={`promo-lihat-${promo.id}`}
            >
              Lihat
            </button>
          </div>
        )}
        {actions && isProposed && !isActiveList && (
          <div className="card-actions flex-col items-stretch gap-2">
            <button
              type="button"
              onClick={onApprove}
              aria-label={`Setujui tebus murah ${promo.sku_name} dengan ${promo.sku_pasangan_name} harga ${promo.harga_tebus.toLocaleString("id-ID")}`}
              className="btn btn-primary btn-block min-h-12 text-base font-semibold"
              data-testid="btn-setujui-tebus"
            >
              Setujui Tebus Murah
            </button>
            {onTolak && (
              <button
                type="button"
                onClick={onTolak}
                aria-label={`Tolak tebus murah ${promo.sku_name}`}
                className="btn btn-outline btn-block min-h-12 text-base font-semibold"
                data-testid="btn-tolak-promo"
              >
                Tolak
              </button>
            )}
            <button type="button" onClick={onUbahHarga} className="btn btn-ghost btn-block min-h-12 text-base font-semibold" data-testid="btn-ubah-harga">
              Ubah Harga
            </button>
          </div>
        )}
        {isActive && (
          <div
            className="alert alert-success alert-soft py-2.5 text-sm font-medium justify-center"
            data-testid="badge-aktif-hijau"
          >
            <CheckCircle width={16} height={16} aria-hidden="true" /> Sudah jalan di Dashboard
          </div>
        )}
      </div>
    </li>
  );
}

export default PromoAktifList;
