import type SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
import type SlSelect from "@shoelace-style/shoelace/dist/components/select/select.js";
import type { HTMLAttributes } from "svelte/elements";

type ShoelaceEvent<T extends EventTarget> = Event & {
	currentTarget: T;
	target: T;
};

declare global {
	namespace svelteHTML {
		interface IntrinsicElements {
			"sl-button": HTMLAttributes<SlButton> & {
				variant?: string;
				disabled?: boolean;
				type?: "button" | "submit" | "reset";
				onclick?: (event: ShoelaceEvent<SlButton>) => void;
			};

			"sl-select": HTMLAttributes<SlSelect> & {
				label?: string;
				disabled?: boolean;
				value?: string;
				"onsl-change"?: (event: ShoelaceEvent<SlSelect>) => void;
				"onsl-input"?: (event: ShoelaceEvent<SlSelect>) => void;
			};
		}
	}
}
