import { isNativeShell } from "../platform/runtime";
import { runFfmpegSidecar } from "./ffmpegSidecar";

export type FfmpegExportResult = {
	filePath: string;
};

export async function exportRecordingToMp4(
	relativeInputPath: string,
	outputFileName?: string,
): Promise<FfmpegExportResult> {
	if (!isNativeShell()) {
		throw new Error("FFmpeg export is only available in the desktop app.");
	}

	const fs = await import("@tauri-apps/plugin-fs");
	const path = await import("@tauri-apps/api/path");

	const baseDir = await path.appDataDir();
	const inputFullPath = await path.join(baseDir, relativeInputPath);

	const baseName = relativeInputPath.replace(/\.[^.]+$/, "");
	const outputRelative = outputFileName
		? outputFileName.endsWith(".mp4")
			? outputFileName
			: `${outputFileName}.mp4`
		: `${baseName}.mp4`;

	const outputFullPath = await path.join(baseDir, outputRelative);
	const outputDir = await path.dirname(outputFullPath);
	try {
		await fs.mkdir(outputDir, { recursive: true });
	} catch {
		// ignore
	}

	const result = await runFfmpegSidecar([
		"-y",
		"-i",
		inputFullPath,
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-c:a",
		"aac",
		"-movflags",
		"+faststart",
		outputFullPath,
	]);

	if (result.code !== 0) {
		throw new Error(result.stderr || "FFmpeg export failed.");
	}

	return { filePath: outputRelative };
}
