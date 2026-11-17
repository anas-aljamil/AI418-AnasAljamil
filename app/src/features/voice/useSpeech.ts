/**
 * The browser's own speech recognition (Web Speech API: Chrome, Edge, Safari) for the voice
 * layer, and speech synthesis to read an answer aloud. No key, no server of ours: the
 * recognizer belongs to the browser. In Expo Go (no browser) `supported` is false and the
 * microphone button is not shown.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { Language } from '@/theme/tokens';

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionEvent {
  results: ArrayLike<ArrayLike<RecognitionAlternative> & { isFinal?: boolean }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return recognitionClass() !== null;
}

/**
 * Whether this browser can listen, known after the first render: the web build is exported
 * as static pages, so the server's first render (no window) and the browser's must match.
 */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noChanges, speechSupported, () => false);
}

// Support never changes while the page is open.
const noChanges = () => () => undefined;

/** BCP 47 tags the recognizer and the voice use. */
export function speechLanguage(language: Language): string {
  return language === 'ar' ? 'ar-SA' : 'en-US';
}

/** Why listening stopped without words: shown to the person with a way on. */
export type SpeechError = 'no_speech' | 'denied' | 'network' | 'other';

function errorOf(code: string): SpeechError {
  if (code === 'no-speech' || code === 'aborted') return 'no_speech';
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied';
  if (code === 'network') return 'network';
  return 'other';
}

export type SpeechState =
  | { phase: 'idle' }
  | { phase: 'listening' }
  | { phase: 'heard'; transcripts: string[] }
  | { phase: 'error'; error: SpeechError };

/** Listen once: start() asks for the microphone, then gives up to three guesses. */
export function useSpeech() {
  const [state, setState] = useState<SpeechState>({ phase: 'idle' });
  const recognition = useRef<Recognition | null>(null);
  const gotResult = useRef(false);

  const stop = useCallback(() => {
    recognition.current?.abort();
    recognition.current = null;
  }, []);

  const start = useCallback(
    (language: Language) => {
      const Speech = recognitionClass();
      if (!Speech) return;
      stop();
      const listener = new Speech();
      listener.lang = speechLanguage(language);
      listener.interimResults = false;
      listener.continuous = false;
      listener.maxAlternatives = 3;
      gotResult.current = false;
      listener.onresult = (event) => {
        const first = event.results[0];
        const transcripts = first ? Array.from(first, (alt) => alt.transcript) : [];
        gotResult.current = true;
        setState({ phase: 'heard', transcripts });
      };
      listener.onerror = (event) => {
        gotResult.current = true;
        setState({ phase: 'error', error: errorOf(event.error) });
      };
      // Ended with nothing heard and no error (some browsers): the same as silence.
      listener.onend = () => {
        if (!gotResult.current) setState({ phase: 'error', error: 'no_speech' });
        recognition.current = null;
      };
      recognition.current = listener;
      setState({ phase: 'listening' });
      try {
        listener.start();
      } catch {
        setState({ phase: 'error', error: 'other' });
      }
    },
    [stop],
  );

  const reset = useCallback(() => {
    stop();
    setState({ phase: 'idle' });
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { state, start, reset };
}

/** Read a sentence aloud in the given language, if the browser can; anything said before stops. */
export function speak(text: string, language: Language): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage(language);
    window.speechSynthesis.speak(utterance);
  } catch {
    // No voice for this language: the answer is on the screen anyway.
  }
}
