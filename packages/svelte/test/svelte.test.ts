import { cleanup, render } from "@testing-library/svelte";
import { createApi, createStore } from "seintje";
import { createRawSnippet, flushSync } from "svelte";
import { get } from "svelte/store";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createSvelteApi,
  seintje,
  Toaster,
  toasts,
  toastsOf,
  toContent,
} from "../src/lib/index.js";
import ReadsContext from "./ReadsContext.svelte";
import WithContext from "./WithContext.svelte";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  cleanup();
  seintje.clear();
});

const toastEls = () => [...document.querySelectorAll<HTMLElement>("[data-seintje-toast]")];

describe("<Toaster>", () => {
  test("renders toasts from the default store", () => {
    render(Toaster, { motion: "reduce" });
    seintje.success("Saved");
    expect(toastEls()).toHaveLength(1);
    expect(document.querySelector("[data-seintje-title]")?.textContent).toBe("Saved");
  });

  test("passes prop changes to the toaster", async () => {
    const { rerender } = render(Toaster, { motion: "reduce", position: "top-left" });
    seintje.show("Here");
    const viewport = () => document.querySelector<HTMLElement>("[data-seintje-viewport]");
    expect(viewport()?.dataset.position).toBe("top-left");
    await rerender({ motion: "reduce", position: "bottom-right" });
    flushSync();
    expect(viewport()?.dataset.position).toBe("bottom-right");
  });

  test("renders snippets", () => {
    render(Toaster, { motion: "reduce" });
    const snippet = createRawSnippet(() => ({ render: () => "<em class='snip'>hi</em>" }));
    seintje.info({ title: "Snippet", description: snippet });
    expect(document.querySelector(".snip")?.textContent).toBe("hi");
  });

  test("renders components with the contexts around the toaster", () => {
    render(WithContext);
    seintje.info({
      title: "Component",
      description: { component: ReadsContext, props: { suffix: "!" } },
    });
    expect(document.querySelector(".badge")?.textContent).toBe("from app!");
  });

  test("renders bare components as icons", () => {
    render(WithContext);
    seintje.info({ title: "Component", icon: ReadsContext });
    expect(document.querySelector("[data-seintje-icon] .badge")?.textContent).toBe("from app");
  });

  test("renders inline SVG markup as icons", () => {
    render(Toaster, { motion: "reduce" });
    seintje.info({ title: "Svg", icon: '<svg viewBox="0 0 24 24"><circle r="4"/></svg>' });
    expect(document.querySelector("[data-seintje-icon] svg circle")).not.toBeNull();
  });

  test("unmounts rendered content when the toast is removed", async () => {
    const store = createStore({ exitDuration: 5 });
    const api = createSvelteApi(createApi(store));
    render(Toaster, { motion: "reduce", store });
    const destroyed = vi.fn();
    const snippet = createRawSnippet(() => ({
      render: () => "<span>bye</span>",
      setup: () => destroyed,
    }));
    const id = api.show({ title: "x", description: snippet });
    api.dismiss(id);
    await tick(20);
    expect(destroyed).toHaveBeenCalledTimes(1);
  });

  test("destroys the toaster on unmount", () => {
    const { unmount } = render(Toaster);
    expect(document.querySelector("[data-seintje]")).not.toBeNull();
    unmount();
    expect(document.querySelector("[data-seintje]")).toBeNull();
  });
});

describe("stores", () => {
  test("toasts follows the default store", () => {
    seintje.show("One");
    seintje.show("Two");
    expect(get(toasts).map((toast) => toast.options.title)).toEqual(["One", "Two"]);
  });

  test("toastsOf wraps any store", () => {
    const store = createStore();
    const seen: number[] = [];
    const stop = toastsOf(store).subscribe((list) => seen.push(list.length));
    createApi(store).show("x");
    stop();
    expect(seen).toEqual([0, 1]);
  });
});

describe("toContent", () => {
  test("passes strings through and wraps snippets", () => {
    expect(toContent("plain")).toBe("plain");
    expect(toContent(undefined)).toBeUndefined();
    expect(typeof toContent(createRawSnippet(() => ({ render: () => "<b>x</b>" })))).toBe(
      "function",
    );
  });
});
