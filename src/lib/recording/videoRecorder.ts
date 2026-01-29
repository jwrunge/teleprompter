import { isNativeShell } from "../platform/runtime";

import {
	mimeToExtension,
	pickSupportedMimeType,
	type RecordingDirectory,
	saveToAppFilesystem,
} from "./recordingUtils";

type RecorderState = "idle" | "recording" | "stopping";

export type RecordingResult = {
	blob: Blob;
	mimeType: string;
	fileName: string;
	sizeBytes: number;
	durationMs: number;
	filePath?: string;
	fileUri?: string;
};

export type VideoRecorderOptions = {
	stream: MediaStream;
	timesliceMs?: number;
	mimeType?: string;
	bitsPerSecond?: number;
	fileName?: string;
	directory?: RecordingDirectory;
};

export class VideoRecorder {
	private mediaRecorder: MediaRecorder;
	private chunks: Blob[] = [];
	private startedAtMs = 0;
	private _state: RecorderState = "idle";
	private mimeType: string;
	private timesliceMs: number;
	private bitsPerSecond?: number;
	private fileName: string;
	private directory: RecordingDirectory;

	get state() {
		return this._state;
	}

	get isSupported() {
		return typeof MediaRecorder !== "undefined";
	}

	constructor(options: VideoRecorderOptions) {
		this.mimeType = pickSupportedMimeType(options.mimeType, [
			"video/webm;codecs=vp9,opus",
			"video/webm;codecs=vp8,opus",
			"video/webm",
			"video/mp4",
		]);
		this.timesliceMs = options.timesliceMs ?? 1000;
		this.bitsPerSecond = options.bitsPerSecond;
		const defaultExt = mimeToExtension(this.mimeType);
		this.fileName =
			options.fileName ??
			`recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${defaultExt}`;
		this.directory = options.directory ?? "Documents";

		this.mediaRecorder = new MediaRecorder(options.stream, {
			mimeType: this.mimeType,
			bitsPerSecond: this.bitsPerSecond,
		});

		this.mediaRecorder.ondataavailable = (ev) => {
			if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
		};
	}

	start() {
		if (this._state !== "idle") return;
		this.chunks = [];
		this.startedAtMs = Date.now();
		this._state = "recording";
		this.mediaRecorder.start(this.timesliceMs);
	}

	stop(): Promise<RecordingResult> {
		if (this._state !== "recording") {
			return Promise.reject(new Error("Recorder is not recording."));
		}

		this._state = "stopping";
		return new Promise((resolve, reject) => {
			this.mediaRecorder.onerror = (ev) => {
				this._state = "idle";
				const maybeError = (ev as unknown as { error?: unknown }).error;
				reject(maybeError ?? new Error("MediaRecorder error"));
			};

			this.mediaRecorder.onstop = async () => {
				try {
					const durationMs = Math.max(0, Date.now() - this.startedAtMs);
					const blob = new Blob(this.chunks, { type: this.mimeType });

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

					this._state = "idle";
					resolve({
						blob,
						mimeType: this.mimeType,
						fileName: this.fileName,
						sizeBytes: blob.size,
						durationMs,
						filePath,
						fileUri,
					});
				} catch (err) {
					this._state = "idle";
					reject(err);
				}
			};

			try {
				this.mediaRecorder.stop();
			} catch (err) {
				this._state = "idle";
				reject(err);
			}
		});
	}
}

export function isWebCodecsLikelyAvailable(): boolean {
	const g = globalThis as unknown as Record<string, unknown>;
	return (
		typeof g.VideoEncoder !== "undefined" &&
		typeof g.MediaStreamTrackProcessor !== "undefined"
	);
}
