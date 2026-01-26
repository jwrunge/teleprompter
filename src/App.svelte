<script lang="ts">
	import Camera from './camera/Camera.svelte';
	import Files from './files/Files.svelte';
	import { createSpeechRecognizer, type SpeechRecognizer } from './lib/speech';
	import { onDestroy } from 'svelte';

	let recognizer: SpeechRecognizer | null = null;
	let isSupported = true;
	let recState: string = 'idle';
	let backend: string = 'auto';
	let language = 'en-US';
	let partial = '';
	let finals: string[] = [];
	let lastError: string | null = null;

  let show = $state<"files" | "voice">("files");

	function ensureRecognizer() {
		if (recognizer) return

		recognizer = createSpeechRecognizer(
			{
				onStateChange: (s) => (recState = s),
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
          <select bind:value={backend} onchange={() => {
            recognizer?.dispose()
            recognizer = null
            recState = 'idle';
            partial = '';
            lastError = null;
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
        <button type="button" onclick={startListening} disabled={!isSupported || recState === 'starting' || recState === 'listening'}>
          Start
        </button>
        <button type="button" onclick={stopListening} disabled={recState !== 'listening' && recState !== 'starting'}>
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