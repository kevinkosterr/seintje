<script lang="ts">
import { getContext } from "svelte";

let { suffix = "" }: { suffix?: string } = $props();
const label = getContext<string>("label") ?? "missing";
</script>

<strong class="badge">{label}{suffix}</strong>
