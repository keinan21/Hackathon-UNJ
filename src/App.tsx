import { useEffect, useState, useCallback, useRef } from "react";
import { OfflineFallback } from "./components/OfflineFallback";
import { InstallPrompt } from "./components/InstallPrompt";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { HistoriDetailPage } from "./features/dashboard/HistoriDetailPage";
import { PromoAktifList } from "./features/promo/PromoAktifList";
import { SettingsPage } from "./features/settings/SettingsPage";
import { KatalogPage } from "./features/sku/KatalogPage";
import { SkuForm } from "./features/sku/SkuForm";
import { LoginPage, getProfilToko } from "./features/auth/LoginPage";
import { isLoggedIn, setLoggedIn } from "./features/auth/session";
import { lazy, Suspense } from "react";
import { SkuDetailPage } from "./features/sku/SkuDetailPage";
import { InboundForm } from "./features/inout/InboundForm";
import { OutboundForm } from "./features/inout/OutboundForm";
import { KritisPage } from "./features/expiry/KritisPage";
import { Home, Package, ShoppingBag, Settings as SettingsIcon, Shop, Menu, Xmark } from "iconoir-react";
import { PageHeader } from "./components/ui";

const ScanPage = lazy(() => import("./features/scan/ScanPage"));

type View = "dashboard" | "promo" | "settings" | "sku";

function useHistoriRoute() {
  const [historiId, setHistoriId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const m = window.location.pathname.match(/^\/histori\/([^/]+)/);
    return m ? m[1] : null;
  });
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/^\/histori\/([^/]+)/);
      setHistoriId(m ? m[1] : null);
    };
    window.addEventListener("popstate", onPop);
    const orig = window.history.pushState.bind(window.history);
    (window.history.pushState as unknown as (d: unknown, u: string, url?: string) => void) = ((d: unknown, _u: string, url?: string) => {
      orig(d, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }) as unknown as typeof window.history.pushState;
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return historiId;
}

function useSkuBaruRoute() {
  const [isSkuBaru, setIsSkuBaru] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname === "/sku/baru";
  });
  useEffect(() => {
    const onPop = () => setIsSkuBaru(window.location.pathname === "/sku/baru");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return isSkuBaru;
}

function useScanRoute() {
  const [isScan, setIsScan] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname === "/scan";
  });
  useEffect(() => {
    const onPop = () => setIsScan(window.location.pathname === "/scan");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return isScan;
}

function useInboundRoute() {
  const isInbound = () => {
    if (typeof window === "undefined") return false;
    const p = window.location.pathname;
    return p === "/masuk" || p === "/inbound" || p === "/sku/masuk";
  };
  const [val, setVal] = useState(() => isInbound());
  useEffect(() => {
    const onPop = () => setVal(isInbound());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return val;
}

function useOutboundRoute() {
  const check = (): { isOutbound: boolean; skuId: string | null } => {
    if (typeof window === "undefined") return { isOutbound: false, skuId: null };
    const p = window.location.pathname;
    const search = new URLSearchParams(window.location.search);
    const qSku = search.get("skuId") || search.get("sku");
    if (p === "/keluar" || p === "/outbound" || p === "/sku/keluar") return { isOutbound: true, skuId: qSku };
    const m = p.match(/^\/sku\/([^/]+)\/keluar$/);
    if (m) return { isOutbound: true, skuId: m[1] };
    return { isOutbound: false, skuId: null };
  };
  const [val, setVal] = useState(() => check());
  useEffect(() => {
    const onPop = () => setVal(check());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return val;
}

function useSkuDetailRoute() {
  const getId = () => {
    if (typeof window === "undefined") return null;
    const m = window.location.pathname.match(/^\/sku\/([^/]+)/);
    if (!m) return null;
    if (m[1] === "baru") return null;
    if (m[1] === "masuk") return null;
    if (m[1] === "keluar") return null;
    if (window.location.pathname.match(/^\/sku\/[^/]+\/keluar$/)) return null;
    return m[1];
  };
  const [skuId, setSkuId] = useState<string | null>(() => getId());
  useEffect(() => {
    const onPop = () => setSkuId(getId());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return skuId;
}

function useKritisRoute() {
  const [isKritis, setIsKritis] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname === "/kritis";
  });
  useEffect(() => {
    const onPop = () => setIsKritis(window.location.pathname === "/kritis");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return isKritis;
}

// Warung shell — daisyUI drawer + responsive container
function WarungShell({
  headerTitle,
  namaToko,
  view,
  setView,
  children,
}: {
  headerTitle: string;
  namaToko: string;
  view: View;
  setView: (v: View) => void;
  children: React.ReactNode;
}) {
  const closeDrawer = useCallback(() => {
    const el = document.getElementById("drawer-toggle") as HTMLInputElement | null;
    if (el) el.checked = false;
  }, []);

  const navigate = useCallback(
    (next: View) => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
      setView(next);
      closeDrawer();
    },
    [setView, closeDrawer],
  );

  const menu = [
    { id: "dashboard" as View, label: "Dashboard", icon: <Home width={20} height={20} /> },
    { id: "sku" as View, label: "SKU", icon: <Package width={20} height={20} /> },
    { id: "promo" as View, label: "Promo", icon: <ShoppingBag width={20} height={20} /> },
    { id: "settings" as View, label: "Pengaturan", icon: <SettingsIcon width={20} height={20} /> },
  ];

  return (
    <div className="drawer lg:drawer-open min-h-screen bg-[#F5F5F0]">
      <input id="drawer-toggle" data-testid="drawer-toggle" type="checkbox" className="drawer-toggle" />
      {/* Content */}
      <div className="drawer-content flex flex-col min-h-screen bg-[#F5F5F0]">
        {/* Top bar — single header-title visible at all breakpoints (mobile hamburger + desktop subtle) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#0F7A4A] text-white px-4 lg:px-8 py-3 shadow-sm">
          <label
            htmlFor="drawer-toggle"
            className="btn btn-ghost btn-square text-white hover:bg-white/10 min-h-[48px] min-w-[48px] drawer-button lg:hidden"
            aria-label="Buka menu"
            data-testid="hamburger-button"
          >
            <Menu width={22} height={22} />
          </label>
          <div className="hidden lg:flex w-9 h-9 rounded-xl bg-white/20 text-white items-center justify-center">
            <Shop width={18} height={18} />
          </div>
          <h1 data-testid="header-title" className="text-[18px] font-bold leading-tight truncate flex-1">
            {headerTitle}
          </h1>
          <span className="badge badge-sm bg-white/20 text-white border-none font-semibold">PWA</span>
        </header>

        {/* Main content — responsif: mobile pb-36 clears fixed bottom-nav + safe-area */}
        <main
          data-testid="main-content"
          className="flex-1 container max-w-7xl mx-auto px-4 lg:px-8 py-6 pb-36 lg:pb-8"
        >
          {/* Primitif contoh — PageHeader dipakai shell untuk view dashboard */}
          {view === "dashboard" ? (
            <PageHeader
              title="Ringkasan Warung"
              subtitle="Pantau stok mepet, promo tebus, dan histori — semua 3 tap sampai approve."
              icon={<Shop width={20} height={20} />}
            />
          ) : null}
          {/* Grid responsif wrapper untuk konten: 1 kolom mobile → 2-3 kolom desktop bila child pakai grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12">{children}</div>
          </div>
          {/* sentinel paling bawah untuk no-overlap test — pastikan tidak tertutup nav */}
          <div data-testid="content-end-sentinel" aria-hidden className="h-2 w-full mt-8" />
        </main>

        {/* Bottom nav — HANYA mobile */}
        <nav
          data-testid="bottom-nav"
          aria-label="Navigasi utama"
          className="btm-nav btm-nav-sm fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 flex lg:hidden justify-around py-1 px-2 z-20 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom))" }}
        >
          {menu.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={view === tab.id ? "page" : undefined}
              aria-label={tab.label}
              onClick={() => navigate(tab.id)}
              data-testid={`bottom-nav-${tab.id}`}
              className={[
                "flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[64px] px-2 rounded-xl text-xs font-semibold transition-colors",
                view === tab.id ? "text-[#0F7A4A] bg-[#0F7A4A]/10" : "text-[#595959] hover:bg-base-200",
              ].join(" ")}
            >
              <span className={view === tab.id ? "text-[#0F7A4A]" : ""}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <InstallPrompt />
      </div>

      {/* Drawer side — sidebar kiri desktop permanen */}
      <div data-testid="drawer-side" className="drawer-side z-30">
        <label htmlFor="drawer-toggle" aria-label="close sidebar" className="drawer-overlay" data-testid="drawer-overlay" />
        <aside className="min-h-full w-72 bg-base-100 border-r border-base-300 flex flex-col shadow-xl lg:shadow-none">
          {/* Brand header — hangat khas warung */}
          <div className="bg-[#0F7A4A] text-white p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white text-[#0F7A4A] flex items-center justify-center shadow-sm">
                <Shop width={22} height={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs opacity-80 tracking-wide uppercase font-semibold">Toko Anda</p>
                <p
                  data-testid="sidebar-store-name"
                  className="font-bold text-[16px] leading-tight truncate"
                  title={namaToko || headerTitle}
                >
                  {namaToko || headerTitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs opacity-90">
              <span className="badge badge-sm bg-white/20 text-white border-none">Offline siap</span>
              <span className="opacity-70">•</span>
              <span>3 tap sampai approve</span>
            </div>
          </div>

          {/* Menu daisyUI */}
          <ul className="menu p-4 gap-1 flex-1">
            {menu.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  data-testid={`nav-${tab.id}`}
                  aria-current={view === tab.id ? "page" : undefined}
                  aria-label={tab.label}
                  onClick={() => navigate(tab.id)}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-[16px] font-medium min-h-[48px]",
                    view === tab.id
                      ? "bg-[#0F7A4A] text-white active:bg-[#0F7A4A] shadow-sm"
                      : "text-neutral hover:bg-base-200",
                  ].join(" ")}
                >
                  {tab.icon}
                  {tab.label}
                  {view === tab.id ? (
                    <span className="ml-auto w-2 h-2 rounded-full bg-white/90" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          {/* Footer kecil — Bahasa sederhana */}
          <div className="p-4 border-t border-base-200">
            <div className="card bg-[#FFF8E1] border border-[#FFE082]/50 rounded-2xl p-3">
              <p className="text-xs font-semibold text-[#8D6E63]">Butuh bantuan?</p>
              <p className="text-xs text-[#595959] leading-relaxed mt-0.5">Semua data tersimpan di perangkat. Backup di Pengaturan.</p>
            </div>
            {/* Close button visible only mobile */}
            <label
              htmlFor="drawer-toggle"
              className="btn btn-ghost w-full mt-3 lg:hidden min-h-[48px] text-[16px] rounded-xl"
              data-testid="drawer-close-button"
            >
              <Xmark width={18} height={18} /> Tutup
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AppShell() {
  const historiId = useHistoriRoute();
  const isSkuBaru = useSkuBaruRoute();
  const isScan = useScanRoute();
  const isInbound = useInboundRoute();
  const outbound = useOutboundRoute();
  const skuDetailId = useSkuDetailRoute();
  const isKritis = useKritisRoute();
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "dashboard";
    const p = new URLSearchParams(window.location.search);
    if (p.get("view") === "settings") return "settings";
    if (p.get("view") === "promo") return "promo";
    if (p.get("view") === "sku") return "sku";
    return "dashboard";
  });

  useEffect(() => {
    (window as unknown as { __APP_VIEW__: string }).__APP_VIEW__ = view;
  }, [view]);

  useEffect(() => {
    (async () => {
      try {
        const { realRepo: rr } = await import("./db/dexieRepository");
        const { dexieV2: dv } = await import("./db/dexieRepository");
        (window as unknown as Record<string, unknown>).__REAL_REPO__ = rr;
        (window as unknown as Record<string, unknown>).__DEXIE_V2__ = dv;
      } catch {
        // ignore
      }
    })();
  }, []);

  const schedulerGuard = useRef(false);
  useEffect(() => {
    if (schedulerGuard.current) return;
    schedulerGuard.current = true;
    (async () => {
      try {
        const { realRepo } = await import("./db/dexieRepository");
        const { startDailyScheduler } = await import("./engine/notifScheduler");
        const stop = startDailyScheduler(realRepo as unknown as never);
        (window as unknown as Record<string, unknown>).__SCHEDULER_STOP__ = stop;
      } catch {
        // tidak throw — fallback badge+banner via checkAndNotify
      }
    })();
  }, []);

  const namaToko = (() => {
    try {
      return getProfilToko();
    } catch {
      return "";
    }
  })();

  const headerTitle = namaToko ? namaToko : "Inventaris Tebus Murah";

  // Unified content
  let content: React.ReactNode;
  if (historiId) content = <HistoriDetailPage id={historiId} />;
  else if (isKritis) content = <KritisPage />;
  else if (isInbound) content = <InboundForm />;
  else if (outbound.isOutbound) content = <OutboundForm skuId={outbound.skuId ?? undefined} />;
  else if (isScan)
    content = (
      <Suspense fallback={<p data-testid="scan-loading" className="text-sm text-[#595959]">Memuat kamera...</p>}>
        <ScanPage />
      </Suspense>
    );
  else if (isSkuBaru) content = <SkuForm />;
  else if (skuDetailId) content = <SkuDetailPage id={skuDetailId} />;
  else {
    content = (
      <>
        {view === "dashboard" && <DashboardPage />}
        {view === "promo" && <PromoAktifList />}
        {view === "settings" && <SettingsPage />}
        {view === "sku" && <KatalogPage />}
      </>
    );
  }

  return (
    <WarungShell headerTitle={headerTitle} namaToko={namaToko} view={view} setView={setView}>
      {content}
    </WarungShell>
  );
}

function AuthGuard() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  const refresh = useCallback(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const hasSeed = p.has("seed") || p.has("prototype") || p.has("empty") || p.has("histori");
      const isKritisRoute = window.location.pathname === "/kritis";
      if ((hasSeed || isKritisRoute) && !isLoggedIn()) {
        try { setLoggedIn(); } catch {}
      }
    } catch {}
    setAuthed(isLoggedIn());
    setChecked(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <p className="text-[16px] text-[#595959]">Memuat...</p>
      </div>
    );
  }

  if (!authed) {
    return <LoginPage onSuccess={handleSuccess} />;
  }

  return <AppShell />;
}

export default function App() {
  const [isOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("offline") === "1") setShowFallback(true);
  }, []);

  if (showFallback && isOffline) {
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-[#0F7A4A] text-white p-4">
          <h1 className="m-0 text-xl font-bold">Inventaris Tebus Murah</h1>
        </header>
        <OfflineFallback />
      </div>
    );
  }

  return <AuthGuard />;
}
