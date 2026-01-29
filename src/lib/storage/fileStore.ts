import { isTauri } from "../platform/runtime";

export type RecordingDirectory = "Documents" | "Data" | "Cache";

export async function saveBlobToAppData(
	blob: Blob,
	relativePath: string,
): Promise<{ filePath: string }> {
	if (!isTauri()) {
		throw new Error("saveBlobToAppData is only supported in the native app.");
	}

	const fs = await import("@tauri-apps/plugin-fs");
	const path = await import("@tauri-apps/api/path");

	const base = await path.appDataDir();
	try {
		await fs.mkdir(base, { recursive: true });
	} catch {
		// ignore
	}

	const fullPath = await path.join(base, relativePath);
	const bytes = new Uint8Array(await blob.arrayBuffer());
	await fs.writeFile(fullPath, bytes);

	return { filePath: relativePath };
}
