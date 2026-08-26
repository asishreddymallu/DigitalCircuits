import { defineConfig } from "vite";

// Dev server for the whole suite from the repository root. Static multi-page
// site: vite serves index.html files as-is and the built script.js bundles.
export default defineConfig({
  server: {
    port: 5173,
    open: "/"
  },
  publicDir: false
});
