import { isNativeShell } from "../platform/runtime";
import {
	type RecordingDirectory,
	saveBlobToAppData,
} from "../storage/fileStore";

export type { RecordingDirectory };

export function pickSupportedMimeType(
	preferred: string | undefined,
	candidates: string[],
): string {
	if (typeof MediaRecorder === "undefined") {
		throw new Error("MediaRecorder is not available in this environment.");
	}

	const all = [preferred, ...candidates].filter(Boolean) as string[];
	for (const candidate of all) {
		if (MediaRecorder.isTypeSupported(candidate)) return candidate;
	}

	throw new Error("No supported MediaRecorder mimeType found on this device.");
}

export function mimeToExtension(mimeType: string): string {
	const mt = mimeType.toLowerCase();
	if (mt.includes("mp4")) return "mp4";
	if (mt.includes("ogg")) return "ogg";
	if (mt.includes("wav")) return "wav";
	// Default container for MediaRecorder in browsers is typically WebM.
	return "webm";
}

export function blobToBase64(blob: Blob): Promise<string> {
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

export async function saveToAppFilesystem(
	blob: Blob,
	fileName: string,
	_directory: RecordingDirectory,
	subdir = "recordings",
): Promise<{ filePath: string; fileUri?: string }> {
	if (!isNativeShell()) {
		throw new Error("Native filesystem save is not available on web.");
	}

	const filePath = `${subdir}/${fileName}`;
	await saveBlobToAppData(blob, filePath);
	return { filePath };
}
