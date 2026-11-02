import { describe, expect, mock, test } from "bun:test";
import { createApi } from "../src/api";
import { createStore } from "../src/store";

const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe("store", () => {
  test("subscribe calls the listener immediately and on every change", () => {
    const store = createStore();
    const seen: number[] = [];
    const stop = store.subscribe((toasts) => seen.push(toasts.length));
    store.upsert("success", { title: "One" });
    store.upsert("info", { title: "Two" });
    stop();
    store.upsert("info", { title: "Three" });
    expect(seen).toEqual([0, 1, 2]);
  });

  test("reusing an id replaces the toast and bumps its revision", () => {
    const store = createStore();
    store.upsert("loading", { id: "job", title: "Working" });
    store.upsert("success", { id: "job", title: "Done" });
    const [toast] = store.getSnapshot();
    expect(store.getSnapshot()).toHaveLength(1);
    expect(toast?.type).toBe("success");
    expect(toast?.options.title).toBe("Done");
    expect(toast?.revision).toBe(1);
  });

  test("update merges into the existing options", () => {
    const store = createStore();
    const id = store.upsert("info", { title: "Hi", description: "There" });
    expect(store.update(id, { title: "Hello" })).toBe(true);
    expect(store.getSnapshot()[0]?.options).toMatchObject({ title: "Hello", description: "There" });
    expect(store.update("missing", { title: "x" })).toBe(false);
  });

  test("dismiss marks toasts as closing and removes them after the exit", async () => {
    const onDismiss = mock();
    const store = createStore({ exitDuration: 5 });
    const id = store.upsert("info", { title: "Bye", onDismiss });
    store.dismiss(id);
    expect(store.getSnapshot()[0]?.closing).toBe(true);
    expect(onDismiss).toHaveBeenCalledWith(id);
    await flush(15);
    expect(store.getSnapshot()).toHaveLength(0);
  });

  test("an upsert during the exit revives the toast", async () => {
    const store = createStore({ exitDuration: 5 });
    store.upsert("info", { id: "a", title: "Bye" });
    store.dismiss("a");
    store.upsert("success", { id: "a", title: "Back" });
    await flush(15);
    expect(store.getSnapshot()[0]).toMatchObject({ id: "a", closing: false });
  });

  test("clear filters by position, falling back to the default position", () => {
    const store = createStore();
    store.defaultPosition = "top-left";
    store.upsert("info", { title: "default" });
    store.upsert("info", { title: "explicit", position: "bottom-right" });
    store.clear("top-left");
    expect(store.getSnapshot().map((toast) => toast.options.title)).toEqual(["explicit"]);
    store.clear();
    expect(store.getSnapshot()).toHaveLength(0);
  });
});

describe("api", () => {
  test("typed helpers accept a title string", () => {
    const api = createApi();
    api.error("Nope");
    expect(api.store.getSnapshot()[0]).toMatchObject({ type: "error", options: { title: "Nope" } });
  });

  test("show uses the type from options, neutral by default", () => {
    const api = createApi();
    api.show({ title: "a" });
    api.show({ title: "b", type: "warning" });
    expect(api.store.getSnapshot().map((toast) => toast.type)).toEqual(["neutral", "warning"]);
  });

  test("custom shows a toast of the given type", () => {
    const api = createApi();
    api.custom("upload", "Uploading");
    expect(api.store.getSnapshot()[0]).toMatchObject({
      type: "upload",
      options: { title: "Uploading" },
    });
    expect(() => api.custom("", "Nameless")).toThrow();
  });

  test("loading toasts never time out by default", () => {
    const api = createApi();
    api.loading("Please wait");
    expect(api.store.getSnapshot()[0]?.options.duration).toBeNull();
  });

  test("promise moves from loading to success", async () => {
    const api = createApi();
    const result = await api.promise(Promise.resolve(3), {
      loading: "Counting",
      success: (n) => `Counted ${n}`,
      error: "Failed",
    });
    await flush();
    expect(result).toBe(3);
    const [toast] = api.store.getSnapshot();
    expect(toast).toMatchObject({ type: "success", revision: 1, options: { title: "Counted 3" } });
  });

  test("promise moves from loading to error and rethrows", async () => {
    const api = createApi();
    const running = api.promise(() => Promise.reject(new Error("boom")), {
      loading: "Trying",
      success: "Worked",
      error: (err) => ({ title: "Failed", description: (err as Error).message }),
    });
    await expect(running).rejects.toThrow("boom");
    await flush();
    expect(api.store.getSnapshot()[0]).toMatchObject({
      type: "error",
      options: { title: "Failed", description: "boom" },
    });
  });
});
