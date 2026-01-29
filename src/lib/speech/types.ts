export type SpeechRecognizerState =
	| "idle"
	| "starting"
	| "listening"
	| "stopping"
	| "error";

export type SpeechSegment = {
	text: string;
	isFinal: boolean;
	timestampMs: number;
};

export type SpeechRecognizerOptions = {
	language?: string;
	interimResults?: boolean;
	continuous?: boolean;
	maxAlternatives?: number;
};

export type SpeechRecognizerEvents = {
	onStateChange?: (state: SpeechRecognizerState) => void;
	onPartial?: (text: string) => void;
	onFinal?: (text: string) => void;
	onError?: (error: unknown) => void;
};

export interface SpeechRecognizer {
	readonly backend: "web-speech" | "tauri-native";
	readonly isSupported: boolean;

	start(): Promise<void>;
	stop(): Promise<void>;
	dispose(): void;

	setLanguage(language: string): void;
}
