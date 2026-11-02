<script lang="ts">
import {
  createToaster,
  type MotionPreference,
  type Offset,
  type Position,
  type Store,
  type Theme,
  type Toaster,
  type ToasterOptions,
} from "seintje";
import { getAllContexts, untrack } from "svelte";
import { type SvelteToastOptions, toCoreOptions } from "./api.js";
import { setContexts } from "./content.js";

interface Props {
  position?: Position;
  theme?: Theme;
  offset?: Offset;
  defaults?: Partial<SvelteToastOptions>;
  motion?: MotionPreference;
  store?: Store;
  label?: string;
  hotkey?: string | false;
  limit?: number;
  class?: string;
}

let props: Props = $props();

setContexts(getAllContexts());

let host: HTMLDivElement;
let toaster: Toaster | undefined;

const options = (): ToasterOptions => {
  const result: ToasterOptions = {};
  if (props.position !== undefined) result.position = props.position;
  if (props.theme !== undefined) result.theme = props.theme;
  if (props.offset !== undefined) result.offset = props.offset;
  if (props.defaults !== undefined) result.defaults = toCoreOptions(props.defaults);
  if (props.motion !== undefined) result.motion = props.motion;
  if (props.store !== undefined) result.store = props.store;
  if (props.label !== undefined) result.label = props.label;
  if (props.hotkey !== undefined) result.hotkey = props.hotkey;
  if (props.limit !== undefined) result.limit = props.limit;
  if (props.class !== undefined) result.className = props.class;
  return result;
};

$effect(() => {
  toaster = createToaster(host, untrack(options));
  return () => {
    toaster?.destroy();
    toaster = undefined;
  };
});

$effect(() => {
  const next = options();
  untrack(() => toaster?.update(next));
});
</script>

<div bind:this={host} data-seintje-host style="display: contents"></div>
