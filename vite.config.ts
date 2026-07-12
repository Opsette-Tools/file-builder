import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/file-builder/" : "/",
  server: {
    host: "::",
    port: 8125,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // we handle registration manually with a guard in main.tsx
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        navigateFallback: "index.html",
        // Never let the SPA navigate-fallback intercept a blob: download. When a
        // programmatic `<a download href="blob:...">` click is treated as a
        // navigation, the fallback would serve index.html and the download would
        // silently fail (ZIP "builds" but never lands). Deny blob:/data: so those
        // navigations pass through untouched. (/~oauth stays denied as before.)
        navigateFallbackDenylist: [/^\/~oauth/, /^blob:/, /^data:/],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp}"],
        // og-image.png is only fetched by social scrapers from the live server,
        // never by the app — keep it out of the offline precache (it also
        // exceeds the 2 MiB precache limit and would fail the build).
        globIgnores: ["**/og-image.png"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
