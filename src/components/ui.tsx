import * as React from "react";
import { Shop, Package, WarningCircle, Home, Settings, ShoppingBag } from "iconoir-react";

// ───────── Design tokens — warm warung, brand primary ─────────
// base-200 (warm muted), primary, accent untuk hangat,
// Card rounded-2xl, shadow lembut, spacing lega, Bahasa sederhana.

// ───────── AppButton — konsisten 48px / 16px ─────────
type AppButtonVariant = "primary" | "ghost" | "outline" | "error" | "neutral";
type AppButtonSize = "sm" | "md" | "lg";

export type AppButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
};

const variantClass: Record<AppButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  outline: "btn-outline btn-primary",
  error: "btn-error text-white",
  neutral: "btn-neutral",
};

export function AppButton({
  variant = "primary",
  size = "md",
  fullWidth,
  loading,
  className,
  children,
  disabled,
  ...rest
}: AppButtonProps) {
  const sizeCls = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  return (
    <button
      className={[
        "btn min-h-12 text-base font-semibold",
        variantClass[variant],
        sizeCls,
        fullWidth ? "btn-block" : "",
        className ?? "",
      ].join(" ")}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="loading loading-spinner loading-sm" aria-hidden /> : null}
      {children}
    </button>
  );
}

// ───────── PageHeader ─────────
export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  testId?: string;
};

export function PageHeader({ title, subtitle, icon, action, testId }: PageHeaderProps) {
  return (
    <div data-testid={testId} className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-field">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="text-lg font-bold leading-tight">{title}</h2>
          {subtitle ? <p className="text-base text-base-content/70 mt-0.5 leading-relaxed">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ───────── EmptyState — ramah + ikon ─────────
export type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestId?: string;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionTestId,
  className,
}: EmptyStateProps) {
  return (
    <div className={["card card-border bg-base-100", className ?? ""].join(" ")}>
      <div className="card-body items-center text-center">
        <div className="bg-base-200 text-base-content/70 flex h-14 w-14 items-center justify-center rounded-field">
          {icon ?? <Package width={26} height={26} strokeWidth={1.6} />}
        </div>
        <h3 className="card-title text-base">{title}</h3>
        {description ? <p className="text-base text-base-content/70 leading-relaxed max-w-sm">{description}</p> : null}
        {actionLabel && onAction ? (
          <div className="card-actions mt-2">
            <AppButton variant="primary" onClick={onAction} data-testid={actionTestId}>
              {actionLabel}
            </AppButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ───────── StatCard ─────────
export type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "neutral";
  className?: string;
};

export function StatCard({ label, value, subtitle, icon, variant = "default", className }: StatCardProps) {
  const iconBg =
    variant === "success"
      ? "bg-success/10 text-success"
      : variant === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-base-200 text-base-content/70";

  return (
    <div className={["card card-border bg-base-100", className ?? ""].join(" ")}>
      <div className="card-body flex-row items-center gap-3 p-4">
        {icon ? (
          <div className={["flex h-10 w-10 shrink-0 items-center justify-center rounded-field", iconBg].join(" ")}>
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="stat-title truncate">{label}</p>
          <p className="stat-value text-2xl truncate">{value}</p>
          {subtitle ? <p className="stat-desc line-clamp-2 leading-relaxed">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

// ───────── BadgeKritis — konsisten dengan Badge.tsx ─────────
export type BadgeKritisProps = {
  days: number | null;
  qty?: number;
  expiryDate?: string;
  className?: string;
};

function badgeClass(days: number): string {
  if (days <= 1) return "badge-error";
  if (days <= 3) return "badge-warning";
  return "badge-info";
}

export function BadgeKritis({ days, qty, expiryDate, className }: BadgeKritisProps) {
  if (days === null || days === undefined) return null;
  const aria = expiryDate ? `H-${days}, ${qty ?? ""} pcs, kadaluarsa ${expiryDate}` : `H-${days} kritis`;
  return (
    <span
      role="status"
      aria-label={aria}
      className={["badge badge-sm gap-1 font-semibold", badgeClass(days), className ?? ""].join(" ")}
    >
      <WarningCircle width={12} height={12} aria-hidden />
      H-{days}
    </span>
  );
}

// Convenience re-export icon set for shell so App.tsx tidak perlu import banyak
export const WarungIcons = {
  Shop,
  Package,
  Home,
  Settings,
  ShoppingBag,
  WarningCircle,
};
