import { daysToExpiry } from "../../engine/expiry";
import type { Batch } from "../../db/db";

export type RiskLevel = "danger" | "warning" | "caution" | "safe" | "neutral";

function getRiskLevel(days: number | null): RiskLevel {
  if (days === null) return "safe";
  if (days <= 1) return "danger";
  if (days <= 3) return "warning";
  if (days <= 7) return "caution";
  return "safe";
}

function riskBorderClass(level: RiskLevel): string {
  switch (level) {
    case "danger":
      return "border-l-danger";
    case "warning":
      return "border-l-warning";
    case "caution":
      return "border-l-caution";
    case "safe":
      return "border-l-safe";
    default:
      return "border-l-border";
  }
}

function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case "danger":
      return "bg-danger text-white";
    case "warning":
      return "bg-warning text-black";
    case "caution":
      return "bg-caution text-black";
    case "safe":
      return "bg-safe text-black border border-safe/30";
    default:
      return "bg-surface-container text-slate-gray";
  }
}

function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return "Tanpa kadaluarsa";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  // Format Indonesia: 15 Okt 2023
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StressBar({ level }: { level: RiskLevel }) {
  // Segmented seperti ui-docs: h-1.5 flex
  if (level === "danger") {
    return (
      <div className="w-full h-1.5 bg-surface-container rounded-full mt-2 overflow-hidden flex">
        <div className="h-full bg-danger w-full" />
      </div>
    );
  }
  if (level === "warning") {
    return (
      <div className="w-full h-1.5 bg-surface-container rounded-full mt-2 overflow-hidden flex">
        <div className="h-full bg-warning w-full" />
      </div>
    );
  }
  if (level === "caution") {
    return (
      <div className="w-full h-1.5 bg-surface-container rounded-full mt-2 overflow-hidden flex">
        <div className="h-full bg-surface-container w-[20%]" />
        <div className="h-full bg-caution w-[80%]" />
      </div>
    );
  }
  // safe / neutral
  return (
    <div className="w-full h-1.5 bg-surface-container rounded-full mt-2 overflow-hidden flex">
      <div className="h-full bg-surface-container w-[80%]" />
      <div className="h-full bg-safe w-[20%]" />
    </div>
  );
}

export interface BatchRowsProps {
  batches: Batch[];
}

export function BatchRows({ batches }: BatchRowsProps) {
  if (batches.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-white border border-border rounded-xl p-6 text-center flex flex-col items-center gap-3"
        data-testid="empty-batch-per-sku"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <span className="material-symbols-outlined text-[#595959]" style={{ fontSize: 48 }} aria-hidden="true">
          package_2
        </span>
        <p className="font-body-md text-body-md text-text-primary leading-relaxed" style={{ fontSize: "16px", color: "#1A1A1A" }}>
          Belum ada stok fisik untuk SKU ini. Tap Tambah Batch untuk isi qty dan tanggal.
        </p>
        <button
          type="button"
          aria-label="Tambah Batch untuk SKU ini"
          onClick={() => window.dispatchEvent(new CustomEvent("batch:tambah", { detail: { skuId: "unknown" } }))}
          className="min-h-[48px] w-full px-6 py-3 bg-primary text-white font-body-md text-body-md rounded-xl hover:bg-primary-pressed active:bg-primary-pressed transition-colors font-semibold"
          style={{ minHeight: "48px", fontSize: "16px" }}
        >
          Tambah Batch
        </button>
      </div>
    );
  }

  return (
    <>
      {batches.map((batch) => {
        const days = daysToExpiry(batch.expiry_date);
        const level = getRiskLevel(days);
        const border = riskBorderClass(level);
        const badgeCls = riskBadgeClass(level);
        const badgeLabel =
          days === null
            ? "Aman"
            : level === "safe"
              ? "Aman"
              : `H-${days}`;

        const ariaLabel =
          days === null
            ? `Batch aman, ${batch.qty} pcs, tanpa kadaluarsa`
            : `Batch H-${days}, ${batch.qty} pcs, kadaluarsa ${formatExpiry(batch.expiry_date)}`;

        return (
          <div
            key={batch.id}
            className={`flex items-center justify-between p-3 bg-surface-container-lowest border border-border rounded-lg border-l-4 ${border}`}
          >
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="font-data-mono text-data-mono text-primary">
                  Batch #{batch.id ? `B-${String(batch.id).padStart(4, "0")}` : `B-${batch.sku_id}`}
                </span>
                <span aria-label={ariaLabel} className={`font-label-caps text-label-caps px-2 py-1 rounded ${badgeCls}`}>
                  {badgeLabel}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="font-body-md text-body-md text-slate-gray">
                  Qty: <strong className="text-primary">{batch.qty} pcs</strong>
                </span>
                <span
                  className={`font-body-md text-body-md ${level === "danger" || level === "warning" ? "text-text-primary font-semibold" : "text-slate-gray"}`}
                >
                  Kadaluarsa: {formatExpiry(batch.expiry_date)}
                </span>
              </div>
              <StressBar level={level} />
            </div>
          </div>
        );
      })}
    </>
  );
}

export { getRiskLevel, riskBorderClass, riskBadgeClass, formatExpiry };
