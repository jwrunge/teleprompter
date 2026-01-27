import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const ignoredShoelaceA11yWarnings = new Set([
	"a11y_click_events_have_key_events",
	"a11y_no_static_element_interactions",
]);

/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
	// Consult https://svelte.dev/docs#compile-time-svelte-preprocess
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	onwarn: (warning, handler) => {
		if (
			warning?.code &&
			ignoredShoelaceA11yWarnings.has(warning.code) &&
			warning?.frame?.includes("<sl-")
		) {
			return;
		}

		handler(warning);
	},
};
