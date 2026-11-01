import { EXIT_MS } from "./constants";
import type { Position, ToastOptions, ToastRecord, ToastType } from "./types";

export type Listener = (toasts: readonly ToastRecord[]) => void;

export interface StoreOptions {
  /** Milliseconds a dismissed toast is kept so it can animate out. */
  exitDuration?: number;
}

export interface Store {
  /** Current list of toasts, oldest first. The array is replaced on every change. */
  getSnapshot(): readonly ToastRecord[];
  /**
   * Calls `listener` immediately with the current toasts and after every
   * change. Compatible with Svelte's store contract.
   */
  subscribe(listener: Listener): () => void;
  /** Adds a toast, or replaces the content of the toast with the same id. */
  upsert(type: ToastType, options: ToastOptions): string;
  /** Merges `patch` into an existing toast. Returns `false` if it does not exist. */
  update(id: string, patch: ToastOptions & { type?: ToastType }): boolean;
  /** Starts the exit of one toast, or of every toast when `id` is omitted. */
  dismiss(id?: string): void;
  /** Removes a toast immediately, skipping its exit. */
  remove(id: string): void;
  /** Removes every toast, or every toast at `position`, immediately. */
  clear(position?: Position): void;
  /** Position used for toasts that do not name one. Set by the toaster. */
  defaultPosition: Position;
}

let counter = 0;
const nextId = () =>
  `seintje-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function createStore(storeOptions: StoreOptions = {}): Store {
  const exitDuration = storeOptions.exitDuration ?? EXIT_MS;
  const listeners = new Set<Listener>();
  const removals = new Map<string, ReturnType<typeof setTimeout>>();
  let toasts: readonly ToastRecord[] = [];

  const commit = (next: readonly ToastRecord[]) => {
    toasts = next;
    for (const listener of [...listeners]) listener(toasts);
  };

  const cancelRemoval = (id: string) => {
    const timer = removals.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      removals.delete(id);
    }
  };

  const store: Store = {
    defaultPosition: "bottom-right",

    getSnapshot: () => toasts,

    subscribe(listener) {
      listeners.add(listener);
      listener(toasts);
      return () => {
        listeners.delete(listener);
      };
    },

    upsert(type, options) {
      const id = options.id ?? nextId();
      const existing = toasts.find((toast) => toast.id === id);
      cancelRemoval(id);

      if (existing) {
        const replaced: ToastRecord = {
          ...existing,
          type,
          options: { ...options, id },
          revision: existing.revision + 1,
          closing: false,
        };
        commit(toasts.map((toast) => (toast.id === id ? replaced : toast)));
      } else {
        const created: ToastRecord = {
          id,
          type,
          options: { ...options, id },
          revision: 0,
          createdAt: Date.now(),
          closing: false,
        };
        commit([...toasts, created]);
      }
      return id;
    },

    update(id, patch) {
      const existing = toasts.find((toast) => toast.id === id);
      if (!existing || existing.closing) return false;
      const { type, ...rest } = patch;
      store.upsert(type ?? existing.type, { ...existing.options, ...rest, id });
      return true;
    },

    dismiss(id) {
      const targets = toasts.filter(
        (toast) => !toast.closing && (id === undefined || toast.id === id),
      );
      if (targets.length === 0) return;
      const ids = new Set(targets.map((toast) => toast.id));
      commit(toasts.map((toast) => (ids.has(toast.id) ? { ...toast, closing: true } : toast)));
      for (const toast of targets) {
        toast.options.onDismiss?.(toast.id);
        removals.set(
          toast.id,
          setTimeout(() => store.remove(toast.id), exitDuration),
        );
      }
    },

    remove(id) {
      cancelRemoval(id);
      if (!toasts.some((toast) => toast.id === id)) return;
      commit(toasts.filter((toast) => toast.id !== id));
    },

    clear(position) {
      const keep = position
        ? toasts.filter((toast) => (toast.options.position ?? store.defaultPosition) !== position)
        : [];
      for (const toast of toasts) if (!keep.includes(toast)) cancelRemoval(toast.id);
      commit(keep);
    },
  };

  return store;
}
