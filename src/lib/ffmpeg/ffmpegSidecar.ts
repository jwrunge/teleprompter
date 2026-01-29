import { Command } from "@tauri-apps/plugin-shell";

import { isNativeShell } from "../platform/runtime";

export type FfmpegSidecarOutput = {
	code: number | null;
	stdout: string;
	stderr: string;
};

export type FfmpegSidecarOptions = {
	cwd?: string;
};

const FFMPEG_SIDECAR_NAME = "ffmpeg";

export async function runFfmpegSidecar(
	args: string[],
	options: FfmpegSidecarOptions = {},
): Promise<FfmpegSidecarOutput> {
	if (!isNativeShell()) {
		throw new Error("FFmpeg sidecar is only available in the desktop app.");
	}

	const command = Command.sidecar(FFMPEG_SIDECAR_NAME, args, {
		cwd: options.cwd,
	});

	const output = await command.execute();
	return {
		code: output.code,
		stdout: output.stdout ?? "",
		stderr: output.stderr ?? "",
	};
}
