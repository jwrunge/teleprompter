import { isNativeShell } from "../platform/runtime";

import {
	mimeToExtension,
	pickSupportedMimeType,
	type RecordingDirectory,
	saveToAppFilesystem,
} from "./recordingUtils";

export type RecordingResult = {
	blob: Blob;
	mimeType: string;
	sizeBytes: number;
	durationMs: number;
	fileName: string;
	filePath?: string;
	fileUri?: string;
};

export type AudioRecorderOptions = {
	stream: MediaStream;
	timesliceMs?: number;
	mimeType?: string;
	audioBitsPerSecond?: number;
	fileName?: string;
	directory?: RecordingDirectory;
};

export class AudioRecorder {
	private stream: MediaStream;
	private mediaRecorder: MediaRecorder | null = null;
	private chunks: Blob[] = [];
	private startedAtMs = 0;
	private mimeType: string;
	private timesliceMs: number;
	private audioBitsPerSecond?: number;
	private fileName: string;
	private directory: RecordingDirectory;

	constructor(options: AudioRecorderOptions) {
		this.stream = options.stream;
		this.mimeType = pickSupportedMimeType(options.mimeType, [
			"audio/webm;codecs=opus",
			"audio/webm",
			"audio/mp4",
		]);
		this.timesliceMs = options.timesliceMs ?? 1000;
		this.audioBitsPerSecond = options.audioBitsPerSecond;
		const defaultExt = mimeToExtension(this.mimeType);
		this.fileName =
			options.fileName ??
			`audio-${new Date().toISOString().replace(/[:.]/g, "-")}.${defaultExt}`;
		this.directory = options.directory ?? "Documents";
	}

	start(): void {
		if (this.mediaRecorder) return;

		this.chunks = [];
		this.startedAtMs = Date.now();
		this.mediaRecorder = new MediaRecorder(this.stream, {
			mimeType: this.mimeType,
			audioBitsPerSecond: this.audioBitsPerSecond,
		});

		this.mediaRecorder.addEventListener("dataavailable", (event) => {
			if (event.data && event.data.size > 0) this.chunks.push(event.data);
		});

		this.mediaRecorder.addEventListener("error", (event) => {
			console.error("AudioRecorder error", event);
		});

		this.mediaRecorder.start(this.timesliceMs);
	}

	async stop(): Promise<RecordingResult> {
		const recorder = this.mediaRecorder;
		if (!recorder) {
			throw new Error("AudioRecorder is not running.");
		}

		await new Promise<void>((resolve, reject) => {
			const onStop = () => {
				recorder.removeEventListener("stop", onStop);
				recorder.removeEventListener("error", onError);
				resolve();
			};
			const onError = (event: Event) => {
				recorder.removeEventListener("stop", onStop);
				recorder.removeEventListener("error", onError);
				reject(new Error("Audio recording failed."));
				console.error("AudioRecorder stop error", event);
			};

			recorder.addEventListener("stop", onStop, { once: true });
			recorder.addEventListener("error", onError, { once: true });
			recorder.stop();
		});

		this.mediaRecorder = null;

		const blob = new Blob(this.chunks, { type: this.mimeType });
		const durationMs = Math.max(0, Date.now() - this.startedAtMs);
		this.chunks = [];

		let filePath: string | undefined;
		let fileUri: string | undefined;
		if (isNativeShell()) {
			const saved = await saveToAppFilesystem(
				blob,
				this.fileName,
				this.directory,
			);
			filePath = saved.filePath;
			fileUri = saved.fileUri;
		}

		return {
			blob,
			mimeType: this.mimeType,
			sizeBytes: blob.size,
			durationMs,
			fileName: this.fileName,
			filePath,
			fileUri,
		};
	}

	get isRecording(): boolean {
		return this.mediaRecorder?.state === "recording";
	}
}
