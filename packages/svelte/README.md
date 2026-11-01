# @seintje/svelte

Svelte 5 bindings for [Seintje](https://www.npmjs.com/package/seintje) toast notifications.

```sh
npm install @seintje/svelte
```

```svelte
<script lang="ts">
  import { seintje, Toaster, toasts } from "@seintje/svelte";
  import Avatar from "./Avatar.svelte";
  import "@seintje/svelte/styles.css";
</script>

{#snippet details()}
  See the <a href="/changelog">changelog</a>.
{/snippet}

<button onclick={() => seintje.info({ title: "Updated", description: details })}>Snippet</button>
<button onclick={() => seintje.show({ title: "Hi", icon: { component: Avatar, props: { id: 1 } } })}>
  Component
</button>
<p>{$toasts.length} toasts</p>

<Toaster position="top-right" />
```

- `description` and `icon` accept text, snippets and `{ component, props }`. They are mounted
  with the contexts around `<Toaster>`.
- `toasts` is a readable store of the current toasts; `toastsOf(store)` wraps any store.

MIT licensed.
