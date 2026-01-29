/// <reference lib="webworker" />

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

import type {
	BytesPayload,
	FFmpegWorkerRequest,
	FFmpegWorkerResponse,
} from "./ffmpegWorkerProtocol";

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

function isCrossOriginIsolated(): boolean {
	return (
		(globalThis as unknown as { crossOriginIsolated?: boolean })
			.crossOriginIsolated === true
	);
}

function post(message: FFmpegWorkerResponse, transfer?: Transferable[]) {
	(self as unknown as DedicatedWorkerGlobalScope).postMessage(
		message,
		transfer ?? [],
	);
}

function errToObj(error: unknown): { message: string; stack?: string } {
	if (error instanceof Error)
		return { message: error.message, stack: error.stack };
	return { message: String(error) };
}

function bytesToU8(data: BytesPayload): Uint8Array {
	if (data.kind === "shared") {
		return new Uint8Array(data.buffer, 0, data.byteLength);
	}
	return new Uint8Array(data.buffer, 0, data.byteLength);
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
	// Always produce a transferable ArrayBuffer.
	const ab = new ArrayBuffer(u8.byteLength);
	new Uint8Array(ab).set(u8);
	return ab;
}

async function ensureLoaded(options?: {
	preferMultiThread?: boolean;
	baseURL?: string;
}) {
	if (!ffmpeg) {
		ffmpeg = new FFmpeg();
		ffmpeg.on("log", ({ message }) => post({ type: "log", message }));
		ffmpeg.on("progress", ({ progress, time }) =>
			post({ type: "progress", progress, time }),
		);
	}

	if (isLoaded) return;

	const preferMT = options?.preferMultiThread ?? true;
	const canMT = preferMT && isCrossOriginIsolated();

	// Using blob URLs avoids CORS/COEP issues when fetching cross-origin.
	const baseURL =
		options?.baseURL ??
		(canMT
			? "https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm"
			: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm");

	await ffmpeg.load({
		coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
		wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
		// Only needed for multi-thread build.
		workerURL: canMT
			? await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript")
			: undefined,
	});

	isLoaded = true;
}

self.onmessage = async (event: MessageEvent<FFmpegWorkerRequest>) => {
	const msg = event.data;
	try {
		switch (msg.type) {
			case "init": {
				await ensureLoaded({
					preferMultiThread: msg.preferMultiThread,
					baseURL: msg.baseURL,
				});
				post({
					type: "ok",
					requestId: msg.requestId,
					result: {
						loaded: true,
						multiThread: isCrossOriginIsolated(),
					},
				});
				return;
			}

			case "writeFile": {
				await ensureLoaded();
				if (!ffmpeg) throw new Error("FFmpeg not initialized");
				await ffmpeg.writeFile(msg.name, bytesToU8(msg.data));
				post({ type: "ok", requestId: msg.requestId });
				return;
			}

			case "readFile": {
				await ensureLoaded();
				if (!ffmpeg) throw new Error("FFmpeg not initialized");
				const data = await ffmpeg.readFile(msg.name);
				const u8 =
					typeof data === "string" ? new TextEncoder().encode(data) : data;
				const ab = toArrayBuffer(u8);
				post(
					{
						type: "readFileResult",
						requestId: msg.requestId,
						name: msg.name,
						data: ab,
					},
					[ab],
				);
				return;
			}

			case "deleteFile": {
				await ensureLoaded();
				if (!ffmpeg) throw new Error("FFmpeg not initialized");
				await ffmpeg.deleteFile(msg.name);
				post({ type: "ok", requestId: msg.requestId });
				return;
			}

			case "exec": {
				await ensureLoaded();
				if (!ffmpeg) throw new Error("FFmpeg not initialized");
				const exitCode = await ffmpeg.exec(msg.args);
				post({ type: "ok", requestId: msg.requestId, result: { exitCode } });
				return;
			}

			case "terminate": {
				if (ffmpeg) {
					try {
						ffmpeg.terminate();
					} catch {
						// ignore
					}
				}
				ffmpeg = null;
				isLoaded = false;
				post({ type: "ok", requestId: msg.requestId });
				return;
			}
		}
	} catch (error) {
		post({ type: "error", requestId: msg.requestId, error: errToObj(error) });
	}
};
