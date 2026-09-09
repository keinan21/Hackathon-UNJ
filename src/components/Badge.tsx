import { WarningCircle } from "iconoir-react";

export type BadgeProps = {
  daysToExpiry: number | null;
  qty: number;
  expiryDate: string;
  showIcon?: boolean;
  className?: string;
};

function getBadgeClass(days: number): string {
  if (days <= 1) return "badge-error";
  if (days <= 3) return "badge-warning";
  return "badge-info";
}

export function Badge({ daysToExpiry, qty, expiryDate, showIcon = true, className }: BadgeProps) {
  if (daysToExpiry === null || daysToExpiry === undefined) return null;

  const ariaLabel = `Stok mepet H-${daysToExpiry}, ${qty} pcs, kadaluarsa ${expiryDate}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`badge badge-sm gap-1 font-semibold ${getBadgeClass(daysToExpiry)} ${className ?? ""}`}
    >
      {showIcon && <WarningCircle width={14} height={14} aria-hidden="true" />}
      H-{daysToExpiry}
    </span>
  );
}

export default Badge;
