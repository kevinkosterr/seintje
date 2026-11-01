import { MotionSettings } from "./animation";
import { TOAST_WIDTH } from "./constants";
import { defaultStore } from "./default";
import type { Store } from "./store";
import { watchTheme } from "./theme";
import { type Align, type Grow, resolveDuration, ToastView } from "./toast";
import type {
  MotionPreference,
  Offset,
  OffsetValue,
  Position,
  Theme,
  ToastOptions,
  ToastRecord,
} from "./types";

export interface ToasterOptions {
  /** Where toasts without their own `position` appear. Defaults to `bottom-right`. */
  position?: Position;
  /** Colour scheme of the toasts. Defaults to `system`. */
  theme?: Theme;
  /** Distance from the viewport edges, as one value or per side. */
  offset?: Offset;
  /** Options applied to every toast unless it sets its own. */
  defaults?: Partial<ToastOptions>;
  /** `system` follows `prefers-reduced-motion`. Defaults to `system`. */
  motion?: MotionPreference;
  /** The store to render. Defaults to the store behind the `seintje` API. */
  store?: Store;
  /** Accessible name of the notification region. Defaults to `Notifications`. */
  label?: string;
  /** Shortcut that moves focus to the newest toast. Defaults to `Alt+T`; `false` disables it. */
  hotkey?: string | false;
  className?: string;
}

export interface Toaster {
  readonly element: HTMLElement;
  update(options: Partial<ToasterOptions>): void;
  destroy(): void;
}

interface Timer {
  revision: number;
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | undefined;
}

const alignOf = (position: Position): Align =>
  position.endsWith("left") ? "start" : position.endsWith("right") ? "end" : "center";

const growOf = (position: Position): Grow => (position.startsWith("top") ? "down" : "up");

const cssLength = (value: OffsetValue) => (typeof value === "number" ? `${value}px` : value);

const SIDES = ["top", "right", "bottom", "left"] as const;

interface Hotkey {
  key: string;
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

function parseHotkey(hotkey: string): Hotkey {
  const parts = hotkey.split("+").map((part) => part.trim().toLowerCase());
  const key = parts.pop() ?? "";
  return {
    key,
    alt: parts.includes("alt") || parts.includes("option"),
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd"),
  };
}

function matchesHotkey(event: KeyboardEvent, hotkey: Hotkey): boolean {
  if (event.altKey !== hotkey.alt || event.ctrlKey !== hotkey.ctrl) return false;
  if (event.shiftKey !== hotkey.shift || event.metaKey !== hotkey.meta) return false;
  // `code` survives Alt producing a different character, as it does on macOS.
  const code = event.code.toLowerCase();
  return (
    event.key.toLowerCase() === hotkey.key || code === `key${hotkey.key}` || code === hotkey.key
  );
}

/**
 * Renders the toasts of a store into `target`. Works on its own in any page;
 * the Vue and Svelte packages wrap it.
 */
export function createToaster(
  target: HTMLElement | string = document.body,
  initialOptions: ToasterOptions = {},
): Toaster {
  const host = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (!host) throw new Error(`seintje: no element matches "${String(target)}"`);

  const doc = host.ownerDocument;
  let options: ToasterOptions = { ...initialOptions };
  const store = options.store ?? defaultStore;

  const position = () => options.position ?? "bottom-right";
  store.defaultPosition = position();

  const root = doc.createElement("section");
  root.setAttribute("data-seintje", "");
  root.tabIndex = -1;
  root.style.setProperty("--seintje-width", `${TOAST_WIDTH}px`);

  const politeRegion = doc.createElement("div");
  politeRegion.setAttribute("data-seintje-live", "");
  politeRegion.setAttribute("role", "status");
  politeRegion.setAttribute("aria-live", "polite");
  const assertiveRegion = doc.createElement("div");
  assertiveRegion.setAttribute("data-seintje-live", "");
  assertiveRegion.setAttribute("role", "alert");
  assertiveRegion.setAttribute("aria-live", "assertive");
  root.append(politeRegion, assertiveRegion);
  host.append(root);

  const viewports = new Map<Position, HTMLOListElement>();
  const views = new Map<string, { view: ToastView; position: Position }>();
  const timers = new Map<string, Timer>();
  const engaged = new Set<ToastView>();
  const announceTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  let returnFocus: HTMLElement | null = null;
  let stopTheme = () => {};

  const motion = new MotionSettings(options.motion ?? "system");

  /* ---------------------------------------------------------- Appearance */

  const applyAppearance = () => {
    root.className = options.className ?? "";
    const label = options.label ?? "Notifications";
    const hotkey = options.hotkey ?? "Alt+T";
    root.setAttribute("aria-label", hotkey ? `${label} (${hotkey})` : label);

    const offset = options.offset;
    for (const side of SIDES) {
      const value =
        offset === undefined ? undefined : typeof offset === "object" ? offset[side] : offset;
      if (value === undefined) root.style.removeProperty(`--seintje-offset-${side}`);
      else root.style.setProperty(`--seintje-offset-${side}`, cssLength(value));
    }

    stopTheme();
    stopTheme = watchTheme(options.theme ?? "system", (resolved) => {
      root.dataset.theme = resolved;
    });
  };

  /* ------------------------------------------------------------ Viewports */

  const viewportFor = (pos: Position) => {
    let list = viewports.get(pos);
    if (!list) {
      list = doc.createElement("ol");
      list.setAttribute("data-seintje-viewport", "");
      list.dataset.position = pos;
      root.append(list);
      viewports.set(pos, list);
    }
    return list;
  };

  const pruneViewports = () => {
    for (const [pos, list] of viewports) {
      if (list.childElementCount === 0) {
        list.remove();
        viewports.delete(pos);
      }
    }
  };

  /* ------------------------------------------------------------- Timers */

  const paused = () => engaged.size > 0 || doc.visibilityState === "hidden";

  const startTimer = (id: string, timer: Timer) => {
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => {
      timer.handle = undefined;
      store.dismiss(id);
    }, timer.remaining);
  };

  const pauseTimers = () => {
    const now = Date.now();
    for (const timer of timers.values()) {
      if (timer.handle === undefined) continue;
      clearTimeout(timer.handle);
      timer.handle = undefined;
      timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
    }
  };

  const resumeTimers = () => {
    for (const [id, timer] of timers) if (timer.handle === undefined) startTimer(id, timer);
  };

  const syncPause = () => {
    if (paused()) pauseTimers();
    else resumeTimers();
  };

  const dropTimer = (id: string) => {
    const timer = timers.get(id);
    if (timer?.handle !== undefined) clearTimeout(timer.handle);
    timers.delete(id);
  };

  const schedule = (record: ToastRecord, view: ToastView) => {
    const duration = record.closing ? null : resolveDuration(record, view.options);
    const existing = timers.get(record.id);
    if (duration === null) {
      dropTimer(record.id);
      return;
    }
    if (existing && existing.revision === record.revision) return;
    dropTimer(record.id);
    const timer: Timer = {
      revision: record.revision,
      remaining: duration,
      startedAt: 0,
      handle: undefined,
    };
    timers.set(record.id, timer);
    if (!paused()) startTimer(record.id, timer);
  };

  /* ------------------------------------------------------- Announcements */

  const announce = (view: ToastView) => {
    const region = view.important ? assertiveRegion : politeRegion;
    clearTimeout(announceTimers.get(region));
    region.textContent = "";
    // A short gap makes screen readers treat repeated text as a new message.
    announceTimers.set(
      region,
      setTimeout(() => {
        region.textContent = view.announcement;
      }, 60),
    );
  };

  /* -------------------------------------------------------------- Focus */

  const focusTarget = (view: ToastView): ToastView | undefined => {
    const siblings = [...(view.element.parentElement?.children ?? [])];
    const index = siblings.indexOf(view.element);
    const candidates = [...siblings.slice(index + 1), ...siblings.slice(0, index).reverse()];
    for (const element of candidates) {
      const match = [...views.values()].find((entry) => entry.view.element === element);
      if (match && !match.view.record.closing) return match.view;
    }
    return undefined;
  };

  const latestView = (): ToastView | undefined => {
    const records = store.getSnapshot();
    for (let i = records.length - 1; i >= 0; i--) {
      const record = records[i];
      if (!record || record.closing) continue;
      const entry = views.get(record.id);
      if (entry) return entry.view;
    }
    return undefined;
  };

  const ctxFor = (pos: Position) => ({
    doc,
    motion,
    align: alignOf(pos),
    grow: growOf(pos),
    defaults: () => options.defaults ?? {},
    dismiss: (view: ToastView, via: "pointer" | "keyboard" | "swipe") => {
      if (via === "keyboard" && view.element.contains(doc.activeElement)) {
        const next = focusTarget(view);
        if (next) next.focus();
        else if (returnFocus?.isConnected) returnFocus.focus();
        else root.focus();
      }
      store.dismiss(view.id);
    },
    interact: (view: ToastView, isEngaged: boolean) => {
      if (isEngaged) engaged.add(view);
      else engaged.delete(view);
      syncPause();
      updateActive();
    },
  });

  /* --------------------------------------------------------------- Sync */

  const updateActive = () => {
    const records = store.getSnapshot();
    const activeByPosition = new Map<Position, ToastView>();
    for (const view of engaged) {
      const entry = views.get(view.id);
      if (entry) activeByPosition.set(entry.position, view);
    }
    for (let i = records.length - 1; i >= 0; i--) {
      const record = records[i];
      if (!record || record.closing) continue;
      const entry = views.get(record.id);
      if (entry && !activeByPosition.has(entry.position)) {
        activeByPosition.set(entry.position, entry.view);
      }
    }
    for (const { view, position: pos } of views.values()) {
      view.setActive(activeByPosition.get(pos) === view);
    }
  };

  const sync = (records: readonly ToastRecord[]) => {
    const seen = new Set<string>();
    for (const record of records) {
      seen.add(record.id);
      const pos = record.options.position ?? position();
      let entry = views.get(record.id);

      if (entry && entry.position !== pos) {
        engaged.delete(entry.view);
        entry.view.destroy();
        views.delete(record.id);
        entry = undefined;
      }

      if (!entry) {
        if (record.closing) continue;
        const view = new ToastView(record, ctxFor(pos));
        const list = viewportFor(pos);
        if (growOf(pos) === "down") list.prepend(view.element);
        else list.append(view.element);
        entry = { view, position: pos };
        views.set(record.id, entry);
        view.mount();
        announce(view);
      } else {
        const { view } = entry;
        const before = view.record;
        view.update(record);
        if (!record.closing && record.revision !== before.revision) announce(view);
        if (record.closing) engaged.delete(view);
      }
      schedule(record, entry.view);
    }

    for (const [id, entry] of views) {
      if (seen.has(id)) continue;
      engaged.delete(entry.view);
      entry.view.destroy();
      views.delete(id);
      dropTimer(id);
    }

    pruneViewports();
    syncPause();
    updateActive();
  };

  /* ------------------------------------------------------------- Events */

  const onKeydown = (event: KeyboardEvent) => {
    const hotkey = options.hotkey ?? "Alt+T";
    if (!hotkey || !matchesHotkey(event, parseHotkey(hotkey))) return;
    const view = latestView();
    if (!view) return;
    event.preventDefault();
    const active = doc.activeElement;
    if (!root.contains(active)) returnFocus = active instanceof HTMLElement ? active : null;
    view.focus();
  };

  const onRootKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.target !== root) return;
    const view = latestView();
    if (view?.dismissible) store.dismiss(view.id);
  };

  const onVisibility = () => syncPause();

  doc.addEventListener("keydown", onKeydown);
  doc.addEventListener("visibilitychange", onVisibility);
  root.addEventListener("keydown", onRootKeydown);

  applyAppearance();
  const unsubscribe = store.subscribe(sync);

  return {
    element: root,

    update(next) {
      const previous = options;
      options = { ...options, ...next };
      if (next.store && next.store !== store) {
        console.warn("seintje: the store of a toaster cannot be changed after creation");
      }
      store.defaultPosition = position();
      motion.setPreference(options.motion ?? "system");
      applyAppearance();
      if (previous.defaults !== options.defaults) {
        for (const { view } of views.values()) view.refresh();
      }
      sync(store.getSnapshot());
    },

    destroy() {
      unsubscribe();
      doc.removeEventListener("keydown", onKeydown);
      doc.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("keydown", onRootKeydown);
      stopTheme();
      motion.destroy();
      for (const id of [...timers.keys()]) dropTimer(id);
      for (const timer of announceTimers.values()) clearTimeout(timer);
      for (const { view } of views.values()) view.destroy();
      views.clear();
      engaged.clear();
      root.remove();
    },
  };
}
