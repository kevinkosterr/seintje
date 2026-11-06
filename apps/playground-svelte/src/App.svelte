<script lang="ts">
import { type Position, seintje, type Theme, Toaster, toasts } from "@seintje/svelte";
import Greeting from "./Greeting.svelte";

let position: Position = $state("bottom-right");
let theme: Theme = $state("system");
let limit = $state(5);
let keepExpanded = $state(false);
const defaults = $derived({ keepExpanded });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const demos: Record<string, () => unknown> = {
  success: () =>
    seintje.success({ title: "Order placed", description: "We'll email you the receipt." }),
  snippet: () => seintje.info({ title: "Snippet", description: details }),
  component: () =>
    seintje.show({
      title: "Component",
      description: { component: Greeting, props: { name: "Grace" } },
    }),
  keepExpanded: () =>
    seintje.info({
      title: "Release notes",
      description: "This toast stays open once it has expanded.",
      keepExpanded: true,
    }),
  promise: () =>
    seintje
      .promise(
        wait(1500).then(() => Promise.reject(new Error("timeout"))),
        {
          loading: "Connecting",
          success: "Connected",
          error: (err) => ({
            title: "Connection failed",
            description: `Reason: ${(err as Error).message}`,
          }),
        },
      )
      .catch(() => {}),
  action: () =>
    seintje.show({
      type: "info",
      title: "New version available",
      description: "Reload to get the latest features.",
      action: { label: "Reload", onClick: () => location.reload() },
    }),
};
</script>

{#snippet details()}
  Rendered from a <code>{"{#snippet}"}</code> block.
{/snippet}

<main>
  <h1>Seintje <small>Svelte</small></h1>
  <p>{$toasts.length} toast(s) in the store</p>
  <div class="row">
    {#each Object.entries(demos) as [name, run] (name)}
      <button type="button" onclick={run}>{name}</button>
    {/each}
    <button type="button" onclick={() => seintje.dismiss()}>dismiss all</button>
  </div>
  <div class="row">
    <select bind:value={position}>
      <option>top-left</option><option>top-center</option><option>top-right</option>
      <option>bottom-left</option><option>bottom-center</option><option>bottom-right</option>
    </select>
    <select bind:value={theme}>
      <option>system</option><option>light</option><option>dark</option>
    </select>
    <select bind:value={limit}>
      {#each [1, 3, 5, 10] as value (value)}
        <option {value}>limit {value}</option>
      {/each}
      <option value={Infinity}>no limit</option>
    </select>
    <label><input type="checkbox" bind:checked={keepExpanded} /> keep expanded</label>
  </div>
</main>

<Toaster {position} {theme} {limit} {defaults} />

<style>
  :global(:root) { color-scheme: light dark; font-family: system-ui, sans-serif; }
  :global(body) { margin: 0; background: light-dark(#f7f7f8, #111113); color: light-dark(#18181b, #f4f4f5); }
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
  h1 small { font-weight: 400; opacity: 0.5; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  label { display: flex; gap: 6px; align-items: center; }
  button, select { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid light-dark(#ccc, #444); background: light-dark(#fff, #1c1c1f); color: inherit; cursor: pointer; }
</style>
