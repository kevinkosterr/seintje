<script setup lang="ts">
import { type Position, seintje, type Theme, Toaster, useSeintje } from "@seintje/vue";
import { h, ref } from "vue";
import Greeting from "./Greeting.vue";

const position = ref<Position>("bottom-right");
const theme = ref<Theme>("system");
const limit = ref(5);
const { toasts } = useSeintje();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const demos = {
  success: () =>
    seintje.success({ title: "Profile updated", description: "Your changes are saved." }),
  vnode: () =>
    seintje.info({
      title: "Render function",
      description: h("span", ["Made with ", h("code", "h()"), " in Vue."]),
    }),
  component: () => seintje.show({ title: "Component", description: Greeting }),
  promise: () =>
    seintje
      .promise(wait(1500), {
        loading: "Saving",
        success: { title: "Saved", description: "Everything is in sync." },
        error: "Could not save",
      })
      .catch(() => {}),
  action: () =>
    seintje.warning({
      title: "Item deleted",
      description: "It will be gone for good in 30 days.",
      action: { label: "Restore", onClick: () => seintje.success("Restored"), dismiss: true },
    }),
};
</script>

<template>
  <main>
    <h1>Seintje <small>Vue</small></h1>
    <p>{{ toasts.length }} toast(s) in the store</p>
    <div class="row">
      <button v-for="(run, name) in demos" :key="name" type="button" @click="run()">
        {{ name }}
      </button>
      <button type="button" @click="seintje.dismiss()">dismiss all</button>
    </div>
    <div class="row">
      <select v-model="position">
        <option>top-left</option><option>top-center</option><option>top-right</option>
        <option>bottom-left</option><option>bottom-center</option><option>bottom-right</option>
      </select>
      <select v-model="theme">
        <option>system</option><option>light</option><option>dark</option>
      </select>
      <select v-model="limit">
        <option v-for="value in [1, 3, 5, 10]" :key="value" :value="value">limit {{ value }}</option>
        <option :value="Infinity">no limit</option>
      </select>
    </div>
  </main>
  <Toaster :position="position" :theme="theme" :limit="limit" />
</template>

<style>
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0; background: light-dark(#f7f7f8, #111113); color: light-dark(#18181b, #f4f4f5); }
main { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
h1 small { font-weight: 400; opacity: 0.5; }
.row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
button, select { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid light-dark(#ccc, #444); background: light-dark(#fff, #1c1c1f); color: inherit; cursor: pointer; }
</style>
