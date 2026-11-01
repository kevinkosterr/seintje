import type { SeintjeApi } from "./api";
import type { Store } from "./store";
import type { Content, Position, ToastOptions } from "./types";

/* Helpers for framework adapters that accept their own kind of content. */

/** Toast options whose content is a framework type `C`. */
export interface AdaptedToastOptions<C> extends Omit<ToastOptions, "description" | "icon"> {
  description?: C;
  icon?: C | null;
}

export type AdaptedToastInput<C> = string | AdaptedToastOptions<C>;

type Resolver<C, T> = AdaptedToastInput<C> | ((value: T) => AdaptedToastInput<C>);

export interface AdaptedPromiseOptions<C, T> {
  loading: AdaptedToastInput<C>;
  success: Resolver<C, T>;
  error: Resolver<C, unknown>;
  shared?: AdaptedToastOptions<C>;
}

export interface AdaptedApi<C> {
  show(input: AdaptedToastInput<C>): string;
  success(input: AdaptedToastInput<C>): string;
  info(input: AdaptedToastInput<C>): string;
  warning(input: AdaptedToastInput<C>): string;
  error(input: AdaptedToastInput<C>): string;
  loading(input: AdaptedToastInput<C>): string;
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    options: AdaptedPromiseOptions<C, T>,
  ): Promise<T>;
  update(id: string, input: AdaptedToastInput<C>): boolean;
  dismiss(id?: string): void;
  clear(position?: Position): void;
  readonly store: Store;
}

export type ContentConverter<C> = (content: C | null | undefined) => Content | null | undefined;

/** Converts framework content in toast options into core content. */
export function adaptOptions<C>(
  options: AdaptedToastOptions<C>,
  convert: ContentConverter<C>,
): ToastOptions {
  const { description, icon, ...rest } = options;
  const adapted: ToastOptions = { ...rest };
  if ("description" in options) adapted.description = convert(description) ?? undefined;
  if ("icon" in options) adapted.icon = convert(icon);
  return adapted;
}

/** Wraps a core API so every method accepts framework content. */
export function adaptApi<C>(api: SeintjeApi, convert: ContentConverter<C>): AdaptedApi<C> {
  const input = (value: AdaptedToastInput<C>) =>
    typeof value === "string" ? value : adaptOptions(value, convert);
  const resolver =
    <T>(value: Resolver<C, T>) =>
    (result: T) =>
      input(typeof value === "function" ? value(result) : value);

  return {
    store: api.store,
    show: (value) => api.show(input(value)),
    success: (value) => api.success(input(value)),
    info: (value) => api.info(input(value)),
    warning: (value) => api.warning(input(value)),
    error: (value) => api.error(input(value)),
    loading: (value) => api.loading(input(value)),
    promise: (promise, options) =>
      api.promise(promise, {
        loading: input(options.loading),
        success: resolver(options.success),
        error: resolver(options.error),
        ...(options.shared ? { shared: adaptOptions(options.shared, convert) } : {}),
      }),
    update: (id, value) => api.update(id, input(value)),
    dismiss: (id) => api.dismiss(id),
    clear: (position) => api.clear(position),
  };
}
