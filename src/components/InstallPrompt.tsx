import { Download, Xmark } from "iconoir-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export function InstallPrompt() {
  const { canInstall, promptInstall, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div
      role="dialog"
      aria-label="Pasang aplikasi"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 480,
        margin: "0 auto",
        background: "#FFFFFF",
        border: "1px solid #D9D9D9",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 4px 16px rgba(26,26,26,0.12)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: "#E8F5E9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Download width={20} height={20} color="#0F7A4A" />
        </div>
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "#1A1A1A",
              fontFamily: "Inter, system-ui, sans-serif",
              lineHeight: 1.4,
            }}
          >
            Pasang aplikasi?
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 14,
              color: "#595959",
              fontFamily: "Inter, system-ui, sans-serif",
              lineHeight: 1.4,
            }}
          >
            Tambah ke layar utama biar buka lebih cepat, tetap jalan saat offline.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup"
          style={{
            width: 32,
            height: 32,
            minWidth: 32,
            borderRadius: 8,
            border: "1px solid #D9D9D9",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Xmark width={16} height={16} color="#1A1A1A" />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={dismiss}
          style={{
            flex: 1,
            minHeight: 48,
            height: 48,
            borderRadius: 12,
            border: "1px solid #D9D9D9",
            background: "#FFFFFF",
            color: "#1A1A1A",
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "Inter, system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          Nanti
        </button>
        <button
          type="button"
          onClick={promptInstall}
          aria-label="Pasang aplikasi Tebus Murah"
          style={{
            flex: 1,
            minHeight: 48,
            height: 48,
            borderRadius: 12,
            border: "none",
            background: "#0F7A4A",
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "Inter, system-ui, sans-serif",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Download width={18} height={18} color="#FFFFFF" />
          Pasang
        </button>
      </div>
    </div>
  );
}
