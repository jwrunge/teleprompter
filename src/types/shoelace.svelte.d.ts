import type { SlInput, SlTabGroup } from "@shoelace-style/shoelace";
import type SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
import type SlSelect from "@shoelace-style/shoelace/dist/components/select/select.js";
import type { HTMLAttributes } from "svelte/elements";

type ShoelaceEvent<T extends EventTarget> = Event & {
	currentTarget: T;
	target: T;
};

type StrictHTMLInputTypeAttribute =
	| "button"
	| "checkbox"
	| "color"
	| "date"
	| "datetime-local"
	| "email"
	| "file"
	| "hidden"
	| "image"
	| "month"
	| "number"
	| "password"
	| "radio"
	| "range"
	| "reset"
	| "search"
	| "submit"
	| "tel"
	| "text"
	| "time"
	| "url"
	| "week";

type SlInputNumericType = "number" | "range";

type SlInputCommonAttrs = HTMLAttributes<SlInput> & {
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	min?: string | number;
	max?: string | number;
	step?: string | number;
	"onsl-change"?: (event: ShoelaceEvent<SlInput>) => void;
	"onsl-input"?: (event: ShoelaceEvent<SlInput>) => void;
};

type SlInputAttrs =
	| (SlInputCommonAttrs & {
			type: SlInputNumericType;
			value?: number | null;
			"bind:value"?: number | null;
	  })
	| (SlInputCommonAttrs & {
			type?: Exclude<StrictHTMLInputTypeAttribute, SlInputNumericType> | null;
			value?: string | null;
			"bind:value"?: string | null;
	  });

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

			"sl-tab-group": HTMLAttributes<SlTabGroup> & {
				activeTab?: string;
				"onsl-tab-show"?: (
					event: ShoelaceEvent<SlTabGroup> & { detail: { name: string } },
				) => void;
			};

			"sl-input": SlInputAttrs;
		}
	}
}
