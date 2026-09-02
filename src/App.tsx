import { useEffect, useState } from "react";
import { OfflineFallback } from "./components/OfflineFallback";
import { InstallPrompt } from "./components/InstallPrompt";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { HistoriDetailPage } from "./features/dashboard/HistoriDetailPage";
import { PromoAktifList } from "./features/promo/PromoAktifList";
import { SettingsPage } from "./features/settings/SettingsPage";

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

function AppShell() {
  const historiId = useHistoriRoute();
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

  if (historiId) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
        <header style={{ background: "#0F7A4A", color: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>Inventaris Tebus Murah</h1>
          <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 8, color: "#FFFFFF" }}>PWA</span>
        </header>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, paddingBottom: 80 }}>
          <HistoriDetailPage id={historiId} />
        </main>
        <InstallPrompt />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F0", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <header style={{ background: "#0F7A4A", color: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.25, color: "#FFFFFF" }}>Inventaris Tebus Murah</h1>
        <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 8, color: "#FFFFFF" }}>PWA</span>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, paddingBottom: 80 }}>
        {view === "dashboard" && <DashboardPage seedMode={seedMode} />}
        {view === "promo" && <PromoAktifList />}
        {view === "settings" && <SettingsPage />}
        {view === "sku" && (
          <div data-testid="sku-page" className="w-full max-w-[480px] mx-auto px-4">
            <h2 className="text-[20px] font-bold text-[#1A1A1A] mb-3" style={{ fontSize: "20px" }}>SKU</h2>
            <p className="text-base text-[#595959]" style={{ fontSize: "16px" }}>Daftar SKU — mock untuk navigasi 3-tap.</p>
            <button type="button" className="btn btn-primary w-full min-h-[48px] mt-3 text-base font-semibold" style={{ minHeight: "48px", fontSize: "16px" }} data-testid="sku-mock-btn">Lihat SKU</button>
          </div>
        )}
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

  return <AppShell />;
}
