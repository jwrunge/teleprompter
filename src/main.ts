import { mount } from "svelte";

// Shoelace (Web Components)
import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/themes/dark.css";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";

setBasePath("/shoelace");

import "./app.css";
import App from "./App.svelte";

const app = mount(App, {
	target: document.getElementById("app")!,
});

export default app;
