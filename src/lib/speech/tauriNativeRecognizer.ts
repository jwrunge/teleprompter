import { isNativeShell } from "../platform/runtime";
import type { SpeechRecognizer, SpeechRecognizerEvents } from "./types";

/**
 * Placeholder backend.
 *
 * To make this real, you’ll author a Tauri plugin/command that exposes streaming
 * partial/final transcripts from iOS/Android native speech APIs.
 */
export class TauriNativeRecognizer implements SpeechRecognizer {
	readonly backend = "tauri-native" as const;

	private events: SpeechRecognizerEvents;
	private language = "en-US";

	get isSupported() {
		return isNativeShell();
	}

	constructor(events: SpeechRecognizerEvents = {}) {
		this.events = events;
	}

	setLanguage(language: string) {
		this.language = language;
	}

	async start() {
		const err = new Error(
			`Native speech backend not implemented yet (requested lang: ${this.language}).`,
		);
		this.events.onError?.(err);
		this.events.onStateChange?.("error");
		throw err;
	}

	async stop() {
		this.events.onStateChange?.("idle");
	}

	dispose() {
		// no-op
	}
}
