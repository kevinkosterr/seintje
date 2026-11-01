<script setup lang="ts">
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
import { getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toCoreOptions, type VueToastOptions } from "./api";
import { setAppContext } from "./content";

const props = withDefaults(
  defineProps<{
    position?: Position;
    theme?: Theme;
    offset?: Offset;
    defaults?: Partial<VueToastOptions>;
    motion?: MotionPreference;
    store?: Store;
    label?: string;
    hotkey?: string | false;
    toasterClass?: string;
  }>(),
  // An explicit default stops Vue from casting a missing `hotkey` to `false`.
  { hotkey: undefined },
);

const host = ref<HTMLElement>();
let toaster: Toaster | undefined;
const appContext = getCurrentInstance()?.appContext ?? null;

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
  if (props.toasterClass !== undefined) result.className = props.toasterClass;
  return result;
};

onMounted(() => {
  setAppContext(appContext);
  if (host.value) toaster = createToaster(host.value, options());
});

watch(
  () => ({ ...props }),
  () => toaster?.update(options()),
  { deep: true },
);

onBeforeUnmount(() => {
  toaster?.destroy();
  toaster = undefined;
});
</script>

<template>
  <div ref="host" data-seintje-host style="display: contents" />
</template>
