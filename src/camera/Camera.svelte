<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { Capacitor } from "@capacitor/core";
	import { VideoRecorder, type RecordingResult } from "../lib/recording/videoRecorder";
	import {
		AudioRecorder,
		type RecordingResult as AudioRecordingResult,
	} from "../lib/recording/audioRecorder";

	type RecordingMode = "video+audio" | "video-only" | "audio-only";

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

	let videoDevices = $state<MediaDeviceInfo[]>([]);
	let audioDevices = $state<MediaDeviceInfo[]>([]);
	let selectedVideoDeviceId = $state<string>("");
	let selectedAudioDeviceId = $state<string>("");
	let hasDeviceLabels = $state(false);

	let {
		autoplay = true,
		muted = true,
		playsInline = true,
		facingMode = "user",
		videoPreset = "720p",
		frameRate = 30,
		recordingBitsPerSecond = 8_000_000,
		recordingMode = "video+audio",
		audioBitsPerSecond = 128_000,
	}: {
		autoplay?: boolean;
		muted?: boolean;
		playsInline?: boolean;
		facingMode?: "user" | "environment";
		videoPreset?: "source" | "480p" | "720p" | "1080p";
		frameRate?: number;
		recordingBitsPerSecond?: number;
		recordingMode?: RecordingMode;
		audioBitsPerSecond?: number;
	} = $props();

	let actualWidth = $state<number | null>(null);
	let actualHeight = $state<number | null>(null);
	let actualFrameRate = $state<number | null>(null);

	function baseVideoConstraints() {
		if (videoPreset === "source") return {} as const;

		const presetMap = {
			"480p": { width: 854, height: 480 },
			"720p": { width: 1280, height: 720 },
			"1080p": { width: 1920, height: 1080 },
		} as const;

		const preset = presetMap[videoPreset];
		return {
			width: { ideal: preset.width },
			height: { ideal: preset.height },
			frameRate: frameRate ? { ideal: frameRate } : undefined,
		} as const;
	}

	function desiredVideoConstraints() {
		const base = baseVideoConstraints();
		if (selectedVideoDeviceId) {
			return {
				...base,
				deviceId: { exact: selectedVideoDeviceId },
			} as const;
		}
		return {
			...base,
			facingMode,
		} as const;
	}

	function deviceLabel(dev: MediaDeviceInfo, fallback: string) {
		const label = dev.label?.trim();
		if (label) return label;
		const shortId = dev.deviceId ? dev.deviceId.slice(-4) : "";
		return shortId ? `${fallback} (${shortId})` : fallback;
	}

	async function refreshDevices() {
		if (!navigator.mediaDevices?.enumerateDevices) return;
		const devices = await navigator.mediaDevices.enumerateDevices();
		videoDevices = devices.filter((d) => d.kind === "videoinput");
		audioDevices = devices.filter((d) => d.kind === "audioinput");
		hasDeviceLabels = devices.some((d) => Boolean(d.label));

		if (selectedVideoDeviceId && !videoDevices.some((d) => d.deviceId === selectedVideoDeviceId)) {
			selectedVideoDeviceId = "";
		}
		if (selectedAudioDeviceId && !audioDevices.some((d) => d.deviceId === selectedAudioDeviceId)) {
			selectedAudioDeviceId = "";
		}
	}

	async function requestPermissionsForLabels() {
		if (!navigator.mediaDevices?.getUserMedia) return;
		const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
		for (const t of tmp.getTracks()) t.stop();
		await refreshDevices();
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
					video: desiredVideoConstraints(),
					audio: false,
				});
			} catch (err) {
				// If constraints are too strict (common on mobile), fall back to default camera.
				stream = await navigator.mediaDevices.getUserMedia({
					video: selectedVideoDeviceId
						? { deviceId: { exact: selectedVideoDeviceId } }
						: { facingMode },
					audio: false,
				});
			}

			await refreshDevices();

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

	async function ensureMicStream(required: boolean) {
		if (!required) return;
		if (micStream) return;
		if (!navigator.mediaDevices?.getUserMedia) {
			throw new Error("getUserMedia is not supported in this browser.");
		}
		micStream = await navigator.mediaDevices.getUserMedia({
			audio: selectedAudioDeviceId
				? {
					deviceId: { exact: selectedAudioDeviceId },
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				}
				: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			video: false,
		});

		await refreshDevices();
	}

	async function startRecording() {
		recordError = null;
		resetDownload();

		try {
			if (recordingMode === "audio-only") {
				await ensureMicStream(true);
				if (!micStream) throw new Error("Microphone is not started.");
				audioRecorder = new AudioRecorder({
					stream: micStream,
					timesliceMs: 1000,
					directory: "Documents",
					audioBitsPerSecond,
				});
				audioRecorder.start();
				videoRecorder = null;
			} else {
				if (!stream) await start();
				if (!stream) throw new Error("Camera is not started.");

				if (recordingMode === "video+audio") {
					await ensureMicStream(true);
					if (!micStream) throw new Error("Microphone is not started.");
					const combined = new MediaStream([
						...stream.getVideoTracks(),
						...micStream.getAudioTracks(),
					]);
					videoRecorder = new VideoRecorder({
						stream: combined,
						timesliceMs: 1000,
						directory: "Documents",
						bitsPerSecond: recordingBitsPerSecond,
						fileName: `av-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
					});
				} else {
					videoRecorder = new VideoRecorder({
						stream,
						timesliceMs: 1000,
						directory: "Documents",
						bitsPerSecond: recordingBitsPerSecond,
					});
				}

				videoRecorder.start();
				audioRecorder = null;
			}

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
			if (audioRecorder) {
				const result = await audioRecorder.stop();
				lastAudioRecording = result;
				if (!Capacitor.isNativePlatform()) {
					audioDownloadUrl = URL.createObjectURL(result.blob);
				}
				lastVideoRecording = null;
				videoDownloadUrl = null;
			} else if (videoRecorder) {
				const result = await videoRecorder.stop();
				lastVideoRecording = result;
				if (!Capacitor.isNativePlatform()) {
					videoDownloadUrl = URL.createObjectURL(result.blob);
				}
				lastAudioRecording = null;
				audioDownloadUrl = null;
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
		selectedVideoDeviceId = "";
		facingMode = facingMode === "user" ? "environment" : "user";
		await start();
	}

	onMount(() => {
		void refreshDevices();
		navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
		if (autoplay) void start();
	});

	onDestroy(() => {
		navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
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
		<label class="field">
			<span>Mode</span>
			<select
				value={recordingMode}
				onchange={(e) => {
					recordingMode = (e.currentTarget as HTMLSelectElement)
						.value as RecordingMode;
					stopMicStream();
				}}
				disabled={isRecording}
			>
				<option value="video+audio">video + audio (single file)</option>
				<option value="video-only">video only</option>
				<option value="audio-only">audio only</option>
			</select>
		</label>

		<label class="field">
			<span>Camera</span>
			<select
				value={selectedVideoDeviceId}
				onchange={(e) => {
					selectedVideoDeviceId = (e.currentTarget as HTMLSelectElement).value;
					if (stream && !isRecording) void start();
				}}
				disabled={isStarting || isRecording}
			>
				<option value="">Auto (front/back)</option>
				{#each videoDevices as dev, idx}
					<option value={dev.deviceId}>
						{deviceLabel(dev, `Camera ${idx + 1}`)}
					</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span>Mic</span>
			<select
				value={selectedAudioDeviceId}
				onchange={(e) => {
					selectedAudioDeviceId = (e.currentTarget as HTMLSelectElement).value;
					stopMicStream();
				}}
				disabled={isRecording || recordingMode === "video-only"}
			>
				<option value="">Default mic</option>
				{#each audioDevices as dev, idx}
					<option value={dev.deviceId}>
						{deviceLabel(dev, `Mic ${idx + 1}`)}
					</option>
				{/each}
			</select>
		</label>

		<button type="button" onclick={() => void refreshDevices()} disabled={isStarting || isRecording}
			>Refresh</button
		>
		{#if !hasDeviceLabels}
			<button
				type="button"
				onclick={() => void requestPermissionsForLabels()}
				disabled={isStarting || isRecording}
			>
				Show device names
			</button>
		{/if}
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
				disabled={isRecording || recordingMode === "audio-only"}
			>
				<option value="2500000">2.5</option>
				<option value="5000000">5</option>
				<option value="8000000">8</option>
				<option value="12000000">12</option>
				<option value="20000000">20</option>
			</select>
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
				disabled={isRecording || recordingMode === "video-only"}
			>
				<option value="64000">64</option>
				<option value="96000">96</option>
				<option value="128000">128</option>
				<option value="192000">192</option>
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
				{recordingMode === "video+audio" ? "A/V" : "Video"}: {Math.round(
					lastVideoRecording.sizeBytes / 1024,
				)} KB ({Math.round(
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
					download={lastVideoRecording.fileName}
				>
					Download {recordingMode === "video+audio" ? "A/V" : "video"}
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
