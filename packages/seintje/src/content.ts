import type { Content } from "./types";

/**
 * Puts `content` into `slot` and returns a function that empties it again.
 * Renderers are given the slot and may hand back their own cleanup.
 */
export function mountContent(slot: HTMLElement, content: Content | undefined | null): () => void {
  if (content === undefined || content === null || content === "") return () => {};

  if (typeof content === "string") {
    slot.textContent = content;
    return () => {
      slot.textContent = "";
    };
  }

  if (typeof content === "function") {
    const cleanup = content(slot);
    return () => {
      cleanup?.();
      slot.replaceChildren();
    };
  }

  slot.append(content);
  return () => slot.replaceChildren();
}

/** True when `content` would render something. */
export const hasContent = (content: Content | undefined | null): boolean =>
  content !== undefined && content !== null && content !== "";
