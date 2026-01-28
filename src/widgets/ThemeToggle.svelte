<script lang="ts">
	import { onMount } from "svelte";

	let dark = $state(false);
	let hydrated = false;
	const THEME_STORAGE_KEY = "theme";

	const getRootEl = () =>
		typeof document !== "undefined" ? document.documentElement : null;

	function applyTheme(isDark: boolean) {
		const root = getRootEl();
		if (!root) return;

		root.classList.toggle("sl-theme-dark", isDark);
		root.classList.toggle("sl-theme-light", !isDark);
		root.style.colorScheme = isDark ? "dark" : "light";
	}

	onMount(() => {
		const saved = localStorage.getItem(THEME_STORAGE_KEY);

		if (saved === "dark" || saved === "light") {
			dark = saved === "dark";
		} else {
			dark =
				window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ??
				false;
		}
		hydrated = true;
	});

	$effect(() => {
		if (!hydrated) return;
		applyTheme(dark);
		try {
			localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
		} catch {
			// ignore (e.g. storage disabled)
		}
	});
</script>

<div class="flex align-center">
	<sl-icon class="pr-half" name="sun"></sl-icon>
	<sl-switch
		size="small"
		checked={dark}
		onsl-change={(event: Event) => {
			dark = Boolean((event.target as any)?.checked);
		}}
	>
	</sl-switch>
	<sl-icon class="pl-quarter" name="moon-stars"></sl-icon>
</div>
