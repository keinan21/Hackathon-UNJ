import * as React from "react";
import { Shop, Package, WarningCircle, Home, Settings, ShoppingBag } from "iconoir-react";

// ───────── Design tokens — warm warung, brand #0F7A4A tetap ─────────
// Cream #F5F5F0 (base-200), primary #0F7A4A, accent amber #F59E0B untuk hangat,
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
        "btn rounded-xl font-semibold normal-case",
        "min-h-[48px] text-[16px]",
        "shadow-sm hover:shadow-md transition-shadow",
        variantClass[variant],
        sizeCls,
        fullWidth ? "w-full" : "",
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
    <div
      data-testid={testId}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="text-xl font-bold text-neutral leading-tight">{title}</h2>
          {subtitle ? <p className="text-sm text-[#595959] mt-0.5 leading-relaxed">{subtitle}</p> : null}
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
    <div
      className={[
        "card bg-base-100 rounded-2xl shadow-sm border border-base-300/50",
        "p-8 text-center flex flex-col items-center",
        className ?? "",
      ].join(" ")}
    >
      <div className="w-16 h-16 rounded-2xl bg-[#FFF8E1] border border-[#FFE082]/60 flex items-center justify-center text-[#8D6E63] mb-4">
        {icon ?? <Package width={28} height={28} strokeWidth={1.6} />}
      </div>
      <h3 className="text-base font-bold text-neutral">{title}</h3>
      {description ? (
        <p className="text-sm text-[#595959] mt-1.5 leading-relaxed max-w-sm">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <AppButton
          variant="primary"
          className="mt-5"
          onClick={onAction}
          data-testid={actionTestId}
        >
          {actionLabel}
        </AppButton>
      ) : null}
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
  const variantBg =
    variant === "success"
      ? "bg-[#E8F5E9] border-[#A5D6A7]/60 text-[#1B5E20]"
      : variant === "warning"
        ? "bg-[#FFF3E0] border-[#FFCC80]/60 text-[#E65100]"
        : variant === "neutral"
          ? "bg-base-200 border-base-300 text-neutral"
          : "bg-base-100 border-base-300/50 text-neutral";

  return (
    <div
      className={[
        "card rounded-2xl shadow-sm border p-4 flex flex-row items-center gap-3",
        variantBg,
        className ?? "",
      ].join(" ")}
    >
      {icon ? (
        <div className="w-10 h-10 rounded-xl bg-white/80 border border-base-300/40 flex items-center justify-center shrink-0">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide opacity-70 uppercase truncate">{label}</p>
        <p className="text-xl font-extrabold leading-none mt-1 truncate">{value}</p>
        {subtitle ? <p className="text-xs opacity-70 mt-1 line-clamp-2 leading-relaxed">{subtitle}</p> : null}
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

function badgeStyle(days: number): { bg: string; color: string } {
  if (days <= 1) return { bg: "#C62828", color: "#FFFFFF" };
  if (days <= 3) return { bg: "#EF6C00", color: "#FFFFFF" };
  if (days <= 7) return { bg: "#F9A825", color: "#1A1A1A" };
  return { bg: "#D9D9D9", color: "#1A1A1A" };
}

export function BadgeKritis({ days, qty, expiryDate, className }: BadgeKritisProps) {
  if (days === null || days === undefined) return null;
  const { bg, color } = badgeStyle(days);
  const aria = expiryDate ? `H-${days}, ${qty ?? ""} pcs, kadaluarsa ${expiryDate}` : `H-${days} kritis`;
  return (
    <span
      role="status"
      aria-label={aria}
      className={["badge gap-1 border-none font-bold rounded-full", className ?? ""].join(" ")}
      style={{
        backgroundColor: bg,
        color,
        fontSize: 12,
        padding: "2px 10px",
        height: 24,
      }}
    >
      <WarningCircle width={12} height={12} aria-hidden style={{ flexShrink: 0 }} />
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
