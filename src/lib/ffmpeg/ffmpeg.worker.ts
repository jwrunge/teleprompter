/// <reference lib="webworker" />

type UnsupportedWorkerRequest = { requestId?: string };

self.onmessage = (event: MessageEvent<UnsupportedWorkerRequest>) => {
	const msg = event.data;
	(self as unknown as DedicatedWorkerGlobalScope).postMessage({
		type: "error",
		requestId: msg?.requestId ?? "unknown",
		error: {
			message:
				"FFmpeg WASM is disabled in this build (web is WebM-only). Use the desktop full version for MP4/transcoding.",
		},
	});
};
