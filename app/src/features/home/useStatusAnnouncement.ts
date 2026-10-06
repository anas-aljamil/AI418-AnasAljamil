/**
 * Polite screen-reader announcements when a pinned professor's status changes between polls
 * (DESIGN.md Section 5, live updates): AccessibilityInfo on Android and iOS; on the web build
 * (where React Native Web's announce is a no-op) the returned text goes in an aria-live region.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { ProfessorSummary } from '@/api/types';
import { describeStatus } from '@/components/StatusLabel';
import { professorName } from '@/lib/names';
import type { Language } from '@/theme/tokens';

const fingerprint = (p: ProfessorSummary) => `${p.status.status}|${p.status.confirmed}`;

/** "Dr. Noura is now In office" for every professor whose status changed; '' when none did. */
export function describeChanges(
  before: ProfessorSummary[] | undefined,
  after: ProfessorSummary[] | undefined,
  language: Language,
  t: TFunction,
): string {
  if (!before || !after) return '';
  const previous = new Map(before.map((p) => [p.professor_id, fingerprint(p)]));
  return after
    .filter((p) => previous.has(p.professor_id) && previous.get(p.professor_id) !== fingerprint(p))
    .map((p) => {
      const { label } = describeStatus(
        p.status.status,
        p.status.confirmed,
        null,
        new Date(),
        language,
        t,
      );
      return t('home.status_changed', { name: professorName(p, language, t), status: label });
    })
    .join('. ');
}

export function useStatusAnnouncement(professors: ProfessorSummary[] | undefined): string {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const [previous, setPrevious] = useState(professors);
  const [message, setMessage] = useState('');
  // Compare with the previous poll during render (React's "previous props" pattern).
  if (professors !== previous) {
    setPrevious(professors);
    const changes = describeChanges(previous, professors, language, t);
    if (changes) setMessage(changes);
  }
  useEffect(() => {
    if (message && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return message;
}
