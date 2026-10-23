import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Read which @sierrafy/sdk is actually installed, and where it came from,
// so every page (and every video) shows the exact version being tested.
const require = createRequire(import.meta.url);
const rootPkg = JSON.parse(readFileSync("./package.json", "utf8"));
const spec = rootPkg.dependencies?.["@sierrafy/sdk"] ?? "";
const installed = JSON.parse(
  readFileSync(require.resolve("@sierrafy/sdk/package.json"), "utf8")
);

const source = spec.startsWith("file:") || spec.startsWith("link:")
  ? "local"
  : "npm";

export default defineConfig({
  // A fixed, uncommon port. Vite's default 5173 is shared with every other
  // Vite project on this machine, and browser state is per-origin: a service
  // worker or storage left by whichever app got 5173 first is still served on
  // localhost:5173 afterwards, which silently shows you the wrong app.
  // strictPort makes a clash fail loudly instead of hopping to another port.
  server: { port: 5188, strictPort: true },
  preview: { port: 5189, strictPort: true },

  define: {
    __SDK__: JSON.stringify({
      name: installed.name,
      version: installed.version,
      source,
    }),
  },
});
