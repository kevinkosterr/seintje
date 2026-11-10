import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createApi } from "../src/api";
import { HEAD_HEIGHT, TOAST_WIDTH } from "../src/constants";
import { createStore } from "../src/store";
import { createToaster, type Toaster } from "../src/toaster";

const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

let toaster: Toaster | undefined;
let host: HTMLElement;

const setup = (options: Parameters<typeof createToaster>[1] = {}) => {
  const store = createStore({ exitDuration: 10 });
  const api = createApi(store);
  toaster = createToaster(host, { motion: "reduce", ...options, store });
  return { api, store, root: toaster.element };
};

const toasts = () => [...host.querySelectorAll<HTMLElement>("[data-seintje-toast]")];

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  toaster?.destroy();
  toaster = undefined;
  host.remove();
});

describe("rendering", () => {
  test("renders toasts into a viewport per position", () => {
    const { api } = setup({ position: "top-left" });
    api.success("Saved");
    api.info({ title: "Moved", position: "bottom-center" });
    const viewports = [...host.querySelectorAll<HTMLElement>("[data-seintje-viewport]")];
    expect(viewports.map((viewport) => viewport.dataset.position)).toEqual([
      "top-left",
      "bottom-center",
    ]);
    expect(toasts().map((toast) => toast.dataset.type)).toEqual(["success", "info"]);
  });

  test("newest toast sits nearest to the edge", () => {
    const { api } = setup({ position: "top-right" });
    api.show("First");
    api.show("Second");
    expect(toasts().map((toast) => toast.textContent)).toEqual(["Second", "First"]);
  });

  test("falls back to a title per type", () => {
    const { api } = setup();
    api.warning({ description: "Low battery" });
    expect(host.querySelector("[data-seintje-title]")?.textContent).toBe("Warning");
  });

  test("moves toasts when the toaster position changes", () => {
    const { api } = setup({ position: "top-left" });
    api.show("Here");
    toaster?.update({ position: "bottom-right" });
    const viewports = [...host.querySelectorAll<HTMLElement>("[data-seintje-viewport]")];
    expect(viewports.map((viewport) => viewport.dataset.position)).toEqual(["bottom-right"]);
  });

  test("mounts renderer content and runs its cleanup on removal", async () => {
    const cleanup = mock();
    const { api } = setup();
    const id = api.show({
      title: "Custom",
      description: (slot) => {
        slot.innerHTML = "<em>rich</em>";
        return cleanup;
      },
    });
    expect(host.querySelector("[data-seintje-description] em")?.textContent).toBe("rich");
    api.dismiss(id);
    await flush(20);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(toasts()).toHaveLength(0);
  });

  test("applies per-toast classes and fill", () => {
    const { api } = setup();
    api.show({
      title: "Styled",
      fill: "rebeccapurple",
      className: "mine",
      classes: { title: "t" },
    });
    const [toast] = toasts();
    expect(toast?.classList.contains("mine")).toBe(true);
    expect(toast?.style.getPropertyValue("--seintje-fill")).toBe("rebeccapurple");
    expect(host.querySelector("[data-seintje-title]")?.classList.contains("t")).toBe(true);
  });

  test("reads the corner radius from the option or --seintje-radius", async () => {
    const { api } = setup();
    const radiusOf = async (options: Parameters<typeof api.show>[0]) => {
      const id = api.show(options);
      const rx = host.querySelector("[data-seintje-pill]")?.getAttribute("rx");
      api.dismiss(id);
      await flush(20);
      return rx;
    };
    expect(await radiusOf({ title: "Default" })).toBe("18");
    const style = document.createElement("style");
    style.textContent = "[data-seintje-toast] { --seintje-radius: 8px; }";
    document.head.append(style);
    try {
      expect(await radiusOf({ title: "Themed" })).toBe("8");
      expect(await radiusOf({ title: "Own", radius: 4 })).toBe("4");
    } finally {
      style.remove();
    }
  });

  test("resolves the theme and offsets on the root", () => {
    const { root } = setup({ theme: "dark", offset: { top: 24, left: "2rem" } });
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.getPropertyValue("--seintje-offset-top")).toBe("24px");
    expect(root.style.getPropertyValue("--seintje-offset-left")).toBe("2rem");
    toaster?.update({ theme: "light" });
    expect(root.dataset.theme).toBe("light");
  });

  test("destroy removes everything", () => {
    const { api } = setup();
    api.show("Gone soon");
    toaster?.destroy();
    toaster = undefined;
    expect(host.childElementCount).toBe(0);
  });
});

describe("title position", () => {
  test("follows the position by default", () => {
    const { api } = setup({ position: "bottom-right" });
    api.show({ title: "Bottom" });
    api.show({ title: "Top", position: "top-left" });
    expect(toasts().map((toast) => toast.dataset.title)).toEqual(["bottom", "top"]);
  });

  test("can sit on top of the description at a bottom position", () => {
    const { api } = setup({ position: "bottom-right" });
    api.show({ title: "a", description: "b", titlePosition: "top" });
    const toast = toasts()[0] as HTMLElement;
    expect(toast.dataset.title).toBe("top");
    expect(toast.dataset.grow).toBe("up");
  });

  test("can sit below the description at a top position", () => {
    const { api } = setup({ position: "top-center", defaults: { titlePosition: "bottom" } });
    api.show({ title: "a", description: "b" });
    expect(toasts()[0]?.dataset.title).toBe("bottom");
  });

  test("updates with the toast", () => {
    const { api } = setup();
    const id = api.show({ title: "a", titlePosition: "top" });
    api.show({ id, title: "a", titlePosition: "bottom" });
    expect(toasts()[0]?.dataset.title).toBe("bottom");
  });
});

describe("accessibility", () => {
  test("has no interactive element nested in another", () => {
    const { api } = setup();
    api.show({
      title: "Archived",
      description: "Find it under Archive.",
      action: { label: "Undo", onClick: () => {} },
    });
    const interactive = "button, a[href], input, select, textarea";
    for (const element of host.querySelectorAll(interactive)) {
      expect(element.parentElement?.closest(interactive)).toBeNull();
    }
    const toast = toasts()[0];
    expect(toast?.tagName).toBe("LI");
    expect(toast?.getAttribute("role")).toBeNull();
  });

  test("labels the toast by its title and describes it by its description", () => {
    const { api } = setup();
    api.info({ title: "Heads up", description: "Maintenance tonight." });
    const toast = toasts()[0];
    const label = document.getElementById(toast?.getAttribute("aria-labelledby") ?? "");
    const description = document.getElementById(toast?.getAttribute("aria-describedby") ?? "");
    expect(label?.textContent).toBe("Heads up");
    expect(description?.textContent).toBe("Maintenance tonight.");
  });

  test("buttons are labelled", () => {
    const { api } = setup();
    api.show({ title: "x", action: { label: "Retry", onClick: () => {} } });
    expect(host.querySelector("[data-seintje-close]")?.getAttribute("aria-label")).toBe(
      "Dismiss notification",
    );
    expect(host.querySelector("[data-seintje-action]")?.textContent).toBe("Retry");
  });

  test("announces toasts politely, and errors assertively", async () => {
    const { api, root } = setup();
    api.success({ title: "Saved", description: "All good." });
    api.error("Broken");
    await flush(80);
    expect(root.querySelector("[aria-live=polite]")?.textContent).toBe("Saved. All good.");
    expect(root.querySelector("[aria-live=assertive]")?.textContent).toBe("Broken");
  });

  test("re-announces when a toast's content is replaced", async () => {
    const { api, root } = setup();
    const id = api.loading("Uploading");
    await flush(80);
    api.update(id, { type: "success", title: "Uploaded" });
    await flush(80);
    expect(root.querySelector("[aria-live=polite]")?.textContent).toBe("Uploaded");
  });

  test("the collapsed body is inert", () => {
    const { api } = setup();
    api.show({ title: "x", description: "y", autoExpand: false });
    expect((host.querySelector("[data-seintje-body]") as HTMLElement).inert).toBe(true);
  });

  test("names the region and its hotkey", () => {
    const { root } = setup({ label: "Meldingen", hotkey: "Alt+N" });
    expect(root.getAttribute("aria-label")).toBe("Meldingen (Alt+N)");
  });
});

describe("keyboard", () => {
  test("Escape dismisses the focused toast and moves focus to the next one", () => {
    const { api, store } = setup({ position: "bottom-right" });
    api.show("Older");
    api.show("Newer");
    const [older, newer] = toasts();
    newer?.focus();
    newer?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(store.getSnapshot().map((toast) => toast.closing)).toEqual([false, true]);
    expect(document.activeElement).toBe(older ?? null);
  });

  test("Escape on the region dismisses the newest toast", () => {
    const { api, store, root } = setup();
    api.show("One");
    api.show("Two");
    root.focus();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(store.getSnapshot().map((toast) => toast.closing)).toEqual([false, true]);
  });

  test("Escape does nothing for toasts that are not dismissible", () => {
    const { api, store } = setup();
    api.show({ title: "Stay", dismissible: false });
    toasts()[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(store.getSnapshot()[0]?.closing).toBe(false);
  });

  test("the hotkey focuses the newest toast", () => {
    const { api } = setup();
    api.show("One");
    api.show("Two");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "t", code: "KeyT", altKey: true, bubbles: true }),
    );
    expect(document.activeElement?.textContent).toBe("Two");
  });

  test("the close button and the action dismiss", () => {
    const onClick = mock();
    const { api, store } = setup();
    api.show({ title: "a" });
    api.show({ title: "b", action: { label: "Do", onClick, dismiss: true } });
    host.querySelectorAll<HTMLButtonElement>("[data-seintje-close]")[0]?.click();
    host.querySelectorAll<HTMLButtonElement>("[data-seintje-action]")[1]?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().every((toast) => toast.closing)).toBe(true);
  });

  test("places the action next to the title by default, or under it", () => {
    const { api } = setup();
    api.show({ title: "a", action: { label: "Do", onClick: () => {} }, actionPlacement: "below" });
    api.show({ title: "b", action: { label: "Do", onClick: () => {} } });
    const [below, inline] = host.querySelectorAll<HTMLButtonElement>("[data-seintje-action]");
    expect(below?.parentElement?.hasAttribute("data-seintje-actions")).toBe(true);
    expect(below?.closest("[data-seintje-head]")).not.toBeNull();
    expect(inline?.parentElement?.hasAttribute("data-seintje-head-row")).toBe(true);
  });

  test("an action without a description leaves no body to open", () => {
    const { api } = setup();
    api.show({ title: "x", action: { label: "Do", onClick: () => {} } });
    const toast = toasts()[0] as HTMLElement;
    toast.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(toast.dataset.open).toBe("false");
  });

  test("marks hover-only actions", () => {
    const { api } = setup();
    api.show({ title: "x", action: { label: "Do", onClick: () => {} }, actionVisibility: "hover" });
    expect(toasts()[0]?.getAttribute("data-action-visibility")).toBe("hover");
  });
});

describe("timers", () => {
  test("dismisses after the duration", async () => {
    const { api, store } = setup();
    api.show({ title: "Quick", duration: 20 });
    await flush(40);
    expect(store.getSnapshot()[0]?.closing ?? true).toBe(true);
  });

  test("focus pauses the timer and keeps the remaining time", async () => {
    const { api, store } = setup();
    api.show({ title: "Read me", duration: 60 });
    const toast = toasts()[0] as HTMLElement;
    await flush(30);
    toast.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await flush(80);
    expect(store.getSnapshot()[0]?.closing).toBe(false);
    toast.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
    await flush(10);
    expect(store.getSnapshot()[0]?.closing).toBe(false);
    await flush(50);
    expect(store.getSnapshot()[0]?.closing ?? true).toBe(true);
  });

  test("hover pauses the timer", async () => {
    const { api, store } = setup();
    api.show({ title: "Hover me", duration: 30 });
    toasts()[0]?.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    await flush(60);
    expect(store.getSnapshot()[0]?.closing).toBe(false);
  });

  test("a persistent toast stays", async () => {
    const { api, store } = setup();
    api.show({ title: "Stay", duration: null });
    await flush(30);
    expect(store.getSnapshot()[0]?.closing).toBe(false);
  });
});

describe("swiping", () => {
  const swipe = (toast: HTMLElement, pointerType: string, dx: number, dy = 0) => {
    const head = toast.querySelector("[data-seintje-head]") as HTMLElement;
    const init = { bubbles: true, button: 0, pointerId: 1, pointerType };
    head.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: 0, clientY: 0 }));
    head.dispatchEvent(
      new PointerEvent("pointermove", { ...init, clientX: dx / 2, clientY: dy / 2 }),
    );
    head.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: dx, clientY: dy }));
    head.dispatchEvent(new PointerEvent("pointerup", { ...init, clientX: dx, clientY: dy }));
  };

  test("a sideways touch swipe dismisses", () => {
    const { api, store } = setup();
    api.show({ title: "Swipe me", duration: null });
    swipe(toasts()[0] as HTMLElement, "touch", 120);
    expect(store.getSnapshot()[0]?.closing).toBe(true);
  });

  test("a sideways mouse drag does not dismiss", () => {
    const { api, store } = setup();
    api.show({ title: "Drag me", duration: null });
    swipe(toasts()[0] as HTMLElement, "mouse", 120);
    expect(store.getSnapshot()[0]?.closing).toBe(false);
  });

  test("a vertical touch swipe still dismisses", () => {
    const { api, store } = setup();
    api.show({ title: "Swipe me", duration: null });
    swipe(toasts()[0] as HTMLElement, "touch", 0, -60);
    expect(store.getSnapshot()[0]?.closing).toBe(true);
  });
});

describe("expanding", () => {
  test("opens automatically, and only the newest toast", async () => {
    const { api } = setup({ defaults: { autoExpand: { delay: 0 } } });
    api.show({ title: "a", description: "first" });
    api.show({ title: "b", description: "second" });
    await flush(10);
    expect(toasts().map((toast) => toast.dataset.open)).toEqual(["false", "true"]);
  });

  test("focus opens a toast and makes it the active one", async () => {
    const { api } = setup({ defaults: { autoExpand: false } });
    api.show({ title: "a", description: "first" });
    api.show({ title: "b", description: "second" });
    toasts()[0]?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(toasts().map((toast) => toast.dataset.open)).toEqual(["true", "false"]);
  });

  test("an open toast's title bar spans the full width", async () => {
    const { api } = setup({ position: "top-right", defaults: { autoExpand: { delay: 0 } } });
    api.show({ title: "Wide", description: "As wide as this text block." });
    const pill = host.querySelector("[data-seintje-pill]");
    expect(Number(pill?.getAttribute("width"))).toBeLessThan(TOAST_WIDTH);
    await flush(10);
    expect(toasts()[0]?.dataset.open).toBe("true");
    expect(pill?.getAttribute("width")).toBe(String(TOAST_WIDTH));
    expect(pill?.getAttribute("x")).toBe("0");
  });

  test("the panel shares the pill's span so the shape grows as one piece", () => {
    const { api } = setup({ position: "bottom-right" });
    api.show({ title: "Narrow", description: "Not open yet." });
    const pill = host.querySelector("[data-seintje-pill]");
    const panel = host.querySelector("[data-seintje-panel]");
    expect(Number(pill?.getAttribute("width"))).toBeLessThan(TOAST_WIDTH);
    expect(panel?.getAttribute("x")).toBe(pill?.getAttribute("x"));
    expect(panel?.getAttribute("width")).toBe(pill?.getAttribute("width"));
  });

  test("draws a built-in icon per type", () => {
    const { api } = setup();
    api.success("Done");
    const svg = host.querySelector("[data-seintje-icon] svg");
    expect(svg?.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    const drawn = [...(svg?.children ?? [])].map((child) => child.tagName.toLowerCase());
    expect(drawn).toEqual(["circle", "path"]);
  });

  test("renders inline SVG markup as the icon", () => {
    const { api } = setup();
    api.show({ title: "Svg", icon: '<svg viewBox="0 0 24 24"><path d="M1 1h2"/></svg>' });
    const svg = host.querySelector("[data-seintje-icon] svg");
    expect(svg?.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg?.querySelector("path")?.getAttribute("d")).toBe("M1 1h2");
  });

  test("strips scripts and event handlers from inline SVG", () => {
    const { api } = setup();
    api.show({
      title: "Svg",
      icon: '<svg onload="alert(1)"><a href="javascript:x"><path/></a><script>alert(2)</script></svg>',
    });
    const svg = host.querySelector("[data-seintje-icon] svg");
    expect(svg?.hasAttribute("onload")).toBe(false);
    expect(svg?.querySelector("script")).toBeNull();
    expect(svg?.querySelector("a")?.hasAttribute("href")).toBe(false);
  });

  test("keeps other text icons as text", () => {
    const { api } = setup();
    api.show({ title: "Emoji", icon: "🚀" });
    expect(host.querySelector("[data-seintje-icon]")?.textContent).toBe("🚀");
  });

  test("collapses again once hold runs out", async () => {
    const { api } = setup({ defaults: { autoExpand: { delay: 0, hold: 20 } } });
    api.show({ title: "a", description: "first", duration: null });
    await flush(10);
    expect(toasts()[0]?.dataset.open).toBe("true");
    await flush(30);
    expect(toasts()[0]?.dataset.open).toBe("false");
  });

  test("keepExpanded stays open after hold runs out", async () => {
    const { api } = setup({ defaults: { autoExpand: { delay: 0, hold: 20 } } });
    api.show({ title: "a", description: "first", duration: null, keepExpanded: true });
    await flush(50);
    expect(toasts()[0]?.dataset.open).toBe("true");
  });

  test("keepExpanded stays open when the pointer leaves", () => {
    const { api } = setup({ defaults: { autoExpand: false } });
    api.show({ title: "a", description: "first", keepExpanded: true });
    const toast = toasts()[0] as HTMLElement;
    toast.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    expect(toast.dataset.open).toBe("true");
    toast.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    expect(toast.dataset.open).toBe("true");
  });

  test("without keepExpanded, leaving collapses the toast", () => {
    const { api } = setup({ defaults: { autoExpand: false } });
    api.show({ title: "a", description: "first" });
    const toast = toasts()[0] as HTMLElement;
    toast.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    toast.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    expect(toast.dataset.open).toBe("false");
  });

  test("an infinite hold keeps the toast open", async () => {
    const { api } = setup({ defaults: { autoExpand: { delay: 0, hold: Infinity } } });
    api.show({ title: "a", description: "first", duration: null });
    await flush(20);
    expect(toasts()[0]?.dataset.open).toBe("true");
  });

  test("loading toasts never open", async () => {
    const { api } = setup({ defaults: { autoExpand: { delay: 0 } } });
    api.loading({ title: "Busy", description: "hidden" });
    await flush(10);
    expect(toasts()[0]?.dataset.open).toBe("false");
  });
});

describe("reduced motion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  const fakeMatchMedia = (reduce: boolean) =>
    ((query: string) => ({
      matches: query.includes("reduced-motion") ? reduce : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;

  test("geometry jumps instead of springing when the system asks for less motion", () => {
    window.matchMedia = fakeMatchMedia(true);
    const store = createStore();
    toaster = createToaster(host, { store, motion: "system" });
    createApi(store).show("Calm");
    // Without reduced motion the height would still be springing up from 0.
    expect(toasts()[0]?.style.height).toBe(`${HEAD_HEIGHT}px`);
  });

  test("springs run when motion is allowed", () => {
    window.matchMedia = fakeMatchMedia(false);
    const store = createStore();
    toaster = createToaster(host, { store, motion: "system" });
    createApi(store).show("Lively");
    expect(toasts()[0]?.style.height).not.toBe(`${HEAD_HEIGHT}px`);
  });

  test("the toaster option overrides the system preference", () => {
    window.matchMedia = fakeMatchMedia(false);
    const store = createStore();
    toaster = createToaster(host, { store, motion: "reduce" });
    createApi(store).show("Forced calm");
    expect(toasts()[0]?.style.height).toBe(`${HEAD_HEIGHT}px`);
  });
});

describe("limit", () => {
  const open = (store: ReturnType<typeof createStore>) =>
    store
      .getSnapshot()
      .filter((toast) => !toast.closing)
      .map((toast) => toast.options.title);

  test("dismisses the oldest toast past five by default", () => {
    const { api, store } = setup();
    for (let i = 1; i <= 6; i++) api.show({ title: `Toast ${i}`, duration: null });
    expect(open(store)).toEqual(["Toast 2", "Toast 3", "Toast 4", "Toast 5", "Toast 6"]);
  });

  test("can be configured", () => {
    const { api, store } = setup({ limit: 2 });
    for (let i = 1; i <= 4; i++) api.show({ title: `Toast ${i}`, duration: null });
    expect(open(store)).toEqual(["Toast 3", "Toast 4"]);
  });

  test("counts each position on its own", () => {
    const { api, store } = setup({ limit: 1 });
    api.show({ title: "Corner", duration: null });
    api.show({ title: "Top", position: "top-center", duration: null });
    expect(open(store)).toEqual(["Corner", "Top"]);
  });

  test("applies a lowered limit on update", () => {
    const { api, store } = setup();
    for (let i = 1; i <= 3; i++) api.show({ title: `Toast ${i}`, duration: null });
    toaster?.update({ limit: 1 });
    expect(open(store)).toEqual(["Toast 3"]);
  });

  test("Infinity removes the limit", () => {
    const { api, store } = setup({ limit: Infinity });
    for (let i = 1; i <= 8; i++) api.show({ title: `Toast ${i}`, duration: null });
    expect(open(store)).toHaveLength(8);
  });
});

describe("custom types", () => {
  test("look neutral until configured", () => {
    const { api } = setup();
    api.custom("upload", { description: "photo.jpg" });
    const [toast] = toasts();
    expect(toast?.dataset.type).toBe("upload");
    expect(toast?.querySelector("[data-seintje-title]")?.textContent).toBe("Notification");
    expect(toast?.querySelector("[data-seintje-icon] svg")).not.toBeNull();
  });

  test("take their defaults from the toaster's types", () => {
    const { api } = setup({
      defaults: { fill: "black", classes: { toast: "base" } },
      types: {
        upload: { title: "Uploading", icon: "⇡", fill: "navy", classes: { title: "upload-title" } },
      },
    });
    api.custom("upload", {});
    api.custom("upload", { title: "Photo uploaded", fill: "green" });
    const [first, second] = toasts();
    expect(first?.querySelector("[data-seintje-title]")?.textContent).toBe("Uploading");
    expect(first?.querySelector("[data-seintje-icon]")?.textContent).toBe("⇡");
    expect(first?.style.getPropertyValue("--seintje-fill")).toBe("navy");
    expect(first?.className).toBe("base");
    expect(first?.querySelector("[data-seintje-title]")?.className).toBe("upload-title");
    expect(second?.querySelector("[data-seintje-title]")?.textContent).toBe("Photo uploaded");
    expect(second?.style.getPropertyValue("--seintje-fill")).toBe("green");
  });

  test("can change the built-in types too", () => {
    const { api } = setup({ types: { success: { title: "Nice" } } });
    api.success({});
    api.info({});
    expect(
      toasts().map((toast) => toast.querySelector("[data-seintje-title]")?.textContent),
    ).toEqual(["Nice", "Info"]);
  });

  test("apply their duration", async () => {
    const { api, store } = setup({ types: { flash: { duration: 20 } } });
    api.custom("flash", "Quick");
    await flush(30);
    expect(store.getSnapshot()[0]?.closing).toBe(true);
  });

  test("re-render when the toaster's types change", () => {
    const { api } = setup();
    api.custom("upload", {});
    toaster?.update({ types: { upload: { title: "Uploading" } } });
    expect(host.querySelector("[data-seintje-title]")?.textContent).toBe("Uploading");
  });
});
