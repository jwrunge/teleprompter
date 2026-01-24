<script lang="ts">
	import Camera from './camera/Camera.svelte'
	import { createSpeechRecognizer, type SpeechRecognizer } from './lib/speech'
	import { onDestroy } from 'svelte'

	let recognizer: SpeechRecognizer | null = null
	let isSupported = true
	let state: string = 'idle'
	let backend: string = 'auto'
	let language = 'en-US'
	let partial = ''
	let finals: string[] = []
	let lastError: string | null = null

	function ensureRecognizer() {
		if (recognizer) return

		recognizer = createSpeechRecognizer(
			{
				onStateChange: (s) => (state = s),
				onPartial: (text) => {
					partial = text
				},
				onFinal: (text) => {
					finals = [text, ...finals]
					partial = ''
				},
				onError: (err) => {
					lastError = err instanceof Error ? err.message : String(err)
				},
			},
			{ language, interimResults: true, continuous: true },
			backend as 'auto' | 'web' | 'native'
		)

		backend = recognizer.backend
		isSupported = recognizer.isSupported
		if (!isSupported) {
			lastError = 'Speech recognition not supported in this environment.'
		}
	}

	async function startListening() {
		lastError = null
		ensureRecognizer()
		if (!recognizer || !recognizer.isSupported) return
		recognizer.setLanguage(language)
		await recognizer.start()
	}

	async function stopListening() {
		await recognizer?.stop()
	}

	onDestroy(() => {
		recognizer?.dispose()
	})
</script>

<main>
	<h1>Camera</h1>
	<Camera />

	<h1>Voice (Streaming)</h1>
	<div class="row">
		<label>
			<span>Backend</span>
			<select bind:value={backend} on:change={() => {
				recognizer?.dispose()
				recognizer = null
				state = 'idle'
				partial = ''
				lastError = null
			}}>
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
		<button type="button" on:click={startListening} disabled={!isSupported || state === 'starting' || state === 'listening'}>
			Start
		</button>
		<button type="button" on:click={stopListening} disabled={state !== 'listening' && state !== 'starting'}>
			Stop
		</button>
		<div class="meta">
			<div><strong>State:</strong> {state}</div>
			<div><strong>Backend:</strong> {backend}</div>
		</div>
	</div>

	{#if lastError}
		<p class="error">{lastError}</p>
	{/if}

	<div class="panel">
		<div class="label">Partial</div>
		<div class="text">{partial || '…'}</div>
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
</main>

<style>
	main {
		padding: 1.5rem;
		display: grid;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.9rem;
	}

	select,
	input {
		padding: 0.45rem 0.6rem;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		min-width: 12rem;
	}

	button {
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
	}

	button:disabled {
		opacity: 0.6;
	}

	.meta {
		display: flex;
		gap: 1rem;
		opacity: 0.9;
		font-size: 0.9rem;
	}

	.panel {
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.04);
	}

	.label {
		font-size: 0.85rem;
		opacity: 0.85;
		margin-bottom: 0.25rem;
	}

	.text {
		white-space: pre-wrap;
		line-height: 1.4;
	}

	ul {
		margin: 0.25rem 0 0;
		padding-left: 1.1rem;
	}

	.error {
		color: #ffb4b4;
		margin: 0;
	}
</style>
