import { WarningCircle } from "iconoir-react";

export type BadgeProps = {
  daysToExpiry: number | null;
  qty: number;
  expiryDate: string;
  showIcon?: boolean;
  className?: string;
};

function getBadgeStyle(days: number): { bg: string; color: string } {
  if (days <= 1) return { bg: "#C62828", color: "#FFFFFF" };
  if (days <= 3) return { bg: "#EF6C00", color: "#1A1A1A" };
  if (days <= 7) return { bg: "#F9A825", color: "#1A1A1A" };
  // fallback for >7 should not be shown, but provide muted
  return { bg: "#D9D9D9", color: "#1A1A1A" };
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
