import "@seintje/vue/styles.css";
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).provide("user", "Ada").mount("#app");
