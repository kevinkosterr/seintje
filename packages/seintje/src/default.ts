import { createApi } from "./api";
import { createStore } from "./store";

/** Store behind the `seintje` API and the default toaster. */
export const defaultStore = createStore();

/** Shows and manages toasts in the default store. */
export const seintje = createApi(defaultStore);
