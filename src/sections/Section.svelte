<script lang="ts">
	import Camera from "./camera/Camera.svelte";
	import Files from "./files/Files.svelte";
	import { sectionViews, type SectionView } from "./sections";

	let {
		view = $bindable(),
		includeCamera = false,
		closable = false,
		onclose,
		onadd,
	}: {
		view: SectionView;
		includeCamera?: boolean;
		closable?: boolean;
		onclose?: () => void;
		onadd?: () => void;
	} = $props();
</script>

<div class="flex justify-between align-center mb-1">
	<sl-tab-group
		onsl-tab-show={(e) => {
			view = e.detail.name as SectionView;
		}}
	>
		{#each sectionViews.filter((view) => includeCamera || view !== "camera") as tab}
			{@const ucFirst = tab[0].toUpperCase() + tab.slice(1)}
			<sl-tab slot="nav" panel={tab} active={tab === view}>
				{ucFirst}
			</sl-tab>
		{/each}
	</sl-tab-group>

	{#if closable}
		<sl-button variant="text" onclick={onclose}>
			<sl-icon name="x-lg"></sl-icon>
		</sl-button>
	{:else}
		<sl-button variant="text" onclick={onadd}>
			<sl-icon name="plus-lg"></sl-icon>
		</sl-button>
	{/if}
</div>

{#if view === "camera"}
	<Camera />
{:else if view === "files"}
	<Files appState={null} />
{:else if view === "voice"}
	<section class="voice p-1"></section>
{/if}
