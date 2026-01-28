<script lang="ts">
	import { onDestroy } from "svelte";
	import { SpeechRecognizerMgr } from "./lib/speech/index.svelte";
	import ThemeToggle from "./widgets/ThemeToggle.svelte";
	import Section from "./sections/Section.svelte";
	import { type SectionView } from "./sections/sections";

	const mainViews = ["record", "export"] as const;
	type MainView = (typeof mainViews)[number];

	const recognizer = new SpeechRecognizerMgr();

	let mainView = $state<MainView>("record");
	let sections = $state<[SectionView, SectionView]>(["camera", "files"]);

	onDestroy(() => {
		recognizer?.dispose();
	});
</script>

<div class="flex flex-column height-100">
	<header class="flex justify-between align-center pr-1">
		<sl-tab-group
			onsl-tab-show={(e) => {
				mainView = e.detail.name as MainView;
			}}
		>
			{#each mainViews as tab}
				{@const ucfirst = tab[0].toUpperCase() + tab.slice(1)}
				<sl-tab slot="nav" panel={tab} active={tab === mainView}>
					{ucfirst}
				</sl-tab>
			{/each}
		</sl-tab-group>

		<ThemeToggle />
	</header>

	<main>
		{#if mainView === "record"}
			<sl-split-panel>
				{#each sections as section, i}
					<div class="height-100" slot={i === 0 ? "start" : "end"}>
						<Section view={section} />
					</div>
				{/each}
			</sl-split-panel>
		{:else if mainView === "export"}
			<section class="export-section height-100">
				<!-- Export section content goes here -->
			</section>
		{/if}
	</main>
</div>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--sl-color-neutral-0);
	}

	main,
	sl-split-panel {
		height: 100%;
	}
</style>
