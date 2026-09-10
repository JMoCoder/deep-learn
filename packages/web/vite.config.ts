import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type ProxyOptions } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** Same-origin /api: inject token in the Node proxy. Never VITE_* / import.meta.env. */
function apiProxy(): Record<string, ProxyOptions> {
  return {
    "/api": {
      target: "http://127.0.0.1:43128",
      changeOrigin: true,
      configure(proxy) {
        proxy.on("proxyReq", (proxyReq) => {
          const token = process.env.QUANTUM_API_TOKEN?.trim();
          if (token) proxyReq.setHeader("X-Quantum-Token", token);
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "prototype.html"],
      manifest: {
        name: "Deep Learn",
        short_name: "Deep Learn",
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
    proxy: apiProxy(),
  },
  preview: {
    host: "127.0.0.1",
    port: 43127,
    proxy: apiProxy(),
  },
});
