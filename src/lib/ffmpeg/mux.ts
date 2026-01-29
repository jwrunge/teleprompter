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
	void options;
	throw new Error(
		"FFmpeg is disabled in this build (web is WebM-only). Use the desktop full version for muxing/transcoding.",
	);
}
