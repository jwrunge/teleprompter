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
					<span>Backend</span>
					<select
						bind:value={backend}
						onchange={() => {
							recognizer?.dispose();
							recognizer = null;
							recState = "idle";
							partial = "";
							lastError = null;
						}}
					>
						<option value="auto">auto</option>
						<option value="web">web</option>
						<option value="native">native (stub)</option>
					</select>
				</label>

				<label>
					<span>Language</span>
					<input bind:value={language} placeholder="en-US" />
				</label>
			</div>

			<div class="row">
				<button
					type="button"
					onclick={startListening}
					disabled={!isSupported ||
						recState === "starting" ||
						recState === "listening"}
				>
					Start
				</button>
				<button
					type="button"
					onclick={stopListening}
					disabled={recState !== "listening" &&
						recState !== "starting"}
				>
					Stop
				</button>
				<div class="meta">
					<div><strong>State:</strong> {recState}</div>
					<div><strong>Backend:</strong> {backend}</div>
				</div>
			</div>

			{#if lastError}
				<p class="error">{lastError}</p>
			{/if}

			<div class="panel">
				<div class="label">Partial</div>
				<div class="text">{partial || "…"}</div>
			</div>

			<div class="panel">
				<div class="label">Final</div>
				{#if finals.length === 0}
					<div class="text">No transcripts yet.</div>
				{:else}
					<ul>
						{#each finals as line (line)}
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
