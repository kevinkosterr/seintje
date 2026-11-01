<script setup lang="ts">
import { inject } from "vue";

const user = inject<string>("user", "stranger");
</script>

<template>
  <span>Welcome back, <strong>{{ user }}</strong>. This is a Vue component.</span>
</template>
