import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  lint: {
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
});
