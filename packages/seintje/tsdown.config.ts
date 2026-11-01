import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: "esm",
    platform: "neutral",
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["motion", "lucide"],
    hooks: {
      "build:done": () => {
        mkdirSync("dist", { recursive: true });
        copyFileSync("src/styles.css", "dist/styles.css");
      },
    },
  },
  {
    // Self-contained build for <script type="module"> and CDNs; bundles motion and lucide.
    entry: { seintje: "src/index.ts" },
    outDir: "dist/browser",
    format: "esm",
    platform: "browser",
    dts: false,
    minify: true,
    sourcemap: true,
    clean: false,
    noExternal: ["motion", "lucide"],
  },
]);
