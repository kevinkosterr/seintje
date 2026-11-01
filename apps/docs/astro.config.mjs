import starlight from "@astrojs/starlight";
import svelte from "@astrojs/svelte";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

export default defineConfig({
  vite: {
    // Starlight's markdown processor loads a native binary; keep it out of the bundle.
    ssr: { external: ["satteri"] },
    environments: { prerender: { resolve: { external: ["satteri"] } } },
  },
  integrations: [
    starlight({
      title: "Seintje",
      description: "Framework-agnostic toast notifications",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/kevinkosterr/seintje" },
      ],
      customCss: ["seintje/styles.css", "./src/styles/docs.css"],
      sidebar: [
        {
          label: "Guides",
          items: [
            { label: "Getting started", slug: "guides/getting-started" },
            { label: "Vanilla JavaScript", slug: "guides/vanilla" },
            { label: "Vue", slug: "guides/vue" },
            { label: "Svelte", slug: "guides/svelte" },
            { label: "Theming", slug: "guides/theming" },
            { label: "Accessibility", slug: "guides/accessibility" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "seintje API", slug: "reference/api" },
            { label: "Toast options", slug: "reference/toast-options" },
            { label: "Toaster options", slug: "reference/toaster" },
            { label: "Stores and adapters", slug: "reference/stores" },
          ],
        },
      ],
    }),
    vue(),
    svelte(),
  ],
});
