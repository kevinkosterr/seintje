import { createToaster, type Toaster } from "seintje";

declare global {
  interface Window {
    __seintjeDocsToaster?: Toaster;
  }
}

/**
 * Creates the one toaster the docs share and keeps its theme in step with
 * Starlight's theme switcher.
 */
export function ensureDocsToaster(): Toaster {
  if (window.__seintjeDocsToaster) return window.__seintjeDocsToaster;

  const root = document.documentElement;
  const theme = () => (root.dataset.theme === "dark" ? "dark" : "light");
  const toaster = createToaster(document.body, { position: "bottom-right", theme: theme() });
  new MutationObserver(() => toaster.update({ theme: theme() })).observe(root, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  window.__seintjeDocsToaster = toaster;
  return toaster;
}
