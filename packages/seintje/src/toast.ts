import {
  animateElement,
  Channel,
  FADE_IN,
  FADE_OUT,
  INSTANT,
  type MotionSettings,
} from "./animation";
import {
  AUTO_CLOSE_LEAD,
  AUTO_OPEN_DELAY,
  DEFAULT_DURATION,
  DEFAULT_RADIUS,
  HEAD_HEIGHT,
  LEAVE_GRACE_MS,
  MIN_BODY_HEIGHT,
  STACK_GAP,
  SWAP_MS,
  SWIPE_AXIS_LOCK,
  SWIPE_DISMISS_DISTANCE,
  SWIPE_MAX_TRAVEL,
  SWIPE_X_DISMISS_DISTANCE,
  SWIPE_X_FLICK_VELOCITY,
  TOAST_WIDTH,
} from "./constants";
import { hasContent, mountContent } from "./content";
import { createGooeyCanvas, type GooeyCanvas } from "./gooey";
import { createCloseIcon, createIcon, isSvgMarkup, parseSvg } from "./icons";
import type { BuiltInToastType, Content, ToastOptions, ToastRecord, ToastType } from "./types";

export type Align = "start" | "center" | "end";
export type Grow = "down" | "up";

export interface ToastContext {
  doc: Document;
  motion: MotionSettings;
  align: Align;
  grow: Grow;
  /** Toaster defaults for a type, merged under each toast's own options. */
  defaults: (type: ToastType) => Partial<ToastOptions>;
  dismiss: (view: ToastView, via: "pointer" | "keyboard" | "swipe") => void;
  /** Reports pointer or focus entering (`true`) or leaving (`false`) the toast. */
  interact: (view: ToastView, engaged: boolean) => void;
}

/** Title per built-in type. Custom types fall back to the neutral title. */
export const DEFAULT_TITLES: Record<BuiltInToastType, string> = {
  neutral: "Notification",
  success: "Success",
  info: "Info",
  warning: "Warning",
  error: "Error",
  loading: "Loading",
};

let viewCounter = 0;

const div = (doc: Document, attr: string) => {
  const node = doc.createElement("div");
  node.setAttribute(attr, "");
  return node;
};

const setAttr = (node: Element, name: string, value: string | boolean | undefined) => {
  if (value === undefined || value === false) node.removeAttribute(name);
  else node.setAttribute(name, value === true ? "" : value);
};

const classList = (...names: (string | undefined)[]) => names.filter(Boolean).join(" ");

/** Merges toaster defaults under a toast's options. */
export function resolveOptions(record: ToastRecord, defaults: Partial<ToastOptions>): ToastOptions {
  return {
    ...defaults,
    ...record.options,
    classes: { ...defaults.classes, ...record.options.classes },
  };
}

/** Milliseconds until auto-dismissal, or `null` when the toast stays. */
export function resolveDuration(record: ToastRecord, options: ToastOptions): number | null {
  if (record.type === "loading" && options.duration === undefined) return null;
  const duration = options.duration === undefined ? DEFAULT_DURATION : options.duration;
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return null;
  return duration;
}

interface Heading {
  node: HTMLElement;
  type: ToastType;
  title: string;
  icon: Content | null | undefined;
  cleanup: () => void;
}

/**
 * One toast on screen. Owns its DOM, measures it, and drives every animated
 * value through motion channels.
 */
export class ToastView {
  readonly element: HTMLLIElement;
  record: ToastRecord;
  options: ToastOptions;

  private readonly ctx: ToastContext;
  private readonly uid = `seintje-t${++viewCounter}`;
  private readonly card: HTMLDivElement;
  private readonly canvas: GooeyCanvas;
  private readonly head: HTMLDivElement;
  private readonly headRow: HTMLDivElement;
  private readonly headings: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly body: HTMLDivElement;
  private readonly bodyInner: HTMLDivElement;
  private readonly description: HTMLDivElement;
  private readonly actionButton: HTMLButtonElement;

  private heading: Heading | undefined;
  private descriptionContent: Content | undefined;
  private descriptionCleanup: () => void = () => {};

  private readonly channels: {
    height: Channel;
    gap: Channel;
    swipe: Channel;
    swipeX: Channel;
    headX: Channel;
    pillX: Channel;
    pillWidth: Channel;
    pillHeight: Channel;
    panelHeight: Channel;
    panelOpacity: Channel;
    bodyOpacity: Channel;
  };

  private headWidth = HEAD_HEIGHT;
  /** Grows past `HEAD_HEIGHT` when the action sits under the title. */
  private headHeight = HEAD_HEIGHT;
  private bodyHeight = MIN_BODY_HEIGHT;
  private radius = DEFAULT_RADIUS;
  private wantsOpen = false;
  /** Set once the toast opened while `keepExpanded` is on, so it stays open. */
  private kept = false;
  private active = true;
  private hovered = false;
  private focused = false;
  private closing = false;
  private mounted = false;
  private isOpen = false;

  private pending: ToastRecord | undefined;
  private swapTimer: ReturnType<typeof setTimeout> | undefined;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private swipeStart: { x: number; y: number; time: number } | undefined;
  /** Mouse and pen swipes are vertical only; touch picks an axis once it moves far enough. */
  private swipeAxis: "x" | "y" | undefined;
  private swipeDirection = 0;

  constructor(record: ToastRecord, ctx: ToastContext) {
    const { doc } = ctx;
    this.ctx = ctx;
    this.record = record;
    this.options = resolveOptions(record, ctx.defaults(record.type));

    this.element = doc.createElement("li");
    this.element.setAttribute("data-seintje-toast", "");
    this.element.tabIndex = 0;
    this.element.dataset.grow = ctx.grow;
    this.element.dataset.align = ctx.align;
    this.element.setAttribute("aria-labelledby", `${this.uid}-title`);

    this.card = div(doc, "data-seintje-card");
    const surface = div(doc, "data-seintje-surface");
    this.canvas = createGooeyCanvas(doc, TOAST_WIDTH);
    surface.append(this.canvas.svg);

    this.head = div(doc, "data-seintje-head");
    this.headRow = div(doc, "data-seintje-head-row");
    this.headings = div(doc, "data-seintje-headings");
    this.closeButton = doc.createElement("button");
    this.closeButton.type = "button";
    this.closeButton.setAttribute("data-seintje-close", "");
    this.closeButton.setAttribute("aria-label", "Dismiss notification");
    this.closeButton.append(createCloseIcon());
    this.headRow.append(this.headings, this.closeButton);
    this.actions = div(doc, "data-seintje-actions");
    this.head.append(this.headRow, this.actions);

    this.body = div(doc, "data-seintje-body");
    this.bodyInner = div(doc, "data-seintje-body-inner");
    this.description = div(doc, "data-seintje-description");
    this.description.id = `${this.uid}-description`;
    this.actionButton = doc.createElement("button");
    this.actionButton.type = "button";
    this.actionButton.setAttribute("data-seintje-action", "");
    this.actions.append(this.actionButton);
    this.bodyInner.append(this.description);
    this.body.append(this.bodyInner);

    this.card.append(surface, this.head, this.body);
    this.element.append(this.card);

    const { pill, panel } = this.canvas;
    const px = (value: number) => `${value}px`;
    this.channels = {
      height: new Channel(0, (v) => {
        this.element.style.height = px(Math.max(0, v));
        this.syncSpan();
      }),
      gap: new Channel(-STACK_GAP, (v) => {
        this.element.style.marginTop = px(v);
      }),
      swipe: new Channel(0, () => this.syncSwipe()),
      swipeX: new Channel(0, () => this.syncSwipe()),
      // The description travels with the title, so their left edges stay lined up.
      headX: new Channel(0, (v) => {
        this.head.style.transform = `translateX(${v}px)`;
        this.bodyInner.style.transform = `translateX(${v}px)`;
      }),
      pillX: new Channel(0, () => this.syncSpan()),
      pillWidth: new Channel(HEAD_HEIGHT, () => this.syncSpan()),
      pillHeight: new Channel(HEAD_HEIGHT, (v) =>
        pill.setAttribute("height", String(Math.max(0, v))),
      ),
      panelHeight: new Channel(0, (v) => panel.setAttribute("height", String(Math.max(0, v)))),
      panelOpacity: new Channel(0, (v) => panel.setAttribute("opacity", String(v))),
      bodyOpacity: new Channel(0, (v) => {
        this.body.style.opacity = String(v);
      }),
    };
    this.syncSpan();

    this.bindEvents();
    this.render(record, false);
  }

  /* ---------------------------------------------------------------- Public */

  get id(): string {
    return this.record.id;
  }

  get open(): boolean {
    return this.isOpen;
  }

  get engaged(): boolean {
    return this.hovered || this.focused;
  }

  get dismissible(): boolean {
    return this.options.dismissible !== false;
  }

  /** Text read out by the live region. */
  get announcement(): string {
    const title = this.titleText;
    const description = this.description.textContent?.trim() ?? "";
    return description ? `${title}. ${description}` : title;
  }

  get important(): boolean {
    return this.options.important ?? this.record.type === "error";
  }

  /** Call once the element is in the document. Measures and plays the entrance. */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    this.observe();
    this.applyRadius();
    this.measure();

    const motion = this.ctx.motion;
    const fromY = this.ctx.grow === "down" ? -10 : 10;
    this.channels.height.to(this.headHeight, motion.spring());
    this.channels.gap.to(0, motion.spring());
    if (motion.reduced) {
      animateElement(this.element, { opacity: [0, 1] }, FADE_IN);
    } else {
      animateElement(
        this.element,
        { opacity: [0, 1], y: [fromY, 0], scale: [0.94, 1] },
        motion.spring(),
      );
    }
    this.layout(true);
    this.restartAutopilot();
  }

  /** Applies a new store record. Content swaps wait for the toast to close first. */
  update(record: ToastRecord): void {
    if (record.closing && !this.closing) {
      this.record = record;
      this.exit();
      return;
    }
    if (record.revision === this.record.revision && !this.pending) {
      this.record = record;
      return;
    }
    if (this.closing) {
      // Revived by an upsert with the same id while animating out.
      this.closing = false;
      this.element.removeAttribute("data-closing");
      this.element.inert = false;
      this.channels.gap.to(0, this.ctx.motion.spring());
      animateElement(this.element, { opacity: 1, y: 0, scale: 1 }, this.ctx.motion.spring());
    }

    clearTimeout(this.swapTimer);
    if (this.isOpen && this.mounted) {
      this.pending = record;
      this.wantsOpen = false;
      this.layout();
      this.swapTimer = setTimeout(() => this.flushPending(), SWAP_MS);
    } else {
      this.pending = undefined;
      this.render(record, true);
    }
  }

  /** Re-reads toaster defaults and re-renders the current record. */
  refresh(): void {
    this.render(this.pending ?? this.record, true);
  }

  /** Only the active toast of a stack may open, unless it keeps expanded. */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.layout();
  }

  /** Focuses the toast element. */
  focus(): void {
    this.element.focus({ preventScroll: true });
  }

  destroy(): void {
    this.clearTimers();
    this.resizeObserver?.disconnect();
    this.heading?.cleanup();
    this.descriptionCleanup();
    for (const channel of Object.values(this.channels)) channel.destroy();
    this.element.remove();
  }

  private syncSwipe(): void {
    // Called while the channels are still being created.
    if (!this.channels) return;
    const x = this.channels.swipeX.current;
    const y = this.channels.swipe.current;
    this.card.style.transform = x === 0 && y === 0 ? "" : `translate(${x}px, ${y}px)`;
    this.card.style.opacity = x === 0 ? "" : String(Math.max(0, 1 - Math.abs(x) / TOAST_WIDTH));
  }

  /* --------------------------------------------------------------- Render */

  private get titleText(): string {
    const { type } = this.record;
    const fallback = Object.hasOwn(DEFAULT_TITLES, type)
      ? DEFAULT_TITLES[type as BuiltInToastType]
      : DEFAULT_TITLES.neutral;
    return this.options.title || fallback;
  }

  private get hasBody(): boolean {
    return hasContent(this.options.description);
  }

  private flushPending(): void {
    const next = this.pending;
    this.pending = undefined;
    if (next) this.render(next, true);
  }

  private render(record: ToastRecord, animated: boolean): void {
    this.record = record;
    this.options = resolveOptions(record, this.ctx.defaults(record.type));
    const { options } = this;
    const type = record.type;
    const classes = options.classes ?? {};

    this.element.dataset.type = type;
    this.element.dataset.title =
      options.titlePosition ?? (this.ctx.grow === "down" ? "top" : "bottom");
    this.element.className = classList(options.className, classes.toast);
    this.element.setAttribute("aria-busy", type === "loading" ? "true" : "false");
    if (options.fill) this.element.style.setProperty("--seintje-fill", options.fill);
    else this.element.style.removeProperty("--seintje-fill");
    this.applyRadius();
    this.closeButton.hidden = !this.dismissible;

    this.renderHeading(type, this.titleText, options.icon, classes, animated);

    if (options.description !== this.descriptionContent) {
      this.descriptionCleanup();
      this.descriptionContent = options.description;
      this.descriptionCleanup = mountContent(this.description, options.description);
    }
    this.description.className = classList(classes.description);
    this.description.hidden = !hasContent(options.description);
    setAttr(
      this.element,
      "aria-describedby",
      hasContent(options.description) ? this.description.id : undefined,
    );

    const action = options.action;
    this.actionButton.hidden = !action;
    this.actionButton.textContent = action?.label ?? "";
    this.actionButton.className = classList(classes.action);
    this.actionButton.dataset.type = type;
    // With a description the action sits in the body, under the text, whatever
    // `actionPlacement` says. Otherwise it goes with the title.
    const inBody = hasContent(options.description);
    const inline = !inBody && options.actionPlacement !== "below";
    this.actions.hidden = !action || inline;
    setAttr(this.element, "data-action-visibility", action ? options.actionVisibility : undefined);
    // Only move nodes when the placement changes, so the button keeps focus otherwise.
    const actionsParent = inBody ? this.bodyInner : this.head;
    if (this.actions.parentElement !== actionsParent) actionsParent.append(this.actions);
    const parent = inline ? this.headRow : this.actions;
    if (this.actionButton.parentElement !== parent) {
      parent.insertBefore(this.actionButton, inline ? this.closeButton : null);
    }

    if (this.mounted) {
      this.measure();
      this.restartAutopilot();
      this.layout();
    }
  }

  private renderHeading(
    type: ToastType,
    title: string,
    icon: Content | null | undefined,
    classes: NonNullable<ToastOptions["classes"]>,
    animated: boolean,
  ): void {
    const previous = this.heading;
    if (previous && previous.type === type && previous.title === title && previous.icon === icon) {
      const iconSlot = previous.node.querySelector<HTMLElement>("[data-seintje-icon]");
      if (iconSlot) iconSlot.className = classList(classes.icon);
      const titleNode = previous.node.querySelector<HTMLElement>("[data-seintje-title]");
      if (titleNode) titleNode.className = classList(classes.title);
      return;
    }

    const { doc, motion } = this.ctx;
    const node = div(doc, "data-seintje-heading");
    node.dataset.type = type;

    let cleanup = () => {};
    if (icon !== null) {
      const iconSlot = doc.createElement("span");
      iconSlot.setAttribute("data-seintje-icon", "");
      iconSlot.className = classList(classes.icon);
      iconSlot.setAttribute("aria-hidden", "true");
      if (icon === undefined) iconSlot.append(createIcon(type));
      else if (typeof icon === "string" && isSvgMarkup(icon)) {
        const svg = parseSvg(doc, icon);
        if (svg) iconSlot.append(svg);
      } else cleanup = mountContent(iconSlot, icon);
      node.append(iconSlot);
    }
    const titleNode = doc.createElement("span");
    titleNode.setAttribute("data-seintje-title", "");
    titleNode.className = classList(classes.title);
    titleNode.textContent = title;
    node.append(titleNode);

    if (previous) {
      previous.node.id = "";
      previous.node.querySelector("[data-seintje-title]")?.removeAttribute("id");
      previous.node.dataset.leaving = "";
      previous.node.setAttribute("aria-hidden", "true");
    }
    titleNode.id = `${this.uid}-title`;
    this.headings.prepend(node);
    this.heading = { node, type, title, icon, cleanup };

    if (!previous) return;
    if (!animated || !this.mounted) {
      previous.cleanup();
      previous.node.remove();
      return;
    }

    const blur = !motion.reduced;
    animateElement(
      node,
      blur ? { opacity: [0, 1], filter: ["blur(5px)", "blur(0px)"] } : { opacity: [0, 1] },
      FADE_IN,
    );
    animateElement(
      previous.node,
      blur ? { opacity: 0, filter: "blur(5px)" } : { opacity: 0 },
      FADE_OUT,
    )
      .finished.catch(() => {})
      .then(() => {
        previous.cleanup();
        previous.node.remove();
      });
  }

  /* ---------------------------------------------------------------- Layout */

  private measure(): void {
    const width = this.head.offsetWidth;
    if (width > 0) this.headWidth = Math.min(TOAST_WIDTH, Math.max(HEAD_HEIGHT, width));
    this.headHeight = Math.max(HEAD_HEIGHT, this.head.offsetHeight);
    this.element.style.setProperty("--seintje-head-size", `${this.headHeight}px`);
    const height = this.bodyInner.offsetHeight;
    this.bodyHeight = Math.max(MIN_BODY_HEIGHT, height);
  }

  private observe(): void {
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(() => {
      this.measure();
      this.layout();
    });
    this.resizeObserver.observe(this.head);
    this.resizeObserver.observe(this.bodyInner);
  }

  /**
   * Keeps the pill, the panel under it and the body's clip on the same
   * span, so the shape grows as one piece and the description never shows
   * outside it or on top of the title.
   */
  private syncSpan(): void {
    const { channels } = this;
    if (!channels) return;
    const x = channels.pillX.current;
    const width = Math.max(0, channels.pillWidth.current);
    const { pill, panel } = this.canvas;
    for (const rect of [pill, panel]) {
      rect.setAttribute("x", String(x));
      rect.setAttribute("width", String(width));
    }
    const right = Math.max(0, TOAST_WIDTH - x - width);
    const hidden = Math.max(0, this.bodyHeight - (channels.height.current - this.headHeight));
    this.body.style.clipPath = `inset(0 ${right}px ${hidden}px ${Math.max(0, x)}px)`;
    // The header hugs its text, so the close button rides the pill's right
    // edge to stay in the card's corner while the pill is wider than that.
    // With the title at the bottom it also climbs over the body to the top
    // edge. With the title at the top it is already there.
    const shiftX = Math.max(0, width - this.headWidth);
    const shiftY =
      this.element.dataset.title === "bottom"
        ? Math.max(0, channels.height.current - this.headHeight)
        : 0;
    this.closeButton.style.transform =
      shiftX > 0 || shiftY > 0 ? `translate(${shiftX}px, ${-shiftY}px)` : "";
  }

  /**
   * The `radius` option wins over `--seintje-radius`, which can only be read
   * once the toast is in the document.
   */
  private applyRadius(): void {
    let radius = this.options.radius;
    if (radius === undefined && this.element.isConnected) {
      const value = getComputedStyle(this.element).getPropertyValue("--seintje-radius");
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) radius = parsed;
    }
    this.radius = Math.max(0, radius ?? DEFAULT_RADIUS);
    this.canvas.setRadius(this.radius);
  }

  private layout(initial = false): void {
    if (!this.mounted) return;
    const { motion, align } = this.ctx;
    const open =
      !this.closing &&
      // A stack opens one toast at a time, except those that keep expanded.
      (this.active || this.keepExpanded) &&
      this.wantsOpen &&
      this.hasBody &&
      this.record.type !== "loading" &&
      !this.pending;
    const opening = open && !this.isOpen;
    this.isOpen = open;
    if (open && this.keepExpanded) this.kept = true;

    this.element.dataset.open = String(open);
    this.body.inert = !open;

    const { radius } = this;
    // Collapsed, the pill hugs the header. Open, it spans the full card so the
    // title bar is as wide as the description below it.
    const restingX =
      align === "start"
        ? 0
        : align === "end"
          ? TOAST_WIDTH - this.headWidth
          : (TOAST_WIDTH - this.headWidth) / 2;
    const pillWidth = open ? TOAST_WIDTH : this.headWidth;
    const pillX = open ? 0 : restingX;
    const { bodyHeight, headHeight } = this;
    this.canvas.svg.setAttribute("height", String(headHeight + bodyHeight));
    this.body.style.height = `${bodyHeight}px`;

    const shape = initial ? INSTANT : motion.spring(!open);
    // Sideways movement never overshoots: the card's edges are hard limits.
    const span = initial ? INSTANT : motion.spring(true);
    const { channels } = this;
    channels.pillX.to(pillX, span);
    channels.headX.to(pillX, span);
    channels.pillWidth.to(pillWidth, span);
    channels.pillHeight.to(open ? headHeight + radius : headHeight, shape);
    // The panel starts inside the pill's straight section. If it started at the
    // pill's bottom edge, both shapes would round off at the same height and
    // the outline would pinch in where they meet.
    this.canvas.panel.setAttribute("y", String(headHeight - radius));
    channels.panelHeight.to(open ? bodyHeight + radius : 0, motion.spring(!open));
    channels.panelOpacity.to(open ? 1 : 0, motion.reduced ? INSTANT : open ? FADE_IN : FADE_OUT);
    channels.bodyOpacity.to(
      open ? 1 : 0,
      open ? { ...FADE_IN, delay: opening && !motion.reduced ? 0.14 : 0 } : FADE_OUT,
    );
    if (!this.closing) {
      channels.height.to(open ? headHeight + bodyHeight : headHeight, motion.spring(!open));
    }
  }

  /* ------------------------------------------------------------- Autopilot */

  private clearTimers(): void {
    clearTimeout(this.swapTimer);
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    clearTimeout(this.leaveTimer);
  }

  private get keepExpanded(): boolean {
    return this.options.keepExpanded === true;
  }

  private restartAutopilot(): void {
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    if (!this.keepExpanded) this.kept = false;
    if (this.engaged || (this.kept && this.hasBody)) {
      this.wantsOpen = true;
      return;
    }
    this.wantsOpen = false;
    const setting = this.options.autoExpand ?? true;
    if (setting === false || !this.hasBody || this.closing) return;

    const config = typeof setting === "object" ? setting : {};
    const delay = Math.max(0, config.delay ?? AUTO_OPEN_DELAY);
    const duration = resolveDuration(this.record, this.options);
    const hold =
      config.hold ?? (duration === null ? null : Math.max(0, duration - delay - AUTO_CLOSE_LEAD));

    this.openTimer = setTimeout(() => {
      this.wantsOpen = true;
      this.layout();
    }, delay);
    // `setTimeout` fires at once for `Infinity`, so a non-finite hold means stay open.
    if (!this.keepExpanded && hold !== null && hold > 0 && Number.isFinite(hold)) {
      this.closeTimer = setTimeout(() => {
        if (this.engaged) return;
        this.wantsOpen = false;
        this.layout();
      }, delay + hold);
    }
  }

  /* ------------------------------------------------------------------ Exit */

  private exit(): void {
    this.closing = true;
    this.clearTimers();
    this.pending = undefined;
    this.hovered = false;
    this.focused = false;
    this.element.dataset.closing = "";
    this.layout();

    const { motion } = this.ctx;
    const flat = motion.spring(true);
    this.channels.height.to(0, flat);
    this.channels.gap.to(-STACK_GAP, flat);
    if (motion.reduced) {
      animateElement(this.element, { opacity: 0 }, FADE_OUT);
    } else {
      if (this.swipeAxis === "x") {
        const { swipeX } = this.channels;
        swipeX.to(swipeX.current + this.swipeDirection * TOAST_WIDTH * 0.5, flat);
      } else {
        const drift = this.swipeDirection || (this.ctx.grow === "down" ? -1 : 1);
        this.channels.swipe.to(this.channels.swipe.current + drift * 16, flat);
      }
      animateElement(this.element, { opacity: 0, scale: 0.94 }, flat);
    }
    // Set after the animation starts so focus can move away first.
    queueMicrotask(() => {
      this.element.inert = true;
    });
  }

  /* ---------------------------------------------------------------- Events */

  private bindEvents(): void {
    const { element } = this;

    element.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch" || this.closing) return;
      clearTimeout(this.leaveTimer);
      if (this.hovered) return;
      this.hovered = true;
      this.engage();
    });
    element.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch" || !this.hovered) return;
      clearTimeout(this.leaveTimer);
      this.leaveTimer = setTimeout(() => {
        this.hovered = false;
        this.disengage();
      }, LEAVE_GRACE_MS);
    });
    element.addEventListener("focusin", () => {
      if (this.focused || this.closing) return;
      this.focused = true;
      this.engage();
    });
    element.addEventListener("focusout", (event) => {
      if (element.contains(event.relatedTarget as Node | null)) return;
      if (!this.focused) return;
      this.focused = false;
      this.disengage();
    });
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.dismissible || this.closing) return;
      event.preventDefault();
      event.stopPropagation();
      this.ctx.dismiss(this, "keyboard");
    });

    this.closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.ctx.dismiss(this, event.detail === 0 ? "keyboard" : "pointer");
    });

    this.actionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = this.options.action;
      if (!action) return;
      action.onClick(event, { id: this.id, dismiss: () => this.ctx.dismiss(this, "pointer") });
      if (action.dismiss) this.ctx.dismiss(this, event.detail === 0 ? "keyboard" : "pointer");
    });

    element.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    element.addEventListener("pointermove", (event) => this.onPointerMove(event));
    element.addEventListener("pointerup", (event) => this.onPointerUp(event));
    element.addEventListener("pointercancel", (event) => this.onPointerUp(event, true));
  }

  private engage(): void {
    this.wantsOpen = true;
    clearTimeout(this.closeTimer);
    this.ctx.interact(this, true);
    this.layout();
  }

  private disengage(): void {
    if (this.engaged) return;
    if (!this.kept) this.wantsOpen = false;
    this.ctx.interact(this, false);
    this.layout();
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.dismissible || this.closing || event.button !== 0) return;
    if ((event.target as Element | null)?.closest("button")) return;
    this.swipeStart = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    this.swipeAxis = event.pointerType === "touch" ? undefined : "y";
    this.element.setPointerCapture?.(event.pointerId);
    this.element.dataset.swiping = "";
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.swipeStart === undefined) return;
    const dx = event.clientX - this.swipeStart.x;
    const dy = event.clientY - this.swipeStart.y;
    if (!this.swipeAxis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_AXIS_LOCK) return;
      this.swipeAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (this.swipeAxis === "x") {
      // Sideways follows the finger, so the toast can be thrown off screen.
      this.channels.swipeX.set(dx);
      return;
    }
    // Rubber band: easy to start, harder the further it travels.
    const travel = SWIPE_MAX_TRAVEL * (1 - Math.exp(-Math.abs(dy) / SWIPE_MAX_TRAVEL));
    this.channels.swipe.set(Math.sign(dy) * travel);
  }

  private onPointerUp(event: PointerEvent, cancelled = false): void {
    if (this.swipeStart === undefined) return;
    const start = this.swipeStart;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    this.swipeStart = undefined;
    delete this.element.dataset.swiping;
    this.element.releasePointerCapture?.(event.pointerId);

    if (!cancelled && this.swipeAxis === "x") {
      const velocity = Math.abs(dx) / Math.max(1, event.timeStamp - start.time);
      const flicked = velocity >= SWIPE_X_FLICK_VELOCITY && Math.abs(dx) >= SWIPE_AXIS_LOCK * 2;
      if (Math.abs(dx) >= SWIPE_X_DISMISS_DISTANCE || flicked) {
        this.swipeDirection = Math.sign(dx);
        this.ctx.dismiss(this, "swipe");
        return;
      }
    } else if (!cancelled && this.swipeAxis === "y" && Math.abs(dy) >= SWIPE_DISMISS_DISTANCE) {
      this.swipeDirection = Math.sign(dy);
      this.ctx.dismiss(this, "swipe");
      return;
    }
    this.swipeAxis = undefined;
    const spring = this.ctx.motion.spring();
    this.channels.swipe.to(0, spring);
    this.channels.swipeX.to(0, spring);
  }
}
