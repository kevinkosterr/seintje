import starlight from "@astrojs/starlight";
import svelte from "@astrojs/svelte";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

export default defineConfig({
  // Served from GitHub Pages as a project site.
  site: "https://kevinkosterr.github.io",
  base: "/seintje",
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
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
        PageTitle: "./src/components/PageTitle.astro",
      },
      expressiveCode: {
        themes: ["vesper", "github-light"],
        useStarlightUiThemeColors: false,
        styleOverrides: {
          borderRadius: "12px",
          borderColor: "var(--s-line)",
          borderWidth: "1px",
          codeBackground: "var(--s-panel)",
          codeFontFamily: "var(--s-mono)",
          codeFontSize: "0.8125rem",
          codeLineHeight: "1.65",
          codePaddingBlock: "0.875rem",
          codePaddingInline: "1rem",
          uiFontFamily: "var(--s-sans)",
          uiFontSize: "0.8125rem",
          frames: {
            shadowColor: "transparent",
            frameBoxShadowCssValue: "none",
            editorBackground: "var(--s-panel)",
            editorActiveTabBackground: "var(--s-panel)",
            editorActiveTabForeground: "var(--s-ink)",
            editorActiveTabIndicatorTopColor: "transparent",
            editorActiveTabIndicatorBottomColor: "var(--s-ink)",
            editorTabBarBackground: "var(--s-bg)",
            editorTabBarBorderBottomColor: "var(--s-line)",
            editorTabBarBorderColor: "var(--s-line)",
            terminalBackground: "var(--s-panel)",
            terminalTitlebarBackground: "var(--s-bg)",
            terminalTitlebarBorderBottomColor: "var(--s-line)",
            terminalTitlebarForeground: "var(--s-ink-3)",
            inlineButtonBackground: "var(--s-panel-2)",
            inlineButtonBorder: "var(--s-line-2)",
            inlineButtonForeground: "var(--s-ink)",
            tooltipSuccessBackground: "var(--s-ink)",
            tooltipSuccessForeground: "var(--s-bg)",
          },
        },
      },
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
