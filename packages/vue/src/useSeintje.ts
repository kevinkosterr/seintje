import { createApi, defaultStore, type Store, type ToastRecord } from "seintje";
import { getCurrentScope, onScopeDispose, type Ref, readonly, shallowRef } from "vue";
import { createVueApi, seintje, type VueSeintjeApi } from "./api";

export interface UseSeintje extends VueSeintjeApi {
  /** The toasts currently in the store, oldest first. */
  toasts: Readonly<Ref<readonly ToastRecord[]>>;
}

/**
 * Reactive access to the toasts of a store, plus the API to show and dismiss
 * them. Uses the default store unless one is passed.
 */
export function useSeintje(store: Store = defaultStore): UseSeintje {
  const toasts = shallowRef<readonly ToastRecord[]>(store.getSnapshot());
  const stop = store.subscribe((next) => {
    toasts.value = next;
  });
  if (getCurrentScope()) onScopeDispose(stop);

  const api = store === defaultStore ? seintje : createVueApi(createApi(store));
  return { ...api, store, toasts: readonly(toasts) as Readonly<Ref<readonly ToastRecord[]>> };
}
