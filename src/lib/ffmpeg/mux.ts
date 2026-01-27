import { FFmpegClient } from "./ffmpegClient";

export type MuxResult = {
	blob: Blob;
	mimeType: string;
	fileName: string;
};

export async function muxWebmAv(options: {
	video: Blob;
	audio: Blob;
	fileName?: string;
	onLog?: (m: string) => void;
	onProgress?: (p: number, t?: number) => void;
}): Promise<MuxResult> {
	const client = new FFmpegClient({
		onLog: options.onLog,
		onProgress: options.onProgress,
	});
	try {
		await client.init();

		const videoBytes = new Uint8Array(await options.video.arrayBuffer());
		const audioBytes = new Uint8Array(await options.audio.arrayBuffer());

		await client.writeFile("video.webm", videoBytes);
		await client.writeFile("audio.webm", audioBytes);

		// Fast mux when codecs already match container constraints.
		await client.exec([
			"-i",
			"video.webm",
			"-i",
			"audio.webm",
			"-c",
			"copy",
			"out.webm",
		]);

		const out = await client.readFile("out.webm");
		const ab = new ArrayBuffer(out.byteLength);
		new Uint8Array(ab).set(out);
		const blob = new Blob([ab], { type: "video/webm" });
		return {
			blob,
			mimeType: "video/webm",
			fileName: options.fileName ?? "output.webm",
		};
	} finally {
		await client.terminate();
	}
}
