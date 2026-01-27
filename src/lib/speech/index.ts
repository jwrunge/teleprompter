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

export class SpeechRecognizerMgr {
	#recognizer: SpeechRecognizer;
	#backend: string = "auto";
	#partial = "";
	#finals: string[] = [];
	#language = "en-US";
	#recState: SpeechRecognizerState = "idle";
	#lastError: string | null = null;

	isSupported = true;

	constructor() {
		this.#recognizer = this.#create(
			{
				onStateChange: (s) => {
					this.#recState = s;
				},
				onPartial: (text) => {
					this.#partial = text;
				},
				onFinal: (text) => {
					this.#finals = [text, ...this.#finals];
					this.#partial = "";
				},
				onError: (err) => {
					this.#lastError = err instanceof Error ? err.message : String(err);
				},
			},
			{ language: this.#language, interimResults: true, continuous: true },
			this.#backend as "auto" | "web" | "native",
		);

		this.#backend = this.#recognizer.backend;
		this.isSupported = this.#recognizer.isSupported;
		if (!this.isSupported) {
			this.#lastError = "Speech recognition not supported in this environment.";
		}
	}

	#create(
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

	async listen() {
		this.#lastError = null;
		if (!this.#recognizer.isSupported) return;
		this.#recognizer.setLanguage(this.#language);
		await this.#recognizer.start();
	}

	async stop() {
		await this.#recognizer.stop();
	}

	async dispose() {
		this.#recognizer.dispose();
	}
}

export * from "./types";
