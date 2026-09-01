import { useEffect, useState } from "react";
import { OfflineFallback } from "./components/OfflineFallback";
import { InstallPrompt } from "./components/InstallPrompt";

function AppShell() {
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

      <main style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
        <section
          style={{
            background: "#FFFFFF",
            border: "1px solid #D9D9D9",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 18,
              fontWeight: 600,
              color: "#1A1A1A",
            }}
          >
            Stok Mepet
          </h2>
          <p style={{ margin: 0, fontSize: 16, color: "#595959", lineHeight: 1.5 }}>
            Stok aman, tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.
          </p>
        </section>

        <section
          style={{
            marginTop: 16,
            background: "#FFFFFF",
            border: "1px solid #D9D9D9",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 18,
              fontWeight: 600,
              color: "#1A1A1A",
            }}
          >
            Promo Aktif
          </h2>
          <p style={{ margin: 0, fontSize: 16, color: "#595959", lineHeight: 1.5 }}>
            Belum ada promo aktif. Buat tebus murah dari stok mepet biar tidak jadi sampah.
          </p>
        </section>
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
          aria-current="page"
          style={{
            minHeight: 48,
            padding: "8px 16px",
            border: "none",
            background: "transparent",
            color: "#0F7A4A",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Dashboard
        </button>
        <button
          type="button"
          style={{
            minHeight: 48,
            padding: "8px 16px",
            border: "none",
            background: "transparent",
            color: "#595959",
            fontSize: 14,
            fontWeight: 400,
            cursor: "pointer",
          }}
        >
          SKU
        </button>
        <button
          type="button"
          style={{
            minHeight: 48,
            padding: "8px 16px",
            border: "none",
            background: "transparent",
            color: "#595959",
            fontSize: 14,
            fontWeight: 400,
            cursor: "pointer",
          }}
        >
          Promo
        </button>
        <button
          type="button"
          style={{
            minHeight: 48,
            padding: "8px 16px",
            border: "none",
            background: "transparent",
            color: "#595959",
            fontSize: 14,
            fontWeight: 400,
            cursor: "pointer",
          }}
        >
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
