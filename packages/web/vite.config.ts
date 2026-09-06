import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "prototype.html"],
      manifest: {
        name: "Quantum",
        short_name: "Quantum",
        description: "Agent-driven lifelong learning",
        theme_color: "#f4efe4",
        background_color: "#f4efe4",
        display: "standalone",
        start_url: "/",
        lang: "zh-CN",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@quantum/shared": path.resolve(import.meta.dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 43127,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:43128",
        changeOrigin: true,
      },
    },
  },
});
