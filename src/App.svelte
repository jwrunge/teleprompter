<script lang="ts">
	import { onDestroy } from "svelte";
	import { SpeechRecognizerMgr } from "./lib/speech/index.svelte";
	import ThemeToggle from "./widgets/ThemeToggle.svelte";
	import Section from "./sections/Section.svelte";
	import { sectionViews, type SectionView } from "./sections/sections";

	const mobileAspectRatio = 9 / 16;
	const mainViews = ["record", "export"] as const;
	type MainView = (typeof mainViews)[number];

	const recognizer = new SpeechRecognizerMgr();

	let mainView = $state<MainView>("record");
	let sections = $state<SectionView[]>(["camera", "files"]);

	let wWidth = $state(0);
	let wHeight = $state(0);
	let wAspectRatio = $derived(wHeight === 0 ? 1 : wWidth / wHeight);

	onDestroy(() => {
		recognizer?.dispose();
	});
</script>

<svelte:window bind:innerWidth={wWidth} bind:innerHeight={wHeight} />

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
			{#if sections.length === 1}
				<Section
					view={sections[0]}
					includeCamera={sections[0] === "camera"}
					onadd={() => {
						for (const view of sectionViews) {
							if (!sections.includes(view)) {
								sections = [...sections, view];
								break;
							}
						}
					}}
				/>
			{:else}
				<sl-split-panel
					position="25"
					vertical={wAspectRatio < mobileAspectRatio}
				>
					{#each sections as section, i}
						{@const first = i === 0}
						<div class="height-100" slot={first ? "start" : "end"}>
							<Section
								view={section}
								includeCamera={first}
								closable={sections.length > 1}
								onclose={() => {
									sections = sections.filter(
										(_, idx) => idx !== i,
									);
								}}
							/>
						</div>
					{/each}
				</sl-split-panel>
			{/if}
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

	sl-split-panel {
		--min: 20rem;
		--max: calc(100% - 20rem);
	}
</style>
