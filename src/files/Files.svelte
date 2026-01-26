<script lang=ts>
	import type { State } from "../state";

    let {
        state
    }: {
        state: State
    } = $props();

    let syncFiles = $derived(state.userId);
</script>

<h1>Files</h1>