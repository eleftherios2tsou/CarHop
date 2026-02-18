import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API requests
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },

      // Serve uploaded images in dev (backend mounts /uploads)
      "/uploads": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
