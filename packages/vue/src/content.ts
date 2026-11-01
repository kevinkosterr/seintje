import type { Content } from "seintje";
import { type AppContext, type Component, cloneVNode, h, isVNode, render, type VNode } from "vue";

/** Content Vue toasts accept: text, a DOM node, a VNode, or a component. */
export type VueContent = string | Node | VNode | Component;

let appContext: AppContext | null = null;

/**
 * Lets rendered content see the app's plugins, provides and global
 * components. Set by `<Toaster>` when it mounts.
 */
export function setAppContext(context: AppContext | null): void {
  appContext = context;
}

const isNode = (value: unknown): value is Node =>
  typeof Node !== "undefined" && value instanceof Node;

/** Turns Vue content into a renderer the core can mount into a slot. */
export function toContent(content: VueContent | null | undefined): Content | null | undefined {
  if (content === null || content === undefined || typeof content === "string") return content;
  if (isNode(content)) return content;

  return (slot) => {
    const vnode = isVNode(content) ? cloneVNode(content) : h(content as Component);
    vnode.appContext = appContext;
    render(vnode, slot);
    return () => render(null, slot);
  };
}
