import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  // The backend lives in server/ as its own project with its own vitest
  // config and test runner — never let the root test run wander into it
  // (or its build output/node_modules).
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "server/**"],
  },
  //Oxlint configuration
  lint: {
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  // Oxfmt configuration.
  fmt: {
    sortTailwindcss: true,
    useTabs: true,
    // Claude Code owns the formatting of its own settings file; don't
    // fight it by reformatting there too.
    ignorePatterns: [".claude/settings.json"],
  },
});
