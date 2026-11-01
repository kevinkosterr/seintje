import { createStore, type Store } from "./store";
import type { Position, ToastOptions, ToastType } from "./types";

/** A title on its own, or full options. */
export type ToastInput = string | ToastOptions;

type Resolver<T> = ToastInput | ((value: T) => ToastInput);

export interface PromiseOptions<T> {
  loading: ToastInput;
  success: Resolver<T>;
  error: Resolver<unknown>;
  /** Options shared by all three stages, such as `position`. */
  shared?: ToastOptions;
}

export interface SeintjeApi {
  /** Shows a toast. Its type comes from `options.type` and defaults to `neutral`. */
  show(input: ToastInput): string;
  success(input: ToastInput): string;
  info(input: ToastInput): string;
  warning(input: ToastInput): string;
  error(input: ToastInput): string;
  /** Shows a spinner that stays until it is updated or dismissed. */
  loading(input: ToastInput): string;
  /**
   * Shows a loading toast that turns into a success or error toast once the
   * promise settles. Resolves or rejects with the original outcome.
   */
  promise<T>(promise: Promise<T> | (() => Promise<T>), options: PromiseOptions<T>): Promise<T>;
  /** Merges new options into an existing toast. */
  update(id: string, input: ToastInput): boolean;
  dismiss(id?: string): void;
  clear(position?: Position): void;
  readonly store: Store;
}

const normalize = (input: ToastInput): ToastOptions =>
  typeof input === "string" ? { title: input } : input;

const resolve = <T>(resolver: Resolver<T>, value: T): ToastOptions =>
  normalize(typeof resolver === "function" ? resolver(value) : resolver);

export function createApi(store: Store = createStore()): SeintjeApi {
  const typed = (type: ToastType) => (input: ToastInput) => store.upsert(type, normalize(input));

  return {
    store,
    show: (input) => {
      const options = normalize(input);
      return store.upsert(options.type ?? "neutral", options);
    },
    success: typed("success"),
    info: typed("info"),
    warning: typed("warning"),
    error: typed("error"),
    loading: (input) => store.upsert("loading", { duration: null, ...normalize(input) }),

    promise(promise, { loading, success, error, shared }) {
      const id = store.upsert("loading", { ...shared, duration: null, ...normalize(loading) });
      const running = typeof promise === "function" ? promise() : promise;
      running.then(
        (value) => {
          const options = resolve(success, value);
          store.upsert(options.type ?? "success", { ...shared, ...options, id });
        },
        (reason: unknown) => {
          const options = resolve(error, reason);
          store.upsert(options.type ?? "error", { ...shared, ...options, id });
        },
      );
      return running;
    },

    update: (id, input) => store.update(id, normalize(input)),
    dismiss: (id) => store.dismiss(id),
    clear: (position) => store.clear(position),
  };
}
