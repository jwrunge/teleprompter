import { Capacitor } from "@capacitor/core";

type RecorderState = "idle" | "recording" | "stopping";

export type RecordingResult = {
	blob: Blob;
	mimeType: string;
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
	directory?: "Documents" | "Data" | "Cache";
};

function pickMimeType(preferred?: string): string {
	if (typeof MediaRecorder === "undefined") {
		throw new Error("MediaRecorder is not available in this environment.");
	}

	const candidates = [
		preferred,
		"video/webm;codecs=vp9,opus",
		"video/webm;codecs=vp8,opus",
		"video/webm",
		"video/mp4",
	].filter(Boolean) as string[];

	for (const candidate of candidates) {
		if (MediaRecorder.isTypeSupported(candidate)) return candidate;
	}

	throw new Error("No supported MediaRecorder mimeType found on this device.");
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () =>
			reject(reader.error ?? new Error("Failed reading blob"));
		reader.onload = () => {
			const dataUrl = String(reader.result ?? "");
			const commaIdx = dataUrl.indexOf(",");
			resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
		};
		reader.readAsDataURL(blob);
	});
}

async function saveToCapacitorFilesystem(
	blob: Blob,
	fileName: string,
	directory: VideoRecorderOptions["directory"],
): Promise<{ filePath: string; fileUri?: string }> {
	const { Filesystem, Directory } = await import("@capacitor/filesystem");

	const base64 = await blobToBase64(blob);
	const dir =
		directory === "Cache"
			? Directory.Cache
			: directory === "Data"
				? Directory.Data
				: Directory.Documents;

	const filePath = `recordings/${fileName}`;
	await Filesystem.writeFile({
		path: filePath,
		directory: dir,
		data: base64,
		recursive: true,
	});

	let fileUri: string | undefined;
	try {
		const uriResult = await Filesystem.getUri({
			path: filePath,
			directory: dir,
		});
		fileUri = uriResult.uri;
	} catch {
		// Optional
	}

	return { filePath, fileUri };
}

export class VideoRecorder {
	private mediaRecorder: MediaRecorder;
	private chunks: Blob[] = [];
	private startedAtMs = 0;
	private _state: RecorderState = "idle";
	private mimeType: string;
	private timesliceMs: number;
	private bitsPerSecond?: number;
	private fileName: string;
	private directory: VideoRecorderOptions["directory"];

	get state() {
		return this._state;
	}

	get isSupported() {
		return typeof MediaRecorder !== "undefined";
	}

	constructor(options: VideoRecorderOptions) {
		this.mimeType = pickMimeType(options.mimeType);
		this.timesliceMs = options.timesliceMs ?? 1000;
		this.bitsPerSecond = options.bitsPerSecond;
		this.fileName =
			options.fileName ??
			`recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
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
					if (Capacitor.isNativePlatform()) {
						const saved = await saveToCapacitorFilesystem(
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
	return (
		typeof (globalThis as any).VideoEncoder !== "undefined" &&
		typeof (globalThis as any).MediaStreamTrackProcessor !== "undefined"
	);
}
