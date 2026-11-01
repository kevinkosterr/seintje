<script setup lang="ts">
import { seintje } from "@seintje/vue";
import { h, onMounted } from "vue";
import { ensureDocsToaster } from "./docs-toaster";

onMounted(ensureDocsToaster);

const show = () =>
  seintje.success({
    title: "From Vue",
    description: h("span", ["Rendered with ", h("code", "h()"), " inside the toast."]),
  });
</script>

<template>
  <div class="seintje-demo not-content">
    <button type="button" @click="show">Show a Vue toast</button>
  </div>
</template>
