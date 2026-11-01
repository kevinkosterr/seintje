import {
  type AdaptedApi,
  type AdaptedPromiseOptions,
  type AdaptedToastInput,
  type AdaptedToastOptions,
  adaptApi,
  adaptOptions,
  seintje as coreApi,
  type SeintjeApi,
} from "seintje";
import { toContent, type VueContent } from "./content";

export type VueToastOptions = AdaptedToastOptions<VueContent>;
export type VueToastInput = AdaptedToastInput<VueContent>;
export type VuePromiseOptions<T> = AdaptedPromiseOptions<VueContent, T>;
export type VueSeintjeApi = AdaptedApi<VueContent>;

/** Converts Vue content in toast options into core content. */
export const toCoreOptions = (options: VueToastOptions) => adaptOptions(options, toContent);

/** Wraps a core API so it accepts VNodes and components as content. */
export const createVueApi = (api: SeintjeApi): VueSeintjeApi => adaptApi(api, toContent);

/** Shows toasts in the default store, with Vue content support. */
export const seintje: VueSeintjeApi = createVueApi(coreApi);
