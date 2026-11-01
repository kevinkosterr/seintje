<script lang="ts">
import { seintje } from "@seintje/svelte";
import { onMount } from "svelte";
import { ensureDocsToaster } from "./docs-toaster";

onMount(ensureDocsToaster);
</script>

{#snippet body()}
  Rendered from a <code>{"{#snippet}"}</code> inside the toast.
{/snippet}

<div class="seintje-demo not-content">
  <button type="button" onclick={() => seintje.info({ title: "From Svelte", description: body })}>
    Show a Svelte toast
  </button>
</div>
