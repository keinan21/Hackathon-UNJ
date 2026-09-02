type View = "dashboard" | "sku" | "batch" | "promo" | "settings";

type NavItem = {
  id: View;
  label: string;
  icon: string;
  ariaLabel: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", ariaLabel: "Ke halaman Dashboard" },
  { id: "sku", label: "SKU", icon: "inventory", ariaLabel: "Ke halaman SKU" },
  { id: "batch", label: "Batch", icon: "inventory_2", ariaLabel: "Ke halaman Batch" },
  { id: "promo", label: "Promo", icon: "local_offer", ariaLabel: "Ke halaman Promo" },
  { id: "settings", label: "Pengaturan", icon: "settings", ariaLabel: "Ke halaman Pengaturan" },
];

export function BottomNav({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-0 left-0 z-50 flex h-14 w-full items-center justify-around border-t border-border-subtle bg-surface px-2 py-1 shadow-sm md:hidden"
    >
      {NAV_ITEMS.map((tab) => {
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={active ? "page" : undefined}
            aria-label={active ? `${tab.ariaLabel} aktif` : tab.ariaLabel}
            data-testid={`nav-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={
              active
                ? "flex min-h-[48px] min-w-[48px] flex-col items-center justify-center rounded-xl bg-primary/10 px-3 py-1 font-bold text-primary"
                : "flex min-h-[48px] min-w-[48px] flex-col items-center justify-center px-3 py-1 text-slate-gray transition-colors hover:text-primary"
            }
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              aria-hidden="true"
            >
              {tab.icon}
            </span>
            <span className="font-label-caps text-label-caps mt-1">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
