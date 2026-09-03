import { useEffect, useState, useCallback } from "react";
import { OfflineFallback } from "./components/OfflineFallback";
import { InstallPrompt } from "./components/InstallPrompt";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { HistoriDetailPage } from "./features/dashboard/HistoriDetailPage";
import { PromoAktifList } from "./features/promo/PromoAktifList";
import { SettingsPage } from "./features/settings/SettingsPage";
import { KatalogPage } from "./features/sku/KatalogPage";
import { SkuForm } from "./features/sku/SkuForm";
import { LoginPage, getProfilToko } from "./features/auth/LoginPage";
import { isLoggedIn } from "./features/auth/session";
import { lazy, Suspense } from "react";
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
    // wrap pushState to trigger pop
    (window.history.pushState as unknown as (d:any,u:string,url?:string)=>void) = ((d:any,u:string,url?:string)=>{
      orig(d,u,url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }) as any;
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

function AppShell() {
  const historiId = useHistoriRoute();
  const isSkuBaru = useSkuBaruRoute();
  const isScan = useScanRoute();
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "dashboard";
    const p = new URLSearchParams(window.location.search);
    if (p.get("view") === "settings") return "settings";
    if (p.get("view") === "promo") return "promo";
    if (p.get("view") === "sku") return "sku";
    return "dashboard";
  });

  const seedMode = (() => {
    const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (p?.get("seed") === "many" || p?.get("prototype") === "many") return "many" as const;
    if (p?.get("seed") === "empty") return "empty" as const;
    if (p?.get("seed") === "expiryNull") return "expiryNull" as const;
    if (p?.get("seed") === "demo") return "demo" as const;
    // Real data from nol — no dummy by default (reset)
    return undefined;
  })() as "demo" | "many" | "empty" | "expiryNull" | undefined;

  // expose view for e2e counting
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
      } catch {}
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

  if (historiId) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
        <header style={{ background: "#0F7A4A", color: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>{headerTitle}</h1>
          <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 8, color: "#FFFFFF" }}>PWA</span>
        </header>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, paddingBottom: 80 }}>
          <HistoriDetailPage id={historiId} />
        </main>
        <InstallPrompt />
      </div>
    );
  }

  if (isScan) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
        <header style={{ background: "#0F7A4A", color: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 data-testid="header-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.25, color: "#FFFFFF" }}>{headerTitle}</h1>
          <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 8, color: "#FFFFFF" }}>PWA</span>
        </header>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, paddingBottom: 80 }}>
          <Suspense fallback={<p data-testid="scan-loading" style={{ fontSize: 14, color: "#595959" }}>Memuat kamera...</p>}>
            <ScanPage />
          </Suspense>
        </main>
        <nav aria-label="Navigasi utama" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #D9D9D9", display: "flex", justifyContent: "space-around", padding: "8px 0", maxWidth: 480, margin: "0 auto" }}>
          {[
            { id: "dashboard" as View, label: "Dashboard" },
            { id: "sku" as View, label: "SKU" },
            { id: "promo" as View, label: "Promo" },
            { id: "settings" as View, label: "Pengaturan" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={view === tab.id ? "page" : undefined}
              aria-label={tab.label}
              onClick={() => {
                window.history.pushState({}, "", "/");
                window.dispatchEvent(new PopStateEvent("popstate"));
                setView(tab.id);
              }}
              data-testid={`nav-${tab.id}`}
              style={{ minHeight: 48, padding: "8px 16px", border: "none", background: "transparent", color: view === tab.id ? "#0F7A4A" : "#595959", fontSize: 14, fontWeight: view === tab.id ? 600 : 400, cursor: "pointer" }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <InstallPrompt />
      </div>
    );
  }

  if (isSkuBaru) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
        <header style={{ background: "#0F7A4A", color: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 data-testid="header-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.25, color: "#FFFFFF" }}>{headerTitle}</h1>
          <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 8, color: "#FFFFFF" }}>PWA</span>
        </header>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, paddingBottom: 80 }}>
          <SkuForm />
        </main>
        <nav aria-label="Navigasi utama" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #D9D9D9", display: "flex", justifyContent: "space-around", padding: "8px 0", maxWidth: 480, margin: "0 auto" }}>
          {[
            { id: "dashboard" as View, label: "Dashboard" },
            { id: "sku" as View, label: "SKU" },
            { id: "promo" as View, label: "Promo" },
            { id: "settings" as View, label: "Pengaturan" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={view === tab.id ? "page" : undefined}
              aria-label={tab.label}
              onClick={() => {
                window.history.pushState({}, "", "/");
                window.dispatchEvent(new PopStateEvent("popstate"));
                setView(tab.id);
              }}
              data-testid={`nav-${tab.id}`}
              style={{ minHeight: 48, padding: "8px 16px", border: "none", background: "transparent", color: view === tab.id ? "#0F7A4A" : "#595959", fontSize: 14, fontWeight: view === tab.id ? 600 : 400, cursor: "pointer" }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <InstallPrompt />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <header style={{ background: "#0F7A4A", color: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 data-testid="header-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.25, color: "#FFFFFF" }}>{headerTitle}</h1>
        <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 8, color: "#FFFFFF" }}>PWA</span>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, paddingBottom: 80 }}>
        {view === "dashboard" && <DashboardPage seedMode={seedMode} />}
        {view === "promo" && <PromoAktifList />}
        {view === "settings" && <SettingsPage />}
        {view === "sku" && <KatalogPage />}
      </main>

      <nav aria-label="Navigasi utama" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #D9D9D9", display: "flex", justifyContent: "space-around", padding: "8px 0", maxWidth: 480, margin: "0 auto" }}>
        {[
          { id: "dashboard" as View, label: "Dashboard" },
          { id: "sku" as View, label: "SKU" },
          { id: "promo" as View, label: "Promo" },
          { id: "settings" as View, label: "Pengaturan" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={view === tab.id ? "page" : undefined}
            aria-label={tab.label}
            onClick={() => setView(tab.id)}
            data-testid={`nav-${tab.id}`}
            style={{ minHeight: 48, padding: "8px 16px", border: "none", background: "transparent", color: view === tab.id ? "#0F7A4A" : "#595959", fontSize: 14, fontWeight: view === tab.id ? 600 : 400, cursor: "pointer" }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <InstallPrompt />
    </div>
  );
}

function AuthGuard() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  const refresh = useCallback(() => {
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F0" }}>
        <p style={{ fontSize: 16, color: "#595959" }}>Memuat...</p>
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
      <div style={{ minHeight: "100vh", background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif" }}>
        <header style={{ background: "#0F7A4A", color: "#FFFFFF", padding: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Inventaris Tebus Murah</h1>
        </header>
        <OfflineFallback />
      </div>
    );
  }

  return <AuthGuard />;
}
