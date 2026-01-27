<script lang="ts">
	import "@shoelace-style/shoelace/dist/components/switch/switch.js";
	import { onDestroy, onMount } from "svelte";
	import Camera from "./camera/Camera.svelte";
	import Files from "./files/Files.svelte";
	import { SpeechRecognizerMgr } from "./lib/speech/index.svelte";

	const show = $state<"files" | "voice">("files");
	const recognizer = new SpeechRecognizerMgr();

	const THEME_STORAGE_KEY = "theme";
	const getRootEl = () =>
		typeof document !== "undefined" ? document.documentElement : null;

	let dark = $state(false);
	let hydrated = false;

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

	onDestroy(() => {
		recognizer?.dispose();
	});
</script>

<main>
	<header class="toolbar">
		<sl-switch
			size="small"
			checked={dark}
			onsl-change={(event: Event) => {
				dark = Boolean((event.target as any)?.checked);
			}}
		>
			Dark
		</sl-switch>
	</header>

	<section id="camera">
		<Camera />
	</section>

	{#if show === "files"}
		<section id="files">
			<Files state={null} />
		</section>
	{:else if show === "voice"}
		<section id="primary">
			<h1>Voice (Streaming)</h1>
			<div class="row">
				<label>
					<span>Language</span>
					<input
						bind:value={recognizer.language}
						placeholder="en-US"
					/>
				</label>
			</div>

			<div class="row">
				<button
					type="button"
					onclick={() => recognizer.listen()}
					disabled={!recognizer.isSupported ||
						recognizer.state === "starting" ||
						recognizer.state === "listening"}
				>
					Start
				</button>
				<button
					type="button"
					onclick={recognizer.stop}
					disabled={recognizer.state !== "listening" &&
						recognizer.state !== "starting"}
				>
					Stop
				</button>
				<div class="meta">
					<div><strong>State:</strong> {recognizer.state}</div>
				</div>
			</div>

			{#if recognizer.lastError}
				<p class="error">{recognizer.lastError}</p>
			{/if}

			<div class="panel">
				<div class="label">Partial</div>
				<div class="text">{recognizer.partial || "…"}</div>
			</div>

			<div class="panel">
				<div class="label">Final</div>
				{#if recognizer.finals.length === 0}
					<div class="text">No transcripts yet.</div>
				{:else}
					<ul>
						{#each recognizer.finals as line (line)}
							<li>{line}</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/if}
</main>

<style>
	.toolbar {
		position: fixed;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 10;
	}

	main {
		width: 100%;
		height: 100%;

		display: grid;
		gap: 1rem;
		grid-template-columns: 25rem 1fr;
	}
</style>
