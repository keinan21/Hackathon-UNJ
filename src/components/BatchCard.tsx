export type BatchCardVariant = "danger" | "warning" | "caution" | "safe";

export type BatchCardProps = {
  batchId: string;
  skuName: string;
  qty: number;
  expiryDate: string | null;
  daysToExpiry: number | null;
  urgencyScore?: number;
  variant: BatchCardVariant;
  onAction?: () => void;
  actionLabel?: string;
  showProgress?: boolean;
};

const VARIANT_STYLES: Record<
  BatchCardVariant,
  { bar: string; badge: string }
> = {
  danger: { bar: "bg-danger", badge: "bg-danger text-white" },
  warning: { bar: "bg-warning", badge: "bg-warning text-black" },
  caution: { bar: "bg-caution", badge: "bg-caution text-black" },
  safe: { bar: "bg-safe", badge: "bg-safe text-black" },
};

function formatExpiryLabel(expiryDate: string | null): string {
  if (!expiryDate) return "Tanpa kadaluarsa";
  const [y, m, d] = expiryDate.split("-").map(Number);
  if (!y || !m || !d) return `Kadaluarsa: ${expiryDate}`;
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const mm = months[m - 1] ?? String(m);
  return `Kadaluarsa: ${String(d).padStart(2, "0")} ${mm} ${y}`;
}

function getBadgeLabel(variant: BatchCardVariant, days: number | null): string {
  if (variant === "safe" || days === null) return "Aman";
  return `H-${days}`;
}

export function BatchCard({
  batchId,
  skuName,
  qty,
  expiryDate,
  daysToExpiry,
  urgencyScore,
  variant,
  onAction,
  actionLabel,
  showProgress = false,
}: BatchCardProps) {
  const styles = VARIANT_STYLES[variant];
  const ariaLabel =
    daysToExpiry === null
      ? `${skuName}, ${qty} pcs, ${expiryDate ? `kadaluarsa ${expiryDate}` : "tanpa kadaluarsa"}`
      : `Stok mepet H-${daysToExpiry}, ${qty} pcs, kadaluarsa ${expiryDate ?? "-"}`;

  const badgeLabel = getBadgeLabel(variant, daysToExpiry);
  const expiryLabel = formatExpiryLabel(expiryDate);

  return (
    <div
      role="article"
      aria-label={ariaLabel}
      className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md shadow-sm flex items-center justify-between relative overflow-hidden"
    >
      {/* stress bar w-1 persis ui-docs dashboard */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.bar}`} aria-hidden="true" />

      {/* kiri */}
      <div className="flex flex-col gap-xs pl-sm min-w-0">
        <span className="font-headline-md text-headline-md text-primary text-base truncate">
          {skuName}
        </span>
        <span className="font-data-mono text-data-mono text-slate-gray">
          ID Batch: #{batchId}
        </span>
        <span className="font-body-md text-body-md text-slate-gray">
          {expiryLabel}
        </span>
      </div>

      {/* kanan */}
      <div className="flex flex-col items-end gap-xs shrink-0">
        <span
          role="status"
          aria-label={ariaLabel}
          className={`font-data-mono text-data-mono px-2 py-1 rounded-DEFAULT ${styles.badge}`}
        >
          {badgeLabel}
        </span>
        {typeof urgencyScore === "number" && (
          <span className="font-label-caps text-label-caps text-slate-gray">
            Skor: {Math.round(urgencyScore)}
          </span>
        )}
      </div>

      {/* optional progress - only for katalog detail, not dashboard stok mepet */}
      {showProgress ? (
        <div className="sr-only" aria-hidden="true" />
      ) : null}
      {onAction ? (
        <span className="sr-only">
          <button type="button" onClick={onAction} aria-label={actionLabel ?? `Lihat saran tebus untuk ${skuName}`} tabIndex={-1} />
        </span>
      ) : null}
    </div>
  );
}

export default BatchCard;
