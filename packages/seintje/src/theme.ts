import type { Theme } from "./types";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Resolves `theme` to light or dark and reports changes of the system
 * preference while it is `system`. Returns a function that stops watching.
 */
export function watchTheme(
  theme: Theme,
  onResolve: (resolved: "light" | "dark") => void,
): () => void {
  if (theme !== "system") {
    onResolve(theme);
    return () => {};
  }
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    onResolve("light");
    return () => {};
  }
  const query = window.matchMedia(DARK_QUERY);
  const report = () => onResolve(query.matches ? "dark" : "light");
  report();
  query.addEventListener?.("change", report);
  return () => query.removeEventListener?.("change", report);
}
