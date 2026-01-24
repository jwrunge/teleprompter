import { Capacitor } from '@capacitor/core'
import type { SpeechRecognizer, SpeechRecognizerEvents, SpeechRecognizerOptions } from './types'
import { CapacitorNativeRecognizer } from './capacitorNativeRecognizer'
import { WebSpeechRecognizer } from './webSpeechRecognizer'

export type SpeechBackendPreference = 'auto' | 'web' | 'native'

export function createSpeechRecognizer(
  events: SpeechRecognizerEvents,
  options: SpeechRecognizerOptions = {},
  preference: SpeechBackendPreference = 'auto'
): SpeechRecognizer {
  const isNative = Capacitor.isNativePlatform()

  if (preference === 'native') {
    const recognizer = new CapacitorNativeRecognizer(events)
    recognizer.setLanguage(options.language ?? 'en-US')
    return recognizer
  }

  if (preference === 'web') {
    const recognizer = new WebSpeechRecognizer(events, options)
    return recognizer
  }

  // auto
  if (isNative) {
    const recognizer = new CapacitorNativeRecognizer(events)
    recognizer.setLanguage(options.language ?? 'en-US')
    return recognizer
  }

  return new WebSpeechRecognizer(events, options)
}

export * from './types'
