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
import { type SvelteContent, toContent } from "./content.js";

export type SvelteToastOptions = AdaptedToastOptions<SvelteContent>;
export type SvelteToastInput = AdaptedToastInput<SvelteContent>;
export type SveltePromiseOptions<T> = AdaptedPromiseOptions<SvelteContent, T>;
export type SvelteSeintjeApi = AdaptedApi<SvelteContent>;

/** Converts Svelte content in toast options into core content. */
export const toCoreOptions = (options: SvelteToastOptions) => adaptOptions(options, toContent);

/** Wraps a core API so it accepts snippets and components as content. */
export const createSvelteApi = (api: SeintjeApi): SvelteSeintjeApi => adaptApi(api, toContent);

/** Shows toasts in the default store, with Svelte content support. */
export const seintje: SvelteSeintjeApi = createSvelteApi(coreApi);
