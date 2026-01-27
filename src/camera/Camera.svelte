<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { Capacitor } from "@capacitor/core";
	import { VideoRecorder, type RecordingResult } from "../lib/recording/videoRecorder";
	import {
		AudioRecorder,
		type RecordingResult as AudioRecordingResult,
	} from "../lib/recording/audioRecorder";

	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let micStream: MediaStream | null = null;
	let errorMessage = $state<string | null>(null);
	let isStarting = $state(false);
	let videoRecorder = $state<VideoRecorder | null>(null);
	let audioRecorder = $state<AudioRecorder | null>(null);
	let isRecording = $state(false);
	let recordError = $state<string | null>(null);
	let lastVideoRecording = $state<RecordingResult | null>(null);
	let lastAudioRecording = $state<AudioRecordingResult | null>(null);
	let videoDownloadUrl = $state<string | null>(null);
	let audioDownloadUrl = $state<string | null>(null);

	let {
		autoplay = true,
		muted = true,
		playsInline = true,
		facingMode = "user",
		videoPreset = "720p",
		frameRate = 30,
		recordingBitsPerSecond = 8_000_000,
		micEnabled = true,
		audioBitsPerSecond = 128_000,
	}: {
		autoplay?: boolean;
		muted?: boolean;
		playsInline?: boolean;
		facingMode?: "user" | "environment";
		videoPreset?: "source" | "480p" | "720p" | "1080p";
		frameRate?: number;
		recordingBitsPerSecond?: number;
		micEnabled?: boolean;
		audioBitsPerSecond?: number;
	} = $props();

	let actualWidth = $state<number | null>(null);
	let actualHeight = $state<number | null>(null);
	let actualFrameRate = $state<number | null>(null);

	function desiredConstraints() {
		if (videoPreset === "source") {
			return { facingMode } as const;
		}

		const presetMap = {
			"480p": { width: 854, height: 480 },
			"720p": { width: 1280, height: 720 },
			"1080p": { width: 1920, height: 1080 },
		} as const;

		const preset = presetMap[videoPreset];
		return {
			facingMode,
			width: { ideal: preset.width },
			height: { ideal: preset.height },
			frameRate: frameRate ? { ideal: frameRate } : undefined,
		} as const;
	}

	async function start() {
		if (isStarting) return;
		isStarting = true;
		errorMessage = null;

		try {
			await stop();

			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error(
					"getUserMedia is not supported in this browser.",
				);
			}

			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: desiredConstraints(),
					audio: false,
				});
			} catch (err) {
				// If constraints are too strict (common on mobile), fall back to default camera.
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode },
					audio: false,
				});
			}

			if (!videoEl) return;
			videoEl.srcObject = stream;

			const track = stream.getVideoTracks()[0];
			if (track) {
				const settings = track.getSettings();
				actualWidth = settings.width ?? null;
				actualHeight = settings.height ?? null;
				actualFrameRate = settings.frameRate ?? null;
			}
			// Always attempt to play once the stream is attached.
			// If autoplay is blocked, the user can press Start again.
			try {
				await videoEl.play();
			} catch {
				// Ignore autoplay errors
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
			await stop();
		} finally {
			isStarting = false;
		}
	}

	async function stop() {
		await stopRecording();
		stopMicStream();
		if (stream) {
			for (const track of stream.getTracks()) track.stop();
			stream = null;
		}
		if (videoEl) {
			videoEl.srcObject = null;
		}
	}

	function resetDownload() {
		if (videoDownloadUrl) URL.revokeObjectURL(videoDownloadUrl);
		if (audioDownloadUrl) URL.revokeObjectURL(audioDownloadUrl);
		videoDownloadUrl = null;
		audioDownloadUrl = null;
		lastVideoRecording = null;
		lastAudioRecording = null;
		recordError = null;
	}

	function stopMicStream() {
		if (!micStream) return;
		for (const track of micStream.getTracks()) track.stop();
		micStream = null;
	}

	async function ensureMicStream() {
		if (!micEnabled) return;
		if (micStream) return;
		if (!navigator.mediaDevices?.getUserMedia) {
			throw new Error("getUserMedia is not supported in this browser.");
		}
		micStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
			video: false,
		});
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
			await ensureMicStream();

			videoRecorder = new VideoRecorder({
				stream,
				timesliceMs: 1000,
				directory: "Documents",
				bitsPerSecond: recordingBitsPerSecond,
			});

			if (micEnabled && micStream) {
				audioRecorder = new AudioRecorder({
					stream: micStream,
					timesliceMs: 1000,
					directory: "Documents",
					audioBitsPerSecond,
				});
			}

			videoRecorder.start();
			audioRecorder?.start();
			isRecording = true;
		} catch (err) {
			recordError = err instanceof Error ? err.message : String(err);
			videoRecorder = null;
			audioRecorder = null;
			stopMicStream();
			isRecording = false;
		}
	}

	async function stopRecording() {
		if (!isRecording) return;
		try {
			const videoStop = videoRecorder?.stop();
			const audioStop = audioRecorder?.stop();

			const [videoResult, audioResult] = await Promise.allSettled([
				videoStop,
				audioStop,
			]);

			if (videoResult.status === "fulfilled" && videoResult.value) {
				lastVideoRecording = videoResult.value;
				if (!Capacitor.isNativePlatform()) {
					videoDownloadUrl = URL.createObjectURL(videoResult.value.blob);
				}
			} else if (videoResult.status === "rejected") {
				recordError =
					videoResult.reason instanceof Error
						? videoResult.reason.message
						: String(videoResult.reason);
			}

			if (audioResult.status === "fulfilled" && audioResult.value) {
				lastAudioRecording = audioResult.value;
				if (!Capacitor.isNativePlatform()) {
					audioDownloadUrl = URL.createObjectURL(audioResult.value.blob);
				}
			} else if (audioResult.status === "rejected") {
				recordError =
					audioResult.reason instanceof Error
						? audioResult.reason.message
						: String(audioResult.reason);
			}
		} catch (err) {
			recordError = err instanceof Error ? err.message : String(err);
		} finally {
			videoRecorder = null;
			audioRecorder = null;
			stopMicStream();
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
		void stop();
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
		<button type="button" onclick={() => void stop()}>Stop</button>
		<button type="button" onclick={toggleFacingMode} disabled={isStarting}
			>Flip</button
		>
	</div>

	<div class="controls">
		<label class="field" style="grid-auto-flow: column; align-items: center; gap: 0.5rem;">
			<input
				type="checkbox"
				checked={micEnabled}
				onchange={(e) => {
					micEnabled = (e.currentTarget as HTMLInputElement).checked;
					if (!micEnabled) stopMicStream();
				}}
				disabled={isRecording}
			/>
			<span>Mic</span>
		</label>

		<label class="field">
			<span>Audio bitrate (kbps)</span>
			<select
				value={String(audioBitsPerSecond)}
				onchange={(e) => {
					audioBitsPerSecond = Number(
						(e.currentTarget as HTMLSelectElement).value,
					);
				}}
				disabled={isRecording || !micEnabled}
			>
				<option value="64000">64</option>
				<option value="96000">96</option>
				<option value="128000">128</option>
				<option value="192000">192</option>
			</select>
		</label>
	</div>

	<div class="controls">
		<label class="field">
			<span>Resolution</span>
			<select
				value={videoPreset}
				onchange={(e) => {
					videoPreset = (e.currentTarget as HTMLSelectElement)
						.value as typeof videoPreset;
					if (stream) void start();
				}}
				disabled={isStarting || isRecording}
			>
				<option value="source">source</option>
				<option value="480p">480p</option>
				<option value="720p">720p</option>
				<option value="1080p">1080p</option>
			</select>
		</label>

		<label class="field">
			<span>FPS</span>
			<input
				type="number"
				min="1"
				max="60"
				value={frameRate}
				onchange={(e) => {
					frameRate = Number(
						(e.currentTarget as HTMLInputElement).value,
					);
					if (stream) void start();
				}}
				disabled={isStarting || isRecording}
				style="width: 6rem;"
			/>
		</label>
	</div>

	<div class="controls">
		<button type="button" onclick={startRecording} disabled={isStarting || isRecording}
			>Record</button
		>
		<button type="button" onclick={stopRecording} disabled={!isRecording}
			>Stop Recording</button
		>
	</div>

	<div class="controls">
		<label class="field">
			<span>Bitrate (Mbps)</span>
			<select
				value={String(recordingBitsPerSecond)}
				onchange={(e) => {
					recordingBitsPerSecond = Number(
						(e.currentTarget as HTMLSelectElement).value,
					);
				}}
				disabled={isRecording}
			>
				<option value="2500000">2.5</option>
				<option value="5000000">5</option>
				<option value="8000000">8</option>
				<option value="12000000">12</option>
				<option value="20000000">20</option>
			</select>
		</label>

		{#if actualWidth && actualHeight}
			<p class="meta">
				Actual: {actualWidth}×{actualHeight}{#if actualFrameRate}
					 @ {Math.round(actualFrameRate)}fps{/if}
			</p>
		{/if}
	</div>

	{#if recordError}
		<p class="error">{recordError}</p>
	{/if}

	{#if lastVideoRecording}
		<div class="recording">
			<p class="meta">
				Video: {Math.round(lastVideoRecording.sizeBytes / 1024)} KB ({Math.round(
					lastVideoRecording.durationMs / 1000,
				)}s)
			</p>
			{#if lastVideoRecording.filePath}
				<p class="meta">Native file: {lastVideoRecording.filePath}</p>
			{/if}
			{#if videoDownloadUrl}
				<a
					class="link"
					href={videoDownloadUrl}
					download={lastVideoRecording.mimeType.includes("mp4") ? "recording.mp4" : "recording.webm"}
				>
					Download
				</a>
			{/if}
		</div>
	{/if}

	{#if lastAudioRecording}
		<div class="recording">
			<p class="meta">
				Audio: {Math.round(lastAudioRecording.sizeBytes / 1024)} KB ({Math.round(
					lastAudioRecording.durationMs / 1000,
				)}s)
			</p>
			{#if lastAudioRecording.filePath}
				<p class="meta">Native file: {lastAudioRecording.filePath}</p>
			{/if}
			{#if audioDownloadUrl}
				<a
					class="link"
					href={audioDownloadUrl}
					download={lastAudioRecording.fileName}
				>
					Download audio
				</a>
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
		align-items: center;
	}

	.field {
		display: grid;
		gap: 0.25rem;
		font-size: 0.85rem;
	}

	select,
	input[type="number"] {
		padding: 0.35rem 0.5rem;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
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
