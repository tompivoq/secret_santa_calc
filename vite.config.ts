import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite-plus";
import oxfmtConfig from "./.oxfmtrc.json" with { type: "json" };
import oxlintConfig from "./.oxlintrc.json" with { type: "json" };

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
		// Shims the bits of <dialog> jsdom hasn't implemented — see the file.
		setupFiles: ["./src/test-setup.ts"],
	},
	// Lint and format settings live in .oxlintrc.json / .oxfmtrc.json at the
	// repo root, and are only read in here. The standalone oxlint/oxfmt (the
	// Claude Code edit hook, editor extensions) read those files and never
	// this one, and they're at the root so server/ is covered too. With the
	// settings only in here, those tools fell back to their defaults and
	// re-indented files with spaces.
	//
	// .claude/settings.json and TODO.md are ignored by the formatter: Claude
	// Code owns the former's formatting, so don't fight it there.
	// Cast because a JSON import widens "error" to string; the files
	// themselves are what oxlint/oxfmt validate.
	lint: oxlintConfig as UserConfig["lint"],
	fmt: oxfmtConfig as UserConfig["fmt"],
});
