/**
 * Voice commands (M3 conversational layer): turns what the speech recognizer heard into one of
 * three requests about one professor, with no model and no network beyond the browser's own
 * recognizer. Rules, in order:
 *
 * 1. Normalize: lower case, no Arabic diacritics or tatweel, one alef, teh marbuta as heh, alef
 *    maksura as yeh (the same folding the API does for search), punctuation to spaces, and the
 *    "al-"/"ال" article dropped from each word.
 * 2. Intent: words like "book", "appointment", "احجز", "موعد" mean book; "message", "text",
 *    "راسل", "رسالة" mean message; anything else asks whether the professor is in.
 * 3. Professor: every word of the professor's Arabic and English names is compared with the
 *    words heard (exact, or one letter off for words of four letters or more, because the
 *    recognizer often writes "Nora" for "Noura"). The best score wins when it is clearly the
 *    best; a tie asks "Did you mean …?"; nothing at all says what was heard and offers a retry.
 *
 * The recognizer gives several guesses; parseAlternatives uses the first one that names a
 * professor.
 */
import type { ProfessorSummary } from '@/api/types';

export type VoiceIntent = 'status' | 'book' | 'message';

export type VoiceResult =
  | { kind: 'match'; intent: VoiceIntent; professor: ProfessorSummary; heard: string }
  | { kind: 'choose'; intent: VoiceIntent; options: ProfessorSummary[]; heard: string }
  | { kind: 'not_understood'; heard: string };

/** Fold Arabic letter variants and drop marks so spoken and stored names compare equal. */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // diacritics, superscript alef, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The words of a normalized text, without the article ("al", "ال", "لل"). */
export function words(text: string): string[] {
  return normalizeSpeech(text)
    .split(' ')
    .filter((word) => word && word !== 'al' && word !== 'el')
    .map((word) => {
      if (word.length > 3 && word.startsWith('ال')) return word.slice(2);
      if (word.length > 3 && word.startsWith('لل')) return word.slice(2);
      return word;
    });
}

// Titles and filler that are never part of a name.
const IGNORED = new Set([
  'dr',
  'doctor',
  'prof',
  'professor',
  'mr',
  'ms',
  'mrs',
  'eng',
  'دكتور',
  'دكتوره',
  'د',
  'استاذ',
  'استاذه',
  'بروفيسور',
  'مهندس',
  'مهندسه',
]);

const BOOK_WORDS = [
  'book',
  'booking',
  'appointment',
  'reserve',
  'schedule',
  'meeting',
  'احجز',
  'حجز',
  'احجزلي',
  'موعد',
  'ميعاد',
];
const MESSAGE_WORDS = [
  'message',
  'text',
  'write',
  'chat',
  'send',
  'راسل',
  'رساله',
  'ارسل',
  'اكتب',
  'محادثه',
  'كلم',
];

export function intentOf(heard: string[]): VoiceIntent {
  if (heard.some((word) => BOOK_WORDS.includes(word))) return 'book';
  if (heard.some((word) => MESSAGE_WORDS.includes(word))) return 'message';
  return 'status';
}

/** Levenshtein distance, stopped early once it passes `limit`. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length]!;
}

/** How well the heard words name this professor: 1 per name word heard, 0.8 if one letter off. */
export function nameScore(heard: string[], professor: ProfessorSummary): number {
  const nameWords = [
    ...new Set([...words(professor.full_name_ar), ...words(professor.full_name_en)]),
  ].filter((word) => word.length >= 2 && !IGNORED.has(word));
  const candidates = heard.filter((word) => !IGNORED.has(word));
  let score = 0;
  for (const name of nameWords) {
    if (candidates.includes(name)) score += 1;
    else if (name.length >= 4 && candidates.some((word) => distance(word, name, 1) <= 1)) {
      score += 0.8;
    }
  }
  return score;
}

/** One guess from the recognizer against the professor list. */
export function parseCommand(transcript: string, professors: ProfessorSummary[]): VoiceResult {
  const heard = words(transcript);
  const intent = intentOf(heard);
  const scored = professors
    .map((professor) => ({ professor, score: nameScore(heard, professor) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return { kind: 'not_understood', heard: transcript };
  const tied = scored.filter((entry) => entry.score === best.score);
  if (tied.length === 1)
    return { kind: 'match', intent, professor: best.professor, heard: transcript };
  return {
    kind: 'choose',
    intent,
    options: tied.slice(0, 3).map((entry) => entry.professor),
    heard: transcript,
  };
}

/** The recognizer's guesses, best first: the first that names exactly one professor wins. */
export function parseAlternatives(
  transcripts: string[],
  professors: ProfessorSummary[],
): VoiceResult {
  const results = transcripts
    .filter((text) => text.trim())
    .map((text) => parseCommand(text, professors));
  return (
    results.find((result) => result.kind === 'match') ??
    results.find((result) => result.kind === 'choose') ??
    results[0] ?? { kind: 'not_understood', heard: transcripts[0] ?? '' }
  );
}
