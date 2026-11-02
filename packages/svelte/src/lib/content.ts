import type { Content } from "seintje";
import { type Component, mount, type Snippet, unmount } from "svelte";
import Render from "./Render.svelte";

/** A component together with the props to mount it with. */
export interface ComponentContent<Props extends Record<string, unknown> = Record<string, unknown>> {
  // biome-ignore lint/suspicious/noExplicitAny: components with any props are accepted
  component: Component<Props, any, any>;
  props?: Props;
}

// biome-ignore lint/suspicious/noExplicitAny: components with any props are accepted
type AnyComponent = Component<any, any, any>;

/** Content Svelte toasts accept: text, a DOM node, a snippet, or a component. */
export type SvelteContent = string | Node | Snippet | AnyComponent | ComponentContent;

let contexts: Map<unknown, unknown> | undefined;

/**
 * Lets rendered content read the contexts that surround `<Toaster>`. Set by
 * `<Toaster>` when it is created.
 */
export function setContexts(next: Map<unknown, unknown> | undefined): void {
  contexts = next;
}

const isNode = (value: unknown): value is Node =>
  typeof Node !== "undefined" && value instanceof Node;

/**
 * Snippets are compiled to arrow functions, components to plain functions,
 * so only components carry a prototype.
 */
const isComponent = (value: Snippet | AnyComponent): value is AnyComponent => "prototype" in value;

/** Turns Svelte content into a renderer the core can mount into a slot. */
export function toContent(content: SvelteContent | null | undefined): Content | null | undefined {
  if (content === null || content === undefined || typeof content === "string") return content;
  if (isNode(content)) return content;

  if (typeof content === "function" && isComponent(content)) {
    return toContent({ component: content });
  }

  if (typeof content === "function") {
    return (slot) => {
      const instance = mount(Render, {
        target: slot,
        props: { snippet: content },
        ...(contexts ? { context: contexts } : {}),
      });
      return () => void unmount(instance);
    };
  }

  const { component, props } = content;
  return (slot) => {
    const instance = mount(component, {
      target: slot,
      props: props ?? {},
      ...(contexts ? { context: contexts } : {}),
    });
    return () => void unmount(instance);
  };
}
