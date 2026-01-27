<script lang="ts">
	import { onDestroy } from "svelte";
	import Camera from "./camera/Camera.svelte";
	import Files from "./files/Files.svelte";
	import { SpeechRecognizerMgr } from "./lib/speech";

	const show = $state<"files" | "voice">("files");
	const recognizer = new SpeechRecognizerMgr();

	onDestroy(() => {
		recognizer?.dispose();
	});
</script>

<main>
	<section id="camera">
		<sl-icon name="0-circle"></sl-icon>
		<Camera />
		<sl-input></sl-input>
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
	main {
		width: 100%;
		height: 100%;

		display: grid;
		gap: 1rem;
		grid-template-columns: 25rem 1fr;
	}
</style>
