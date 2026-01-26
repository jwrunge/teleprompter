import type {
	SpeechRecognizer,
	SpeechRecognizerEvents,
	SpeechRecognizerOptions,
} from "./types";

type SpeechRecognitionAlternative = {
	transcript: string;
	confidence?: number;
};

type SpeechRecognitionResult = {
	isFinal: boolean;
	length: number;
	[index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionResultList = {
	length: number;
	[index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionEvent = {
	resultIndex: number;
	results: SpeechRecognitionResultList;
};

type WebSpeechRecognition = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onstart: null | (() => void);
	onend: null | (() => void);
	onerror: null | ((ev: unknown) => void);
	onresult: null | ((ev: SpeechRecognitionEvent) => void);
	start: () => void;
	stop: () => void;
	abort: () => void;
};

declare global {
	interface Window {
		webkitSpeechRecognition?: { new (): WebSpeechRecognition };
		SpeechRecognition?: { new (): WebSpeechRecognition };
	}
}

function getCtor(): { new (): WebSpeechRecognition } | null {
	return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export class WebSpeechRecognizer implements SpeechRecognizer {
	readonly backend = "web-speech" as const;

	private recognition: WebSpeechRecognition | null;
	private events: SpeechRecognizerEvents;
	private options: Required<SpeechRecognizerOptions>;
	private currentLanguage: string;

	get isSupported() {
		return this.recognition !== null;
	}

	constructor(
		events: SpeechRecognizerEvents = {},
		options: SpeechRecognizerOptions = {},
	) {
		this.events = events;
		this.options = {
			language: options.language ?? "en-US",
			interimResults: options.interimResults ?? true,
			continuous: options.continuous ?? true,
			maxAlternatives: options.maxAlternatives ?? 1,
		};

		this.currentLanguage = this.options.language;

		const Ctor = getCtor();
		this.recognition = Ctor ? new Ctor() : null;

		if (this.recognition) {
			this.applyOptions();
			this.bindHandlers();
		}
	}

	setLanguage(language: string) {
		this.currentLanguage = language;
		if (this.recognition) {
			this.recognition.lang = language;
		}
	}

	async start() {
		if (!this.recognition) {
			const err = new Error("Web Speech API is not supported in this browser.");
			this.events.onError?.(err);
			this.events.onStateChange?.("error");
			throw err;
		}

		this.events.onStateChange?.("starting");

		try {
			this.recognition.start();
		} catch (err) {
			// Some browsers throw if start() is called while already started.
			this.events.onError?.(err);
			this.events.onStateChange?.("error");
			throw err;
		}
	}

	async stop() {
		if (!this.recognition) return;
		this.events.onStateChange?.("stopping");
		try {
			this.recognition.stop();
		} catch {
			// Ignore
		}
	}

	dispose() {
		if (!this.recognition) return;
		try {
			this.recognition.onstart = null;
			this.recognition.onend = null;
			this.recognition.onerror = null;
			this.recognition.onresult = null;
			this.recognition.abort();
		} catch {
			// Ignore
		}
		this.recognition = null;
	}

	private applyOptions() {
		if (!this.recognition) return;
		this.recognition.lang = this.currentLanguage;
		this.recognition.continuous = this.options.continuous;
		this.recognition.interimResults = this.options.interimResults;
		this.recognition.maxAlternatives = this.options.maxAlternatives;
	}

	private bindHandlers() {
		if (!this.recognition) return;

		this.recognition.onstart = () => {
			this.events.onStateChange?.("listening");
		};

		this.recognition.onend = () => {
			// Some implementations auto-end frequently; keep UI sane.
			this.events.onStateChange?.("idle");
		};

		this.recognition.onerror = (ev) => {
			this.events.onError?.(ev);
			this.events.onStateChange?.("error");
		};

		this.recognition.onresult = (ev: SpeechRecognitionEvent) => {
			let interim = "";
			let final = "";

			for (let i = ev.resultIndex; i < ev.results.length; i++) {
				const result = ev.results[i];
				const text = result[0]?.transcript ?? "";
				if (result.isFinal) final += text;
				else interim += text;
			}

			if (interim.trim()) this.events.onPartial?.(interim.trim());
			if (final.trim()) this.events.onFinal?.(final.trim());
		};
	}
}
