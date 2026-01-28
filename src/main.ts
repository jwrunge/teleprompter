import { mount } from "svelte";

// Shoelace (Web Components)
import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/themes/dark.css";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";

// Shoelace components
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/select/select.js";
import "@shoelace-style/shoelace/dist/components/option/option.js";
import "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";
import "@shoelace-style/shoelace/dist/components/tab/tab.js";

setBasePath("/shoelace");

import "./style/app.css";
import "./style/util.css";
import App from "./App.svelte";

const target = document.getElementById("app");

const app = target
	? mount(App, {
			target,
		})
	: null;

export default app;
