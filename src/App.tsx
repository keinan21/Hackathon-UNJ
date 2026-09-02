import { useEffect, useState } from "react";
import { OfflineFallback } from "./components/OfflineFallback";
import { InstallPrompt } from "./components/InstallPrompt";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { HistoriDetailPage } from "./features/dashboard/HistoriDetailPage";
import { PromoAktifList } from "./features/promo/PromoAktifList";
import { SettingsPage } from "./features/settings/SettingsPage";
import { KatalogPage } from "./features/sku/KatalogPage";
import { BatchDetailPage } from "./features/batch/BatchDetailPage";
import { AppShell } from "./components/AppShell";
import { TopAppBar } from "./components/TopAppBar";
import { BottomNav } from "./components/BottomNav";

type View = "dashboard" | "sku" | "batch" | "promo" | "settings";

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
    (window.history.pushState as unknown as (d: unknown, u: string, url?: string) => void) = ((
      d: unknown,
      _u: string,
      url?: string,
    ) => {
      orig(d, _u, url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }) as never;
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return historiId;
}

function AppContent() {
  const historiId = useHistoriRoute();
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "dashboard";
    const p = new URLSearchParams(window.location.search);
    const v = p.get("view");
    if (v === "settings" || v === "promo" || v === "sku" || v === "batch") return v;
    return "dashboard";
  });

  const seedMode = (() => {
    if (typeof window === "undefined") return "demo" as const;
    const p = new URLSearchParams(window.location.search);
    if (p.get("seed") === "many" || p.get("prototype") === "many") return "many" as const;
    if (p.get("seed") === "empty") return "empty" as const;
    if (p.get("seed") === "expiryNull") return "expiryNull" as const;
    return "demo" as const;
  })();

  useEffect(() => {
    (window as unknown as { __APP_VIEW__: string }).__APP_VIEW__ = view;
  }, [view]);

  const variant = view === "sku" || view === "batch" ? "wide" : "narrow";

  if (historiId) {
    return (
      <>
        <TopAppBar />
        <AppShell variant="narrow">
          <div className="w-full flex flex-col gap-lg">
            <HistoriDetailPage id={historiId} />
          </div>
        </AppShell>
        <BottomNav view={view} onChange={setView} />
        <InstallPrompt />
      </>
    );
  }

  return (
    <>
      <TopAppBar />
      <AppShell variant={variant}>
        {view === "dashboard" && <DashboardPage seedMode={seedMode} />}
        {view === "promo" && <PromoAktifList />}
        {view === "settings" && <SettingsPage />}
        {view === "sku" && (
          <div data-testid="sku-page" className="w-full">
            <KatalogPage />
          </div>
        )}
        {view === "batch" && (
          <div data-testid="batch-page" className="w-full">
            <BatchDetailPage onBack={() => setView("dashboard")} />
          </div>
        )}
      </AppShell>
      <BottomNav view={view} onChange={setView} />
      <InstallPrompt />
    </>
  );
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
      <>
        <TopAppBar />
        <div className="flex min-h-screen flex-col items-center bg-surface pt-16">
          <main className="w-full max-w-3xl flex-1 px-margin-mobile py-4">
            <OfflineFallback />
          </main>
        </div>
      </>
    );
  }

  return <AppContent />;
}
