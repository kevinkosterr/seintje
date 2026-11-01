<script lang="ts">
import { setContext } from "svelte";
import { Toaster } from "../src/lib/index.js";

setContext("label", "from app");
</script>

<Toaster motion="reduce" />
