<script lang="ts">
	import Camera from "./camera/Camera.svelte";
	import Files from "./files/Files.svelte";
	import { sectionViews, type SectionView } from "./sections";

	let {
		view = $bindable(),
		includeCamera = false,
	}: { view: SectionView; includeCamera?: boolean } = $props();
</script>

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

{#if view === "camera"}
	<section class="camera p-1">
		<Camera />
	</section>
{:else if view === "files"}
	<section class="files p-1">
		<Files state={null} />
	</section>
{:else if view === "voice"}
	<section class="voice p-1"></section>
{/if}
