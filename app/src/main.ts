import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles/tokens.css";
import "./styles/base.css";
import App from "./App.vue";
import { installNavigationGuards, router } from "./router";

installNavigationGuards(router);
createApp(App).use(createPinia()).use(router).mount("#app");
