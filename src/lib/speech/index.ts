import { Capacitor } from "@capacitor/core";
import { CapacitorNativeRecognizer } from "./capacitorNativeRecognizer";
import type {
	SpeechRecognizer,
	SpeechRecognizerEvents,
	SpeechRecognizerOptions,
	SpeechRecognizerState,
} from "./types";
import { WebSpeechRecognizer } from "./webSpeechRecognizer";

export type SpeechBackendPreference = "auto" | "web" | "native";

export function createSpeechRecognizer(
	events: SpeechRecognizerEvents,
	options: SpeechRecognizerOptions = {},
	preference: SpeechBackendPreference = "auto",
): SpeechRecognizer {
	if (Capacitor.isNativePlatform() || preference === "native") {
		const recognizer = new CapacitorNativeRecognizer(events);
		recognizer.setLanguage(options.language ?? "en-US");
		return recognizer;
	} else {
		return new WebSpeechRecognizer(events, options);
	}
}

export class SpeechRecognizerMgr {
	#recognizer: SpeechRecognizer | null = null;
	isSupported = true;
	recState: SpeechRecognizerState = "idle";
	backend: string = "auto";
	language = "en-US";
	partial = "";
	finals: string[] = [];
	lastError: string | null = null;

	constructor() {}

	ensureRecognizer() {
		if (this.#recognizer) return;

		this.#recognizer = createSpeechRecognizer(
			{
				onStateChange: (s) => {
					this.recState = s;
				},
				onPartial: (text) => {
					this.partial = text;
				},
				onFinal: (text) => {
					this.finals = [text, ...this.finals];
					this.partial = "";
				},
				onError: (err) => {
					this.lastError = err instanceof Error ? err.message : String(err);
				},
			},
			{ language: this.language, interimResults: true, continuous: true },
			this.backend as "auto" | "web" | "native",
		);

		this.backend = this.#recognizer.backend;
		this.isSupported = this.#recognizer.isSupported;
		if (!this.isSupported) {
			this.lastError = "Speech recognition not supported in this environment.";
		}
	}

	async startListening() {
		this.lastError = null;
		this.ensureRecognizer();
		if (!this.#recognizer || !this.#recognizer.isSupported) return;
		this.#recognizer.setLanguage(this.language);
		await this.#recognizer.start();
	}

	async stopListening() {
		await this.#recognizer?.stop();
	}
}

export * from "./types";
