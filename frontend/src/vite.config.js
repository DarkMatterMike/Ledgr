import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        hoistTransitiveImports: false,
        chunkFileNames: "assets/[name]-[hash]-v2.js",
        entryFileNames: "assets/[name]-[hash]-v2.js",
        assetFileNames: "assets/[name]-[hash]-v2.[ext]",
      },
    },
  },
});
