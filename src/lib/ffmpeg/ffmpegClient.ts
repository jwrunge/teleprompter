import {
	type BytesPayload,
	canUseSharedArrayBuffer,
	type FFmpegDeleteFileRequest,
	type FFmpegExecRequest,
	type FFmpegInitRequest,
	type FFmpegTerminateRequest,
	type FFmpegWorkerRequest,
	type FFmpegWorkerResponse,
	type FFmpegWriteFileRequest,
} from "./ffmpegWorkerProtocol";

export type FFmpegClientOptions = {
	preferMultiThread?: boolean;
	baseURL?: string;
	onLog?: (message: string) => void;
	onProgress?: (progress: number, time?: number) => void;
};

type FFmpegWorkerRequestWithoutId =
	| Omit<FFmpegInitRequest, "requestId">
	| Omit<FFmpegWriteFileRequest, "requestId">
	| Omit<FFmpegDeleteFileRequest, "requestId">
	| Omit<FFmpegExecRequest, "requestId">
	| Omit<FFmpegTerminateRequest, "requestId">;

export class FFmpegClient {
	private worker: Worker;
	private pending = new Map<
		string,
		{ resolve: (value: unknown) => void; reject: (err: unknown) => void }
	>();
	private opts: FFmpegClientOptions;
	private readFilePending = new Map<
		string,
		{ resolve: (value: Uint8Array) => void; reject: (err: unknown) => void }
	>();

	constructor(options: FFmpegClientOptions = {}) {
		this.opts = options;
		this.worker = new Worker(new URL("./ffmpeg.worker.ts", import.meta.url), {
			type: "module",
		});

		this.worker.onmessage = (event: MessageEvent<FFmpegWorkerResponse>) => {
			const msg = event.data;
			if (msg.type === "log") {
				this.opts.onLog?.(msg.message);
				return;
			}
			if (msg.type === "progress") {
				this.opts.onProgress?.(msg.progress, msg.time);
				return;
			}

			if (msg.type === "readFileResult") {
				const rf = this.readFilePending.get(msg.requestId);
				if (!rf) return;
				this.readFilePending.delete(msg.requestId);
				rf.resolve(new Uint8Array(msg.data));
				return;
			}

			const pending = this.pending.get(msg.requestId);
			const rf = this.readFilePending.get(msg.requestId);
			if (!pending && !rf) return;

			if (msg.type === "error") {
				if (pending) {
					this.pending.delete(msg.requestId);
					pending.reject(new Error(msg.error.message));
				}
				if (rf) {
					this.readFilePending.delete(msg.requestId);
					rf.reject(new Error(msg.error.message));
				}
				return;
			}

			// ok
			if (pending) {
				this.pending.delete(msg.requestId);
				pending.resolve(msg.result);
			}
		};
	}

	private nextId(): string {
		// Safari can be finicky in some contexts; fall back to Math.random.
		return typeof crypto !== "undefined" && "randomUUID" in crypto
			? (crypto as Crypto).randomUUID()
			: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	private call<T = unknown>(
		msg: FFmpegWorkerRequestWithoutId,
		transfer?: Transferable[],
	): Promise<T> {
		const requestId = this.nextId();
		const full = { ...msg, requestId } as FFmpegWorkerRequest;
		return new Promise<T>((resolve, reject) => {
			this.pending.set(requestId, {
				resolve: (value) => resolve(value as T),
				reject,
			});
			this.worker.postMessage(full, transfer ?? []);
		});
	}

	async init(): Promise<{ loaded: boolean; multiThread: boolean }> {
		return this.call({
			type: "init",
			preferMultiThread: this.opts.preferMultiThread,
			baseURL: this.opts.baseURL,
		});
	}

	async writeFile(name: string, data: Uint8Array): Promise<void> {
		const payload: BytesPayload = canUseSharedArrayBuffer()
			? {
					kind: "shared",
					buffer: toSharedArrayBuffer(data),
					byteLength: data.byteLength,
				}
			: {
					kind: "transfer",
					buffer: data.buffer.slice(
						data.byteOffset,
						data.byteOffset + data.byteLength,
					) as ArrayBuffer,
					byteLength: data.byteLength,
				};

		const transfer = payload.kind === "transfer" ? [payload.buffer] : [];
		await this.call<void>({ type: "writeFile", name, data: payload }, transfer);
	}

	async readFile(name: string): Promise<Uint8Array> {
		const requestId = this.nextId();
		const full: FFmpegWorkerRequest = { type: "readFile", requestId, name };
		return new Promise<Uint8Array>((resolve, reject) => {
			this.readFilePending.set(requestId, { resolve, reject });
			this.worker.postMessage(full);
		});
	}

	async deleteFile(name: string): Promise<void> {
		await this.call<void>({ type: "deleteFile", name });
	}

	async exec(args: string[]): Promise<{ exitCode: number }> {
		return this.call({ type: "exec", args });
	}

	async terminate(): Promise<void> {
		try {
			await this.call<void>({ type: "terminate" });
		} finally {
			this.worker.terminate();
		}
	}
}

export function toSharedArrayBuffer(u8: Uint8Array): SharedArrayBuffer {
	// SharedArrayBuffer cannot be transferred; it's shared. We still need to copy into it once.
	const sab = new SharedArrayBuffer(u8.byteLength);
	new Uint8Array(sab).set(u8);
	return sab;
}
