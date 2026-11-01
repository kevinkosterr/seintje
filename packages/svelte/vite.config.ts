/// <reference types="vitest/config" />
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
  },
});
