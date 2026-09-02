// AdvisorCard — hi-fi 1:1 dari ui-docs/ai-advisor.html (180 lines)
// Ref: docs/design.md Flow 1-Tap Approve & Kartu Promo, AGENTS.md tokens
// Crew A — Frontend owns this file, angka dari DB / props, bukan dari LLM

export type AdvisorCardVariant = "danger" | "warning";

export type AdvisorCardProps = {
  batchName: string;
  qty: number;
  expiryLabel: string; // e.g. "25 Okt" | "Besok" | "2026-09-02"
  daysToExpiry: number;
  variant: AdvisorCardVariant;
  confidence: number; // 0-100
  pasanganName: string;
  pasanganLabel: string; // "Barang Laris" | "Stok Stabil"
  hargaTebus: number;
  hpp: number;
  guardrailFloor?: number; // default hpp*0.85
  marginPct?: number; // e.g. 12 → "+12%" ; if omitted compute from hargaTebus/hpp
  narrative: string;
  onApprove: () => void;
  onEdit?: () => void;
  /** aria-label override for Setujui CTA; if omitted auto-generates */
  approveAriaLabel?: string;
};

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function confidenceText(n: number): string {
  return `${Math.round(n)}% Confidence`;
}

export function AdvisorCard({
  batchName,
  qty,
  expiryLabel,
  daysToExpiry,
  variant,
  confidence,
  pasanganName,
  pasanganLabel,
  hargaTebus,
  hpp,
  guardrailFloor,
  marginPct,
  narrative,
  onApprove,
  onEdit,
  approveAriaLabel,
}: AdvisorCardProps) {
  const floor = guardrailFloor ?? Math.round(hpp * 0.85);
  const isGuardrailFail = hargaTebus < floor;
  const margin =
    marginPct !== undefined
      ? marginPct
      : hpp > 0
        ? Math.round(((hargaTebus - hpp) / hpp) * 100)
        : 0;
  const marginLabel = `${margin >= 0 ? "+" : ""}${margin}%`;

  const isDanger = variant === "danger";
  // Pill label: exact hi-fi copy — danger => Kritis (H-1), warning => H-3 Menuju Kadaluarsa (or H-n)
  const pillLabel = isDanger ? `Kritis (H-${daysToExpiry})` : `H-${daysToExpiry} Menuju Kadaluarsa`;
  const pillIcon = isDanger ? "error" : "warning";

  const articleLabel = `Saran tebus murah ${batchName} H-${daysToExpiry}`;
  const ctaLabel =
    approveAriaLabel ?? `Setujui tebus murah ${batchName} dengan ${pasanganName} harga ${hargaTebus}`;

  return (
    <article
      role="article"
      aria-label={articleLabel}
      className={`bg-surface-container-lowest border rounded-xl shadow-sm overflow-hidden flex flex-col relative transition-colors hover:border-primary/20 ${isGuardrailFail ? "border-danger" : "border-border-subtle"}`}
      data-testid="advisor-card"
      data-variant={variant}
      data-days={daysToExpiry}
    >
      {/* Stress Bar — w-1 bg-variant full height */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${isDanger ? "bg-danger" : "bg-warning"}`}
        aria-hidden="true"
      />

      <div className="p-md pl-lg">
        {/* Top row: pill + confidence */}
        <div className="flex justify-between items-start mb-md gap-sm">
          <div
            className={`flex items-center gap-sm px-2 py-1 rounded-full font-label-caps text-label-caps shrink-0 ${isDanger ? "bg-danger text-white" : "bg-warning text-black"}`}
            data-testid="advisor-pill"
          >
            <span className="material-symbols-outlined text-[16px]" data-icon={pillIcon} aria-hidden="true">
              {pillIcon}
            </span>
            {pillLabel}
          </div>
          <div
            className="bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim px-2 py-1 rounded-full flex items-center gap-xs shrink-0"
            data-testid="advisor-confidence"
          >
            <span className="material-symbols-outlined text-[14px]" data-icon="bolt" aria-hidden="true">
              bolt
            </span>
            <span className="font-data-mono text-data-mono">{confidenceText(confidence)}</span>
          </div>
        </div>

        {/* Grid 2 cols: Batch Sasaran vs Pasangan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md mb-md">
          <div className="bg-surface-container-low p-sm rounded-lg border border-border-subtle/50 min-w-0">
            <span className="text-slate-gray font-label-caps text-label-caps block mb-xs">Batch Sasaran</span>
            <div className="font-data-mono text-data-mono text-primary truncate" title={batchName}>
              {batchName}
            </div>
            <div className="text-slate-gray text-[12px]">Qty: {qty} | Kadaluarsa: {expiryLabel}</div>
          </div>
          <div className="bg-surface-container-low p-sm rounded-lg border border-border-subtle/50 min-w-0">
            <span className="text-slate-gray font-label-caps text-label-caps block mb-xs">Pasangan Disarankan</span>
            <div className="font-data-mono text-data-mono text-primary truncate" title={pasanganName}>
              {pasanganName}
            </div>
            <div className="text-slate-gray text-[12px]">{pasanganLabel}</div>
          </div>
        </div>

        {/* Financials */}
        <div
          className={`flex items-center justify-between rounded-lg p-sm mb-md ${isGuardrailFail ? "bg-error-bg border border-danger/40" : "bg-primary-fixed/30"}`}
          data-testid="advisor-financials"
        >
          <div className="min-w-0">
            <span className="text-slate-gray font-label-caps text-label-caps block">Harga Tebus</span>
            <div className="font-data-mono text-data-mono text-primary text-base" data-testid="harga-tebus">
              {formatRp(hargaTebus)}
            </div>
            <span
              className={`text-[12px] block mt-1 ${isGuardrailFail ? "text-danger font-medium" : "text-slate-gray"}`}
              data-testid="guardrail-caption"
            >
              Guardrail: {formatRp(hargaTebus)} ≥ {formatRp(floor)} (HPP×0.85)
            </span>
            <span className="text-[14px] text-slate-gray block">HPP: {formatRp(hpp)}</span>
            {isGuardrailFail && (
              <span className="text-[12px] text-danger block mt-1 font-medium" role="alert">
                Harga tebus tidak boleh di bawah HPP × 0.85 (Rp {floor.toLocaleString("id-ID")})
              </span>
            )}
          </div>
          <div className="text-right shrink-0 ml-3">
            <span className="text-slate-gray font-label-caps text-label-caps block">Estimasi Margin</span>
            <div
              className="font-data-mono text-data-mono text-tertiary-fixed-dim"
              data-testid="advisor-margin"
              style={{ color: isGuardrailFail ? "#C62828" : undefined }}
            >
              {marginLabel}
            </div>
          </div>
        </div>

        {/* AI Narrative */}
        <div className="bg-surface-container p-sm rounded-lg flex gap-sm items-start mb-md" data-testid="advisor-narrative">
          <span
            className="material-symbols-outlined text-primary mt-xs text-[18px] shrink-0"
            data-icon="psychology"
            aria-hidden="true"
          >
            psychology
          </span>
          <p
            className="font-body-md text-body-md text-on-surface-variant"
            style={{ fontSize: "14px", lineHeight: "20px" }}
          >
            {narrative}
          </p>
        </div>

        {/* Actions — 2 CTA 48px */}
        <div className="flex gap-sm">
          <button
            type="button"
            onClick={onApprove}
            disabled={isGuardrailFail}
            aria-label={ctaLabel}
            className={`flex-1 min-h-[48px] font-body-md text-body-md py-3 px-5 rounded-lg flex items-center justify-center gap-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isGuardrailFail
                ? "bg-[#9E9E9E] text-white cursor-not-allowed"
                : "bg-primary text-on-primary hover:bg-primary-pressed"
            }`}
            style={{ minHeight: "48px", fontSize: "16px" }}
            data-testid="btn-setujui-tebus"
          >
            <span className="material-symbols-outlined text-[18px]" data-icon="check_circle" aria-hidden="true">
              check_circle
            </span>
            Setujui Tebus Murah
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Ubah harga tebus ${batchName}`}
            className="min-h-[48px] min-w-[48px] px-4 border border-outline text-primary font-body-md text-body-md py-3 rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center"
            style={{ minHeight: "48px", minWidth: "48px", fontSize: "16px" }}
            data-testid="btn-ubah-harga"
          >
            <span className="material-symbols-outlined text-[18px]" data-icon="edit" aria-hidden="true">
              edit
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default AdvisorCard;
