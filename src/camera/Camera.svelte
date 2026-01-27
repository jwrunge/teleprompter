<script lang="ts">
	import { onDestroy, onMount } from "svelte";

	let videoEl = $state<HTMLVideoElement | null>(null);
	let stream: MediaStream | null = null;
	let errorMessage = $state<string | null>(null);
	let isStarting = $state(false);

	let {
		autoplay,
		muted,
		playsInline,
		facingMode,
	}: {
		autoplay?: boolean;
		muted?: boolean;
		playsInline?: boolean;
		facingMode?: "user" | "environment";
	} = $props();

	async function start() {
		if (isStarting) return;
		isStarting = true;
		errorMessage = null;

		try {
			stop();

			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error(
					"getUserMedia is not supported in this browser.",
				);
			}

			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode },
				audio: false,
			});

			if (!videoEl) return;
			videoEl.srcObject = stream;

			if (autoplay) {
				await videoEl.play();
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
			stop();
		} finally {
			isStarting = false;
		}
	}

	function stop() {
		if (stream) {
			for (const track of stream.getTracks()) track.stop();
			stream = null;
		}
		if (videoEl) {
			videoEl.srcObject = null;
		}
	}

	async function toggleFacingMode() {
		facingMode = facingMode === "user" ? "environment" : "user";
		await start();
	}

	onMount(() => {
		if (autoplay) void start();
	});

	onDestroy(() => {
		stop();
	});
</script>

<div class="camera">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video bind:this={videoEl} {muted} {autoplay} playsinline={playsInline}
	></video>

	<div class="controls">
		<button type="button" onclick={start} disabled={isStarting}
			>Start</button
		>
		<button type="button" onclick={stop}>Stop</button>
		<button type="button" onclick={toggleFacingMode} disabled={isStarting}
			>Flip</button
		>
	</div>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}
</div>

<style>
	.camera {
		display: grid;
		gap: 0.75rem;
	}

	video {
		width: min(100%, 720px);
		aspect-ratio: 16 / 9;
		background: #111;
		border-radius: 12px;
		object-fit: cover;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
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

	.error {
		color: #ffb4b4;
		margin: 0;
	}
</style>
