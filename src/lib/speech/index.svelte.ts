import { isNativeShell } from "../platform/runtime";
import { TauriNativeRecognizer } from "./tauriNativeRecognizer";
import type {
	SpeechRecognizer,
	SpeechRecognizerEvents,
	SpeechRecognizerOptions,
	SpeechRecognizerState,
} from "./types";
import { WebSpeechRecognizer } from "./webSpeechRecognizer";

export class SpeechRecognizerMgr {
	#recognizer: SpeechRecognizer;

	finals: string[] = [];
	partial = "";
	lastError: string | null = null;
	state: SpeechRecognizerState = "idle";
	language = $state("en-US");
	isSupported = true;

	constructor(lang?: string) {
		const langValue = lang ?? navigator.language ?? "en-US";
		this.language = langValue;

		this.#recognizer = this.#create(
			{
				onStateChange: (s) => {
					this.state = s;
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
			{ language: langValue, interimResults: true, continuous: true },
		);

		this.isSupported = this.#recognizer.isSupported;
		if (!this.isSupported) {
			this.lastError = "Speech recognition not supported in this environment.";
		}
	}

	#create(
		events: SpeechRecognizerEvents,
		options: SpeechRecognizerOptions = {},
	): SpeechRecognizer {
		if (isNativeShell()) {
			const recognizer = new TauriNativeRecognizer(events);
			recognizer.setLanguage(options.language ?? "en-US");
			return recognizer;
		} else {
			return new WebSpeechRecognizer(events, options);
		}
	}

	async listen() {
		this.lastError = null;
		if (!this.#recognizer.isSupported) return;
		this.#recognizer.setLanguage(this.language);
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
