/// <reference types="vitest/config" />
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [
    vue(),
    dts({ tsconfigPath: "./tsconfig.build.json" }),
    {
      name: "seintje-styles",
      closeBundle() {
        copyFileSync(require.resolve("seintje/styles.css"), "dist/styles.css");
      },
    },
  ],
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    sourcemap: true,
    rollupOptions: { external: ["vue", "seintje", /^seintje\//] },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
  },
});
