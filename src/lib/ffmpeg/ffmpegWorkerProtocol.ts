export type SharedBytes = {
	kind: "shared";
	buffer: SharedArrayBuffer;
	byteLength: number;
};

export type TransferBytes = {
	kind: "transfer";
	buffer: ArrayBuffer;
	byteLength: number;
};

export type BytesPayload = SharedBytes | TransferBytes;

export type FFmpegInitRequest = {
	type: "init";
	requestId: string;
	preferMultiThread?: boolean;
	baseURL?: string;
};

export type FFmpegWriteFileRequest = {
	type: "writeFile";
	requestId: string;
	name: string;
	data: BytesPayload;
};

export type FFmpegReadFileRequest = {
	type: "readFile";
	requestId: string;
	name: string;
};

export type FFmpegDeleteFileRequest = {
	type: "deleteFile";
	requestId: string;
	name: string;
};

export type FFmpegExecRequest = {
	type: "exec";
	requestId: string;
	args: string[];
};

export type FFmpegTerminateRequest = {
	type: "terminate";
	requestId: string;
};

export type FFmpegWorkerRequest =
	| FFmpegInitRequest
	| FFmpegWriteFileRequest
	| FFmpegReadFileRequest
	| FFmpegDeleteFileRequest
	| FFmpegExecRequest
	| FFmpegTerminateRequest;

export type FFmpegOkResponse = {
	type: "ok";
	requestId: string;
	result?: unknown;
};

export type FFmpegErrorResponse = {
	type: "error";
	requestId: string;
	error: { message: string; stack?: string };
};

export type FFmpegReadFileResponse = {
	type: "readFileResult";
	requestId: string;
	name: string;
	data: ArrayBuffer;
};

export type FFmpegLogEvent = {
	type: "log";
	message: string;
};

export type FFmpegProgressEvent = {
	type: "progress";
	progress: number;
	time?: number;
};

export type FFmpegWorkerResponse =
	| FFmpegOkResponse
	| FFmpegErrorResponse
	| FFmpegReadFileResponse
	| FFmpegLogEvent
	| FFmpegProgressEvent;

export function canUseSharedArrayBuffer(): boolean {
	return (
		typeof SharedArrayBuffer !== "undefined" &&
		(globalThis as any).crossOriginIsolated === true
	);
}
