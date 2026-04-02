import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // يمنع Vite من معالجة مكتبة الـ SQL بشكل خاطئ
  optimizeDeps: {
    exclude: ["@tauri-apps/plugin-sql"],
  },
  server: {
    port: 1420,
    strictPort: true,
  }
});