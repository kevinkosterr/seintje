import { cleanup, render } from "@testing-library/vue";
import { createApi, createStore } from "seintje";
import { afterEach, describe, expect, test, vi } from "vitest";
import { defineComponent, h, inject, nextTick, ref } from "vue";
import { createVueApi, seintje, Toaster, toContent, useSeintje } from "../src";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  cleanup();
  seintje.clear();
});

const toastEls = () => [...document.querySelectorAll<HTMLElement>("[data-seintje-toast]")];

describe("<Toaster>", () => {
  test("renders toasts from the default store", async () => {
    render(Toaster, { props: { motion: "reduce" } });
    seintje.success("Saved");
    await nextTick();
    expect(toastEls()).toHaveLength(1);
    expect(document.querySelector("[data-seintje-title]")?.textContent).toBe("Saved");
  });

  test("keeps the hotkey enabled when the prop is omitted", () => {
    render(Toaster);
    expect(document.querySelector("[data-seintje]")?.getAttribute("aria-label")).toBe(
      "Notifications (Alt+T)",
    );
  });

  test("passes prop changes to the toaster", async () => {
    const position = ref<"top-left" | "bottom-right">("top-left");
    render(
      defineComponent({
        setup: () => () => h(Toaster, { position: position.value, motion: "reduce" }),
      }),
    );
    seintje.show("Here");
    await nextTick();
    expect(document.querySelector<HTMLElement>("[data-seintje-viewport]")?.dataset.position).toBe(
      "top-left",
    );
    position.value = "bottom-right";
    await nextTick();
    await nextTick();
    expect(document.querySelector<HTMLElement>("[data-seintje-viewport]")?.dataset.position).toBe(
      "bottom-right",
    );
  });

  test("renders VNodes and components with the app's provides", async () => {
    const Badge = defineComponent({
      setup: () => {
        const label = inject("label", "missing");
        return () => h("strong", { class: "badge" }, label);
      },
    });
    render(Toaster, {
      props: { motion: "reduce" },
      global: { provide: { label: "from app" } },
    });
    seintje.info({ title: "VNode", description: h("em", { class: "vnode" }, "hi") });
    seintje.info({ title: "Component", description: Badge });
    await nextTick();
    expect(document.querySelector(".vnode")?.textContent).toBe("hi");
    expect(document.querySelector(".badge")?.textContent).toBe("from app");
  });

  test("renders components and inline SVG markup as icons", async () => {
    const Star = defineComponent({ setup: () => () => h("svg", { class: "star" }) });
    render(Toaster, { props: { motion: "reduce" } });
    seintje.info({ title: "Component", icon: Star });
    seintje.info({ title: "Svg", icon: '<svg viewBox="0 0 24 24"><circle r="4"/></svg>' });
    await nextTick();
    expect(document.querySelector("[data-seintje-icon] .star")).not.toBeNull();
    expect(document.querySelector("[data-seintje-icon] svg circle")).not.toBeNull();
  });

  test("converts content in the types prop", async () => {
    const Cloud = defineComponent({ setup: () => () => h("svg", { class: "cloud" }) });
    render(Toaster, { props: { motion: "reduce", types: { upload: { icon: Cloud } } } });
    seintje.custom("upload", "Uploading");
    await nextTick();
    expect(
      document.querySelector('[data-type="upload"] [data-seintje-icon] .cloud'),
    ).not.toBeNull();
  });

  test("unmounts rendered content when the toast is removed", async () => {
    const unmounted = vi.fn();
    const Content = defineComponent({
      unmounted,
      setup: () => () => h("span", "bye"),
    });
    const store = createStore({ exitDuration: 5 });
    const api = createVueApi(createApi(store));
    render(Toaster, { props: { motion: "reduce", store } });
    const id = api.show({ title: "x", description: Content });
    api.dismiss(id);
    await tick(20);
    expect(unmounted).toHaveBeenCalledTimes(1);
  });

  test("destroys the toaster on unmount", async () => {
    const { unmount } = render(Toaster);
    expect(document.querySelector("[data-seintje]")).not.toBeNull();
    unmount();
    expect(document.querySelector("[data-seintje]")).toBeNull();
  });
});

describe("useSeintje", () => {
  test("exposes the toasts reactively", async () => {
    const store = createStore();
    let result: ReturnType<typeof useSeintje> | undefined;
    render(
      defineComponent({
        setup() {
          result = useSeintje(store);
          return () => h("p", { class: "count" }, String(result?.toasts.value.length));
        },
      }),
    );
    result?.success("One");
    result?.info({ title: "Two", description: h("b", "rich") });
    await nextTick();
    expect(document.querySelector(".count")?.textContent).toBe("2");
  });
});

describe("toContent", () => {
  test("passes strings through and wraps VNodes", () => {
    expect(toContent("plain")).toBe("plain");
    expect(toContent(null)).toBeNull();
    expect(typeof toContent(h("i"))).toBe("function");
  });
});
