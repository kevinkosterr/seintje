/** Toast types Seintje ships with an icon, title and colour for. */
export type BuiltInToastType = "neutral" | "success" | "info" | "warning" | "error" | "loading";

/**
 * Visual and semantic flavour of a toast. Any other string is a custom type:
 * it looks like `neutral` until the toaster's `types` option or CSS on
 * `[data-type="…"]` says otherwise.
 */
export type ToastType = BuiltInToastType | (string & {});

export const POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type Position = (typeof POSITIONS)[number];

/**
 * Renders into a slot element owned by Seintje. May return a cleanup function
 * that runs when the slot is emptied or the toast is removed.
 */
export type ContentRenderer = (slot: HTMLElement) => undefined | (() => void);

/**
 * Anything Seintje can put inside a toast: plain text, a DOM node, or a
 * renderer. Framework adapters translate their own content (VNodes,
 * snippets, components) into renderers.
 */
export type Content = string | Node | ContentRenderer;

export interface ToastHandle {
  id: string;
  dismiss: () => void;
}

export interface ToastAction {
  label: string;
  onClick: (event: MouseEvent, toast: ToastHandle) => void;
  /** Dismiss the toast after the click handler ran. Defaults to `false`. */
  dismiss?: boolean;
}

/** Where the action button sits: next to the title, or under it. */
export type ActionPlacement = "inline" | "below";

/** Whether the action button is always shown, or only while the toast is hovered or focused. */
export type ActionVisibility = "always" | "hover";

export interface ToastClasses {
  toast?: string;
  title?: string;
  description?: string;
  icon?: string;
  action?: string;
}

export interface AutoExpandOptions {
  /** Milliseconds after the toast appears before it opens. */
  delay?: number;
  /** Milliseconds the toast stays open before it closes again. */
  hold?: number;
}

export interface ToastOptions {
  /** Reusing an id updates that toast in place instead of adding a new one. */
  id?: string;
  title?: string;
  description?: Content;
  type?: ToastType;
  /**
   * Replaces the type icon. A string starting with `<svg` is rendered as
   * inline SVG markup. `null` hides the icon.
   */
  icon?: Content | null;
  position?: Position;
  /** Milliseconds before auto-dismissal. `null` or `Infinity` keeps it open. */
  duration?: number | null;
  action?: ToastAction;
  /** Where the action button sits. Defaults to `"inline"`. */
  actionPlacement?: ActionPlacement;
  /** When the action button is shown. Defaults to `"always"`. */
  actionVisibility?: ActionVisibility;
  /** Allow swipe, Escape and the close button. Defaults to `true`. */
  dismissible?: boolean;
  /** Open the description automatically. Defaults to `true`. */
  autoExpand?: boolean | AutoExpandOptions;
  /**
   * Once open, stay open instead of collapsing again when `hold` runs out or
   * the pointer or focus leaves. Defaults to `false`.
   */
  keepExpanded?: boolean;
  /** Background colour of the toast shape. */
  fill?: string;
  /** Corner radius in pixels. Defaults to `--seintje-radius`, else 18. */
  radius?: number;
  /** Announce through the assertive live region. Defaults to `true` for errors. */
  important?: boolean;
  className?: string;
  classes?: ToastClasses;
  onDismiss?: (id: string) => void;
}

/** Defaults for every toast of one type. A toast's own options win. */
export type ToastTypeOptions = Omit<ToastOptions, "id" | "type">;

/** A toast as it lives in the store. */
export interface ToastRecord {
  readonly id: string;
  readonly type: ToastType;
  readonly options: Readonly<ToastOptions>;
  /** Increases every time the toast's content is replaced. */
  readonly revision: number;
  readonly createdAt: number;
  /** Set once the toast has been dismissed and is animating out. */
  readonly closing: boolean;
}

export type Theme = "light" | "dark" | "system";

/** `system` follows `prefers-reduced-motion`. */
export type MotionPreference = "system" | "reduce" | "full";

export type OffsetValue = number | string;
export type Offset =
  | OffsetValue
  | Partial<Record<"top" | "right" | "bottom" | "left", OffsetValue>>;
