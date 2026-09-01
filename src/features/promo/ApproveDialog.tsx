import { useEffect, useRef } from "react";
import { WarningCircle, CheckCircle } from "iconoir-react";
import type { Promo } from "./promo.types";
import { formatRupiah } from "./promo.types";

export type ApproveDialogProps = {
  open: boolean;
  promo: Promo | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ApproveDialog({ open, promo, onConfirm, onCancel }: ApproveDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap + Esc + initial focus
  useEffect(() => {
    if (!open) return;
    // Focus confirm button on open (primary action)
    const id = setTimeout(() => confirmBtnRef.current?.focus(), 30);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (last as HTMLElement).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          (first as HTMLElement).focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    // Prevent scroll behind
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open || !promo) return null;

  const hargaTebusFormatted = promo.harga_tebus.toLocaleString("id-ID"); // 9.000
  // Guardrail view only — floor from Repository, not computed here beyond display
  const floorFormatted = promo.harga_floor.toLocaleString("id-ID"); // 8.500
  const modalFormatted = promo.modal.toLocaleString("id-ID");
  const isGuardrailFail = promo.harga_tebus < promo.harga_floor;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-hidden={!open}
      data-testid="approve-dialog-backdrop"
    >
      {/* Backdrop */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-dialog-title"
        aria-describedby="approve-dialog-desc"
        className="relative w-full max-w-[480px] bg-white rounded-[12px] p-5 border border-[#D9D9D9] max-h-[90vh] overflow-auto"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header icon + title */}
        <div className="flex items-start gap-3 mb-3">
          <span className="shrink-0 w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center">
            <CheckCircle width={20} height={20} className="text-[#0F7A4A]" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <h3
              id="approve-dialog-title"
              className="text-[18px] font-bold text-[#1A1A1A] leading-tight"
              style={{ fontSize: "18px" }}
            >
              Yakin setujui tebus murah {promo.sku_name} + {promo.sku_pasangan_name} harga {hargaTebusFormatted}?
            </h3>
            <p id="approve-dialog-desc" className="text-[16px] text-[#595959] mt-1 leading-relaxed">
              Promo akan aktif dan tampil di Dashboard & badge SKU.
            </p>
          </div>
        </div>

        {/* Pricing review — read-only view */}
        <div className="bg-[#F5F5F0] rounded-[12px] p-3 mb-4 border border-[#D9D9D9]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[14px] text-[#595959]" style={{ fontSize: "14px" }}>
              Modal {formatRupiah(promo.modal)}
            </span>
            <span className="text-[14px] text-[#595959]">{modalFormatted} • Harga normal {formatRupiah(promo.harga_normal)}</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[18px] font-semibold text-[#0F7A4A]" style={{ fontSize: "18px", fontWeight: 600 }}>
              Tebus {formatRupiah(promo.harga_tebus)}
            </span>
            <span
              title={`HPP*0.85=${floorFormatted}`}
              className="text-[12px] text-[#595959] inline-flex items-center gap-1"
              style={{ fontSize: "12px" }}
            >
              <CheckCircle width={12} height={12} aria-hidden="true" className="text-[#0F7A4A]" />
              Untung tipis {formatRupiah(promo.keuntungan_tipis)}
            </span>
          </div>
          {isGuardrailFail ? (
            <p className="text-[14px] text-[#C62828] mt-2" role="alert" style={{ fontSize: "14px" }}>
              Harga tebus tidak boleh di bawah HPP x 0.85 (Rp {floorFormatted}). Naikkan harga.
            </p>
          ) : (
            <p className="text-[12px] text-[#595959] mt-1" style={{ fontSize: "12px" }}>
              Lolos guardrail — floor Rp {floorFormatted} (HPP*0.85)
            </p>
          )}
          <div className="mt-2 text-[14px] text-[#1A1A1A]" style={{ fontSize: "14px" }}>
            <span className="font-semibold">Pasangan:</span> {promo.sku_pasangan_name} • {promo.alasan}
          </div>
        </div>

        {/* Actions — Full width 48px each */}
        <div className="flex flex-col gap-2">
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isGuardrailFail}
            aria-label={`Yakin setujui tebus murah ${promo.sku_name} dengan ${promo.sku_pasangan_name} harga ${hargaTebusFormatted}`}
            className="btn btn-primary w-full min-h-[48px] text-base font-semibold rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              minHeight: "48px",
              fontSize: "16px",
              backgroundColor: isGuardrailFail ? "#9E9E9E" : "#0F7A4A",
              color: "#FFFFFF",
              border: "none",
              boxShadow: "none",
            }}
            data-testid="dialog-confirm-yakin"
          >
            {isGuardrailFail ? (
              "Tidak bisa setujui — di bawah floor"
            ) : (
              <>
                <CheckCircle width={18} height={18} aria-hidden="true" /> Yakin
              </>
            )}
          </button>
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            aria-label="Batalkan persetujuan"
            className="btn btn-outline w-full min-h-[48px] text-base font-semibold rounded-[12px]"
            style={{
              minHeight: "48px",
              fontSize: "16px",
              borderColor: "#D9D9D9",
              color: "#1A1A1A",
              backgroundColor: "#FFFFFF",
              borderWidth: "1px",
            }}
            data-testid="dialog-cancel-batal"
          >
            Batal
          </button>
        </div>

        {/* Subtle hint for a11y */}
        <p className="sr-only">Tekan Escape untuk batal, Tab untuk navigasi fokus trap.</p>

        {/* Non-visual floor guardrail for audit */}
        <span className="sr-only" title={`HPP*0.85=${promo.harga_floor}`}>
          floor {promo.harga_floor}
        </span>
      </div>
    </div>
  );
}

export default ApproveDialog;
