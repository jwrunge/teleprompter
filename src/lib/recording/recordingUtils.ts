import type { Directory } from "@capacitor/filesystem";

export type RecordingDirectory = "Documents" | "Data" | "Cache";

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

function toCapacitorDirectory(dir: RecordingDirectory): Directory {
	// Imported lazily at runtime in saveToCapacitorFilesystem.
	return dir as unknown as Directory;
}

export async function saveToCapacitorFilesystem(
	blob: Blob,
	fileName: string,
	directory: RecordingDirectory,
	subdir = "recordings",
): Promise<{ filePath: string; fileUri?: string }> {
	const { Filesystem, Directory } = await import("@capacitor/filesystem");

	const base64 = await blobToBase64(blob);
	const dir =
		directory === "Cache"
			? Directory.Cache
			: directory === "Data"
				? Directory.Data
				: Directory.Documents;

	// keep old behavior but allow optional override
	void toCapacitorDirectory(directory);

	const filePath = `${subdir}/${fileName}`;
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
