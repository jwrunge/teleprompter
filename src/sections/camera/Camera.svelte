<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { isNativeShell } from "../../lib/platform/runtime";
	import {
		VideoRecorder,
		type RecordingResult,
	} from "../../lib/recording/videoRecorder";
	import {
		AudioRecorder,
		type RecordingResult as AudioRecordingResult,
	} from "../../lib/recording/audioRecorder";
	import {
		clearDeviceProfiles,
		loadDeviceProfiles,
		makeProfileFromTrack,
		upsertDeviceProfile,
		type DeviceProfile,
	} from "../../lib/devices/deviceProfiles";
	import { exportRecordingToMp4 } from "../../lib/ffmpeg/ffmpegExport";

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
	let exportError = $state<string | null>(null);
	let exportPath = $state<string | null>(null);
	let isExporting = $state(false);

	let videoDevices = $state<MediaDeviceInfo[]>([]);
	let audioDevices = $state<MediaDeviceInfo[]>([]);
	let selectedVideoDeviceId = $state<string>("");
	let selectedAudioDeviceId = $state<string>("");
	let hasDeviceLabels = $state(false);
	let deviceProfiles = $state<DeviceProfile[]>([]);
	let profilesDownloadUrl = $state<string | null>(null);

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

		if (
			selectedVideoDeviceId &&
			!videoDevices.some((d) => d.deviceId === selectedVideoDeviceId)
		) {
			selectedVideoDeviceId = "";
		}
		if (
			selectedAudioDeviceId &&
			!audioDevices.some((d) => d.deviceId === selectedAudioDeviceId)
		) {
			selectedAudioDeviceId = "";
		}
	}

	function refreshProfiles() {
		deviceProfiles = loadDeviceProfiles();
	}

	function resetProfilesDownload() {
		if (profilesDownloadUrl) URL.revokeObjectURL(profilesDownloadUrl);
		profilesDownloadUrl = null;
	}

	function exportProfiles() {
		resetProfilesDownload();
		const blob = new Blob([JSON.stringify(deviceProfiles, null, 2)], {
			type: "application/json",
		});
		profilesDownloadUrl = URL.createObjectURL(blob);
	}

	function clearProfiles() {
		clearDeviceProfiles();
		refreshProfiles();
		resetProfilesDownload();
	}

	function findDeviceById(
		kind: "videoinput" | "audioinput",
		deviceId: string,
	) {
		const list = kind === "videoinput" ? videoDevices : audioDevices;
		return list.find((d) => d.deviceId === deviceId);
	}

	function recordTrackProfile(
		kind: "videoinput" | "audioinput",
		track: MediaStreamTrack,
		hintedDeviceId?: string,
	) {
		const deviceId = hintedDeviceId || track.getSettings?.().deviceId || "";
		const deviceInfo = deviceId
			? findDeviceById(kind, deviceId)
			: undefined;
		const profile = makeProfileFromTrack({
			kind,
			deviceInfo,
			track,
			appNotes:
				kind === "videoinput"
					? `preset=${videoPreset}, fps=${frameRate}`
					: `audioBitsPerSecond=${audioBitsPerSecond}`,
		});
		deviceProfiles = upsertDeviceProfile(profile);
	}

	async function requestPermissionsForLabels() {
		if (!navigator.mediaDevices?.getUserMedia) return;
		const tmp = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true,
		});
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
				recordTrackProfile("videoinput", track, selectedVideoDeviceId);
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
		exportError = null;
		exportPath = null;
		isExporting = false;
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
		const track = micStream.getAudioTracks()[0];
		if (track)
			recordTrackProfile("audioinput", track, selectedAudioDeviceId);
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
					if (!micStream)
						throw new Error("Microphone is not started.");
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
				if (!isNativeShell()) {
					audioDownloadUrl = URL.createObjectURL(result.blob);
				}
				lastVideoRecording = null;
				videoDownloadUrl = null;
				exportError = null;
				exportPath = null;
			} else if (videoRecorder) {
				const result = await videoRecorder.stop();
				lastVideoRecording = result;
				if (!isNativeShell()) {
					videoDownloadUrl = URL.createObjectURL(result.blob);
				}
				lastAudioRecording = null;
				audioDownloadUrl = null;
				exportError = null;
				exportPath = null;
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

	async function exportLastRecordingToMp4() {
		if (!lastVideoRecording?.filePath) return;
		if (!isNativeShell()) return;

		isExporting = true;
		exportError = null;
		try {
			const result = await exportRecordingToMp4(
				lastVideoRecording.filePath,
			);
			exportPath = result.filePath;
		} catch (err) {
			exportError = err instanceof Error ? err.message : String(err);
		} finally {
			isExporting = false;
		}
	}

	async function toggleFacingMode() {
		selectedVideoDeviceId = "";
		facingMode = facingMode === "user" ? "environment" : "user";
		await start();
	}

	onMount(() => {
		void refreshDevices();
		refreshProfiles();
		navigator.mediaDevices?.addEventListener?.(
			"devicechange",
			refreshDevices,
		);
		if (autoplay) void start();
	});

	onDestroy(() => {
		navigator.mediaDevices?.removeEventListener?.(
			"devicechange",
			refreshDevices,
		);
		void stop();
		resetDownload();
		resetProfilesDownload();
	});
</script>

<div class="camera">
	<video bind:this={videoEl} {muted} {autoplay} playsinline={playsInline}
	></video>

	<div class="controls">
		<sl-button variant="primary" onclick={start} disabled={isStarting}>
			Start
		</sl-button>
		<sl-button type="button" onclick={() => void stop()}>Stop</sl-button>
		<sl-button onclick={toggleFacingMode} disabled={isStarting}>
			Flip
		</sl-button>
	</div>

	<div class="controls">
		<sl-select
			label="Recording Mode"
			value={recordingMode}
			onsl-change={(e) => {
				recordingMode = e.currentTarget.value as RecordingMode;
				stopMicStream();
			}}
			disabled={isRecording}
		>
			<sl-option value="video+audio"
				>video + audio (single file)</sl-option
			>
			<sl-option value="video-only">video only</sl-option>
			<sl-option value="audio-only">audio only</sl-option>
		</sl-select>

		<sl-select
			label="Camera"
			value={selectedVideoDeviceId}
			onsl-change={(e) => {
				const v = e.currentTarget.value;
				selectedVideoDeviceId = Array.isArray(v) ? (v[0] ?? "") : v;
				if (stream && !isRecording) void start();
			}}
			disabled={isStarting || isRecording}
		>
			<sl-option value="">Auto (front/back)</sl-option>
			{#each videoDevices as dev, idx}
				<sl-option value={dev.deviceId}>
					{deviceLabel(dev, `Camera ${idx + 1}`)}
				</sl-option>
			{/each}
		</sl-select>

		<sl-select
			label="Mic"
			value={selectedAudioDeviceId}
			onsl-change={(e) => {
				const v = e.currentTarget.value;
				selectedAudioDeviceId = Array.isArray(v) ? (v[0] ?? "") : v;
				stopMicStream();
			}}
			disabled={isRecording || recordingMode === "video-only"}
		>
			<sl-option value="">Default mic</sl-option>
			{#each audioDevices as dev, idx}
				<sl-option value={dev.deviceId}>
					{deviceLabel(dev, `Mic ${idx + 1}`)}
				</sl-option>
			{/each}
		</sl-select>

		<sl-button
			onclick={() => void refreshDevices()}
			disabled={isStarting || isRecording}>Refresh</sl-button
		>
		{#if !hasDeviceLabels}
			<sl-button
				onclick={() => void requestPermissionsForLabels()}
				disabled={isStarting || isRecording}
			>
				Show device names
			</sl-button>
		{/if}
	</div>

	<div class="controls">
		<sl-button
			onclick={() => refreshProfiles()}
			disabled={isStarting || isRecording}>Reload profiles</sl-button
		>
		<sl-button
			onclick={exportProfiles}
			disabled={deviceProfiles.length === 0}>Export profiles</sl-button
		>
		<sl-button
			onclick={clearProfiles}
			disabled={deviceProfiles.length === 0}>Clear profiles</sl-button
		>
		{#if profilesDownloadUrl}
			<a
				class="link"
				href={profilesDownloadUrl}
				download="device-profiles.json">Download profiles JSON</a
			>
		{/if}
		{#if deviceProfiles.length > 0}
			<p class="meta">Profiles: {deviceProfiles.length}</p>
		{/if}
	</div>

	<div class="controls">
		<sl-select
			label="Resolution"
			value={videoPreset}
			onsl-change={(e) => {
				videoPreset = e.currentTarget.value as typeof videoPreset;
				if (stream) void start();
			}}
			disabled={isStarting || isRecording}
		>
			<sl-option value="source">source</sl-option>
			<sl-option value="480p">480p</sl-option>
			<sl-option value="720p">720p</sl-option>
			<sl-option value="1080p">1080p</sl-option>
		</sl-select>

		<sl-input
			label="FPS"
			type="number"
			min="1"
			max="60"
			value={frameRate}
			onchange={(e) => {
				frameRate = Number(e.currentTarget.value);
				if (stream) void start();
			}}
			disabled={isStarting || isRecording}
			style="width: 6rem;"
		></sl-input>
	</div>

	<div class="controls">
		<sl-button onclick={startRecording} disabled={isStarting || isRecording}
			>Record</sl-button
		>
		<sl-button onclick={stopRecording} disabled={!isRecording}
			>Stop Recording</sl-button
		>
	</div>

	<div class="controls">
		<sl-select
			label="Bitrate (Mbps)"
			value={String(recordingBitsPerSecond)}
			onsl-change={(e) => {
				recordingBitsPerSecond = Number(e.currentTarget.value);
			}}
			disabled={isRecording || recordingMode === "audio-only"}
		>
			<sl-option value="2500000">2.5</sl-option>
			<sl-option value="5000000">5</sl-option>
			<sl-option value="8000000">8</sl-option>
			<sl-option value="12000000">12</sl-option>
			<sl-option value="20000000">20</sl-option>
		</sl-select>

		<sl-select
			label="Audio bitrate (kbps)"
			value={String(audioBitsPerSecond)}
			onsl-change={(e) => {
				audioBitsPerSecond = Number(e.currentTarget.value);
			}}
		>
			<sl-option value="64000">64</sl-option>
			<sl-option value="96000">96</sl-option>
			<sl-option value="128000">128</sl-option>
			<sl-option value="192000">192</sl-option>
		</sl-select>

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
				)} KB ({Math.round(lastVideoRecording.durationMs / 1000)}s)
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
			{#if isNativeShell() && lastVideoRecording.filePath}
				<sl-button
					variant="primary"
					onclick={() => void exportLastRecordingToMp4()}
					disabled={isExporting}
				>
					{isExporting ? "Exporting…" : "Export MP4 (desktop)"}
				</sl-button>
				{#if exportPath}
					<p class="meta">MP4 saved: {exportPath}</p>
				{/if}
				{#if exportError}
					<p class="error">{exportError}</p>
				{/if}
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
