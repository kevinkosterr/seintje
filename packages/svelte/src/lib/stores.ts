import { defaultStore, type Store, type ToastRecord } from "seintje";
import type { Readable } from "svelte/store";

/** A readable Svelte store of the toasts in `store`, oldest first. */
export function toastsOf(store: Store): Readable<readonly ToastRecord[]> {
  return { subscribe: (run) => store.subscribe(run) };
}

/** The toasts in the default store. Use as `$toasts`. */
export const toasts: Readable<readonly ToastRecord[]> = toastsOf(defaultStore);
