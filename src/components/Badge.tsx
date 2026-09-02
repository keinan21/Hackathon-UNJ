import { WarningCircle } from "iconoir-react";

export type BadgeProps = {
  daysToExpiry: number | null;
  qty: number;
  expiryDate: string;
  showIcon?: boolean;
  className?: string;
};

// Sinkron dengan BatchCard VARIANT_STYLES — DESIGN.md token: danger #C62828, warning #EF6C00, caution #F9A825, safe #4edea3
function getBadgeStyle(days: number): { bg: string; color: string } {
  if (days <= 1) return { bg: "#C62828", color: "#FFFFFF" }; // danger
  if (days <= 3) return { bg: "#EF6C00", color: "#1A1A1A" }; // warning
  if (days <= 7) return { bg: "#F9A825", color: "#1A1A1A" }; // caution
  // safe fallback for >7 (tidak tampil di urgent, tapi sinkron dengan BatchCard safe)
  return { bg: "#4edea3", color: "#1A1A1A" };
}

export function Badge({ daysToExpiry, qty, expiryDate, showIcon = true, className }: BadgeProps) {
  if (daysToExpiry === null || daysToExpiry === undefined) return null;

  const { bg, color } = getBadgeStyle(daysToExpiry);
  const ariaLabel = `Stok mepet H-${daysToExpiry}, ${qty} pcs, kadaluarsa ${expiryDate}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`badge gap-1 border-none font-semibold ${className ?? ""}`}
      style={{
        backgroundColor: bg,
        color,
        fontSize: "14px",
        padding: "4px 10px",
        height: "24px",
        borderRadius: "8px",
      }}
    >
      {showIcon && <WarningCircle width={14} height={14} aria-hidden="true" style={{ flexShrink: 0 }} />}
      H-{daysToExpiry}
    </span>
  );
}

export default Badge;
