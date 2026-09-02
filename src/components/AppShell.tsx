import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  /** narrow = dashboard/advisor (max-w-3xl), wide = katalog (max-w-7xl) */
  variant?: "narrow" | "wide";
};

export function AppShell({ children, variant = "narrow" }: AppShellProps) {
  const maxW = variant === "wide" ? "max-w-7xl" : "max-w-3xl";
  const bg = variant === "wide" ? "bg-surface-muted" : "bg-background";
  const padBottom = variant === "wide" ? "pb-24 md:pb-0 md:pt-16" : "pb-24 md:pb-8";
  return (
    <div className={`flex min-h-screen flex-col items-center ${bg} pt-16 ${padBottom} text-on-background font-body-md`}>
      <main className={`flex w-full ${maxW} flex-1 flex-col gap-lg px-margin-mobile`}>{children}</main>
    </div>
  );
}

/** Fluid grid: mobile 4 cols, desktop 12 cols */
export function ShellGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid w-full grid-cols-4 gap-gutter-mobile md:grid-cols-12 md:gap-lg ${className}`}>{children}</div>;
}
