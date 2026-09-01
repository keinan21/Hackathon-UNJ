import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["robots.txt", "icons/*.png"],
      manifest: {
        name: "Inventaris AI Tebus Murah",
        short_name: "TebusMurah",
        description: "Inventaris perishable offline untuk UMKM — stok mepet, tebus murah 1-tap.",
        theme_color: "#0F7A4A",
        background_color: "#FFFFFF",
        display: "standalone",
        scope: "/",
        start_url: "/",
        lang: "id",
        icons: [
          {
            src: "icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
