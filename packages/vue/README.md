# @seintje/vue

Vue 3.4+ bindings for [Seintje](https://www.npmjs.com/package/seintje) toast notifications.

```sh
npm install @seintje/vue
```

```vue
<script setup lang="ts">
import { seintje, Toaster } from "@seintje/vue";
import { h } from "vue";
import "@seintje/vue/styles.css";

const save = () =>
  seintje.success({ title: "Saved", description: h("span", ["All ", h("b", "3"), " files"]) });
</script>

<template>
  <button @click="save">Save</button>
  <Toaster position="top-right" theme="system" />
</template>
```

- `description` and `icon` accept text, VNodes and components; `icon` also accepts inline SVG
  markup. They render with your app's context, so plugins and `inject` work inside toasts.
- `useSeintje()` returns the API plus a read-only `toasts` ref.

MIT licensed.
