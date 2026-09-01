import { WifiOff, RefreshDouble } from "iconoir-react";

interface OfflineFallbackProps {
  onReload?: () => void;
}

/**
 * Fallback offline — tampil saat Dexie kosong atau offline tanpa data.
 * Pesan Bahasa Indonesia formal warung, tombol Muat Ulang 48px full width.
 * Shell tetap render, tidak crash halaman putih.
 */
export function OfflineFallback({ onReload }: OfflineFallbackProps) {
  const handleReload = () => {
    if (onReload) onReload();
    else window.location.reload();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        gap: 16,
        minHeight: "60vh",
        textAlign: "center",
        background: "#FFFFFF",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          background: "#F5F5F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #D9D9D9",
        }}
      >
        <WifiOff width={36} height={36} color="#595959" strokeWidth={1.6} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.25,
            color: "#1A1A1A",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Kamu offline
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            color: "#595959",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Kamu offline, data tersimpan lokal akan tampil saat ada
        </p>
      </div>

      <button
        type="button"
        onClick={handleReload}
        aria-label="Muat ulang halaman"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          maxWidth: 360,
          minHeight: 48,
          height: 48,
          padding: "12px 20px",
          borderRadius: 12,
          border: "none",
          background: "#0F7A4A",
          color: "#FFFFFF",
          fontSize: 16,
          fontWeight: 600,
          fontFamily: "Inter, system-ui, sans-serif",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        <RefreshDouble width={20} height={20} color="#FFFFFF" />
        Muat Ulang
      </button>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "#595959",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Data lokal aman — tidak hilang
      </p>
    </div>
  );
}
