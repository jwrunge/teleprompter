<script lang="ts">
	import type { State } from "../../state";

	let {
		state,
	}: {
		state: State | null;
	} = $props();

	const syncFiles = $derived(Boolean(state?.userId));
</script>

<h1>Files</h1>
