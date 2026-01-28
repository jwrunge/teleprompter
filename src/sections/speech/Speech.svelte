<script lang="ts">
	import { SpeechRecognizerMgr } from "../../lib/speech/index.svelte";

	const recognizer = new SpeechRecognizerMgr();
</script>

<h1>Voice (Streaming)</h1>
<div class="row">
	<label>
		<span>Language</span>
		<input bind:value={recognizer.language} placeholder="en-US" />
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
