export type FFmpegClientOptions = {
	preferMultiThread?: boolean;
	baseURL?: string;
	onLog?: (message: string) => void;
	onProgress?: (progress: number, time?: number) => void;
};

export class FFmpegClient {
	private opts: FFmpegClientOptions;

	constructor(options: FFmpegClientOptions = {}) {
		this.opts = options;
	}

	private unsupported(): never {
		this.opts.onLog?.(
			"FFmpeg disabled (web is WebM-only). Use the desktop full version for MP4/transcoding.",
		);
		throw new Error(
			"FFmpeg is disabled in this build (web is WebM-only). Use the desktop full version for MP4/transcoding.",
		);
	}

	async init(): Promise<{ loaded: boolean; multiThread: boolean }> {
		return this.unsupported();
	}

	async writeFile(name: string, data: Uint8Array): Promise<void> {
		void name;
		void data;
		return this.unsupported();
	}

	async readFile(name: string): Promise<Uint8Array> {
		void name;
		return this.unsupported();
	}

	async deleteFile(name: string): Promise<void> {
		void name;
		return this.unsupported();
	}

	async exec(args: string[]): Promise<{ exitCode: number }> {
		void args;
		return this.unsupported();
	}

	async terminate(): Promise<void> {
		return;
	}
}
