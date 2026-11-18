/**
 * What this student does from a professor's profile, counted on the device (AsyncStorage, key
 * mawjood.habits; deleted on sign-out): how often they book and how often they message. The
 * adaptive layer (nextStep.ts) uses it to put the student's usual first move first, the
 * "go-and-check" student (persona Faisal) or the "message-first" student (persona Nawaf).
 * Nothing leaves the device and nothing is sent to the server.
 */
import { useSyncExternalStore } from 'react';

import { preferenceKeys, readPreference, removePreference, writePreference } from '@/lib/storage';

export interface Habits {
  book: number;
  message: number;
}

export const NO_HABITS: Habits = { book: 0, message: 0 };

let current: Habits = NO_HABITS;
let loaded = false;
const listeners = new Set<() => void>();

function publish(next: Habits) {
  current = next;
  for (const listener of listeners) listener();
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = await readPreference(preferenceKeys.habits);
  try {
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Habits>;
      publish({ book: Number(parsed.book) || 0, message: Number(parsed.message) || 0 });
    }
  } catch {
    // Unreadable: start again from nothing.
  }
}

/** Count one move (the student tapped Book or Message on a profile, or in a tip). */
export function recordHabit(kind: keyof Habits): void {
  const next = { ...current, [kind]: current[kind] + 1 };
  publish(next);
  void writePreference(preferenceKeys.habits, JSON.stringify(next));
}

/** "Forget what you learned" in Settings. */
export function forgetHabits(): void {
  publish(NO_HABITS);
  void removePreference(preferenceKeys.habits);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void load();
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => current;

/** The counts, kept up to date while the screen is open. */
export function useHabits(): Habits {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
