import { mount } from "svelte";

// Shoelace (Web Components)
import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/themes/dark.css";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";

// Shoelace components
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/select/select.js";
import "@shoelace-style/shoelace/dist/components/option/option.js";

setBasePath("/shoelace");

import "./app.css";
import App from "./App.svelte";

const target = document.getElementById("app");

const app = target
	? mount(App, {
			target,
		})
	: null;

export default app;
