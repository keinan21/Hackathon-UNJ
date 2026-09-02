import { useEffect, useState } from "react";
import { OfflineFallback } from "./components/OfflineFallback";
import { InstallPrompt } from "./components/InstallPrompt";
import { UrgentList } from "./features/dashboard/UrgentList";
import { PromoAktifList } from "./features/promo/PromoAktifList";
import SettingsPage from "./features/settings/SettingsPage";
import { Home, Box, Package, ShoppingBag, Settings } from "iconoir-react";

function useRoute() {
  const [path, setPath] = useState(() => (typeof window !== "undefined" ? window.location.pathname : "/"));
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    const origPush = window.history.pushState.bind(window.history) as unknown as (...a: unknown[]) => void;
    const origReplace = window.history.replaceState.bind(window.history) as unknown as (...a: unknown[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.history.pushState as unknown as (...a: unknown[]) => void) = (...args: unknown[]) => {
      (origPush as (...a: unknown[]) => void)(...args);
      setPath(window.location.pathname);
      window.dispatchEvent(new Event("popstate"));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.history.replaceState as unknown as (...a: unknown[]) => void) = (...args: unknown[]) => {
      (origReplace as (...a: unknown[]) => void)(...args);
      setPath(window.location.pathname);
      window.dispatchEvent(new Event("popstate"));
    };
    return () => {
      window.removeEventListener("popstate", onPop);
      (window.history.pushState as unknown as (...a: unknown[]) => void) = origPush as (...a: unknown[]) => void;
      (window.history.replaceState as unknown as (...a: unknown[]) => void) = origReplace as (...a: unknown[]) => void;
    };
  }, []);
  return path;
}

function AppShell() {
  const route = useRoute();
  const isSettings = route === "/settings";
  const seedMode = (() => {
    if (typeof window === "undefined") return "demo" as const;
    const p = new URLSearchParams(window.location.search);
    if (p.get("seed") === "many" || p.get("prototype") === "many") return "many" as const;
    if (p.get("seed") === "empty") return "empty" as const;
    if (p.get("seed") === "expiryNull") return "expiryNull" as const;
    return "demo" as const;
  })();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F5F0",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <header
        style={{
          background: "#0F7A4A",
          color: "#FFFFFF",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.25,
            color: "#FFFFFF",
          }}
        >
          Inventaris Tebus Murah
        </h1>
        <span
          style={{
            fontSize: 12,
            background: "rgba(255,255,255,0.2)",
            padding: "4px 8px",
            borderRadius: 8,
            color: "#FFFFFF",
          }}
        >
          PWA
        </span>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, paddingBottom: 80 }}>
        {isSettings ? (
          <SettingsPage />
        ) : (
          <>
            <UrgentList seedMode={seedMode} />
            <div style={{ marginTop: 16 }}>
              <PromoAktifList />
            </div>
          </>
        )}
      </main>

      <nav
        aria-label="Navigasi utama"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          borderTop: "1px solid #D9D9D9",
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 0",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          aria-current={isSettings ? undefined : "page"}
          aria-label="Dashboard"
          onClick={() => window.history.pushState({}, "", "/")}
          style={{
            minHeight: 48,
            padding: "8px 10px",
            border: "none",
            background: "transparent",
            color: isSettings ? "#595959" : "#0F7A4A",
            fontSize: 12,
            fontWeight: isSettings ? 400 : 600,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Home width={20} height={20} aria-hidden="true" />
          Dashboard
        </button>
        <button
          type="button"
          aria-label="SKU"
          onClick={() => window.history.pushState({}, "", "/sku")}
          style={{
            minHeight: 48,
            padding: "8px 10px",
            border: "none",
            background: "transparent",
            color: "#595959",
            fontSize: 12,
            fontWeight: 400,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box width={20} height={20} aria-hidden="true" />
          SKU
        </button>
        <button
          type="button"
          aria-label="Batch"
          onClick={() => window.history.pushState({}, "", "/batch")}
          style={{
            minHeight: 48,
            padding: "8px 10px",
            border: "none",
            background: "transparent",
            color: "#595959",
            fontSize: 12,
            fontWeight: 400,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Package width={20} height={20} aria-hidden="true" />
          Batch
        </button>
        <button
          type="button"
          aria-label="Promo"
          onClick={() => window.history.pushState({}, "", "/promo")}
          style={{
            minHeight: 48,
            padding: "8px 10px",
            border: "none",
            background: "transparent",
            color: "#595959",
            fontSize: 12,
            fontWeight: 400,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <ShoppingBag width={20} height={20} aria-hidden="true" />
          Promo
        </button>
        <button
          type="button"
          aria-current={isSettings ? "page" : undefined}
          aria-label="Pengaturan"
          data-testid="nav-pengaturan"
          onClick={() => window.history.pushState({}, "", "/settings")}
          style={{
            minHeight: 48,
            padding: "8px 10px",
            border: "none",
            background: "transparent",
            color: isSettings ? "#0F7A4A" : "#595959",
            fontSize: 12,
            fontWeight: isSettings ? 600 : 400,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Settings width={20} height={20} aria-hidden="true" />
          Pengaturan
        </button>
      </nav>

      <InstallPrompt />
    </div>
  );
}

export default function App() {
  const [isOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [showFallback, setShowFallback] = useState(false);

  // Show fallback only if explicitly offline AND no data simulation
  // Shell must render even when Dexie empty — fallback is opt-in via ?offline param or real offline after cache
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("offline") === "1") {
      setShowFallback(true);
    }
  }, []);

  // Listen online/offline but keep shell rendered — fallback is non-blocking
  // Requirement: fallback page <2s, no white crash, shell renders even when Dexie empty

  if (showFallback && isOffline) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif" }}>
        <header
          style={{
            background: "#0F7A4A",
            color: "#FFFFFF",
            padding: 16,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Inventaris Tebus Murah</h1>
        </header>
        <OfflineFallback />
      </div>
    );
  }

  return <AppShell />;
}
