<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { Capacitor } from "@capacitor/core";
	import { VideoRecorder, type RecordingResult } from "../lib/recording/videoRecorder";

	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let errorMessage = $state<string | null>(null);
	let isStarting = $state(false);
	let recorder = $state<VideoRecorder | null>(null);
	let isRecording = $state(false);
	let recordError = $state<string | null>(null);
	let lastRecording = $state<RecordingResult | null>(null);
	let downloadUrl = $state<string | null>(null);

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
		void stopRecording();
		if (stream) {
			for (const track of stream.getTracks()) track.stop();
			stream = null;
		}
		if (videoEl) {
			videoEl.srcObject = null;
		}
	}

	function resetDownload() {
		if (downloadUrl) URL.revokeObjectURL(downloadUrl);
		downloadUrl = null;
		lastRecording = null;
		recordError = null;
	}

	async function startRecording() {
		recordError = null;
		resetDownload();

		if (!stream) {
			await start();
		}
		if (!stream) {
			recordError = "Camera is not started.";
			return;
		}

		try {
			recorder = new VideoRecorder({ stream, timesliceMs: 1000, directory: "Documents" });
			recorder.start();
			isRecording = true;
		} catch (err) {
			recordError = err instanceof Error ? err.message : String(err);
			recorder = null;
			isRecording = false;
		}
	}

	async function stopRecording() {
		if (!recorder || !isRecording) return;
		try {
			const result = await recorder.stop();
			lastRecording = result;
			if (!Capacitor.isNativePlatform()) {
				downloadUrl = URL.createObjectURL(result.blob);
			}
		} catch (err) {
			recordError = err instanceof Error ? err.message : String(err);
		} finally {
			recorder = null;
			isRecording = false;
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
		resetDownload();
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

	<div class="controls">
		<button type="button" onclick={startRecording} disabled={isStarting || isRecording}
			>Record</button
		>
		<button type="button" onclick={stopRecording} disabled={!isRecording}
			>Stop Recording</button
		>
	</div>

	{#if recordError}
		<p class="error">{recordError}</p>
	{/if}

	{#if lastRecording}
		<div class="recording">
			<p class="meta">
				Saved {Math.round(lastRecording.sizeBytes / 1024)} KB ({Math.round(
					lastRecording.durationMs / 1000,
				)}s)
			</p>
			{#if lastRecording.filePath}
				<p class="meta">Native file: {lastRecording.filePath}</p>
			{/if}
			{#if downloadUrl}
				<a class="link" href={downloadUrl} download="recording.webm">Download</a>
			{/if}
		</div>
	{/if}

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

	.recording {
		display: grid;
		gap: 0.25rem;
	}

	.meta {
		margin: 0;
		opacity: 0.9;
		font-size: 0.9rem;
	}

	.link {
		color: inherit;
		text-decoration: underline;
		width: fit-content;
	}
</style>
