import { Capacitor } from '@capacitor/core'
import type { SpeechRecognizer, SpeechRecognizerEvents } from './types'

/**
 * Placeholder backend.
 *
 * To make this real, you’ll install/author a Capacitor plugin that exposes streaming
 * partial/final transcripts from iOS/Android native speech APIs.
 */
export class CapacitorNativeRecognizer implements SpeechRecognizer {
  readonly backend = 'capacitor-native' as const

  private events: SpeechRecognizerEvents
  private language = 'en-US'

  get isSupported() {
    return Capacitor.isNativePlatform()
  }

  constructor(events: SpeechRecognizerEvents = {}) {
    this.events = events
  }

  setLanguage(language: string) {
    this.language = language
  }

  async start() {
    const err = new Error(
      `Native speech backend not implemented yet (requested lang: ${this.language}).`
    )
    this.events.onError?.(err)
    this.events.onStateChange?.('error')
    throw err
  }

  async stop() {
    this.events.onStateChange?.('idle')
  }

  dispose() {
    // no-op
  }
}
