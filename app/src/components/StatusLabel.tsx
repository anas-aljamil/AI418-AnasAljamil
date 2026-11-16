import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { textAlignFor } from '@/lib/direction';
import type { ProfessorStatus } from '@/api/types';
import { relativeUpdateKey, untilText } from '@/lib/format';
import { spokenList } from '@/lib/names';
import { space, type Language, type StatusKey } from '@/theme/tokens';
import { Door } from './Door';
import { Text } from './Text';

interface StatusLabelProps {
  status: StatusKey;
  /** false when the schedule says "in office" but nobody confirmed it recently. */
  confirmed?: boolean;
  /** Last manual update; null means the status comes from the schedule only. */
  updatedAt?: Date | null;
  now?: Date;
  /** Show the door before the label (rows show their own larger door). */
  withDoor?: boolean;
}

/**
 * The words for a status: the door to draw, the label, and "updated X ago" (or "from the
 * schedule"). Shared by every place that shows a status, including screen-reader labels.
 */
export function describeStatus(
  status: StatusKey,
  confirmed: boolean,
  updatedAt: Date | null | undefined,
  now: Date,
  language: Language,
  t: TFunction,
): { door: StatusKey; label: string; updated: string } {
  const unconfirmed = status === 'in_office' && !confirmed;
  const relative = updatedAt ? relativeUpdateKey(language, updatedAt, now) : null;
  return {
    door: unconfirmed ? 'unknown' : status,
    label: unconfirmed ? t('status.in_office_unconfirmed') : t(`status.${status}`),
    updated: relative ? t(relative.key, { count: relative.count }) : t('time.from_schedule'),
  };
}

/**
 * The status as a sentence that says what happens next (DESIGN.md Section 11): "In office
 * until 12:00 PM", "Away for the rest of today". `when` is the part after the label: the time
 * the status is expected to change, or for a not-confirmed status how old it is ("updated 5
 * hours ago"), since that is what a student needs to judge it. Null when the API gives no time.
 */
export function statusSentence(
  status: ProfessorStatus,
  now: Date,
  language: Language,
  t: TFunction,
): { door: StatusKey; label: string; when: string | null; sentence: string } {
  const updatedAt = status.updated_at ? new Date(status.updated_at) : null;
  const { door, label, updated } = describeStatus(
    status.status,
    status.confirmed,
    updatedAt,
    now,
    language,
    t,
  );
  const until = status.until ? new Date(status.until) : null;
  const when =
    door === 'unknown'
      ? status.status === 'in_office'
        ? updated
        : null
      : until && until > now
        ? untilText(until, t)
        : null;
  // "In office until 12:00 PM" reads as one phrase; an age is a second fact, after a comma.
  const sentence = !when
    ? label
    : door === 'unknown'
      ? spokenList([label, when], t)
      : t('status.sentence', { status: label, when });
  return { door, label, when, sentence };
}

/** Status is always icon + label + colour, with a relative "updated X ago" (CLAUDE.md Section 4). */
export function StatusLabel({
  status,
  confirmed = true,
  updatedAt,
  now = new Date(),
  withDoor = false,
}: StatusLabelProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const { door, label, updated } = describeStatus(status, confirmed, updatedAt, now, language, t);
  // Wrapped lines hug the row's end edge (left in Arabic, right in English).
  const endAlign = textAlignFor('end', language);

  return (
    <View style={styles.row} accessible accessibilityLabel={spokenList([label, updated], t)}>
      {withDoor && <Door status={door} size={20} />}
      <View style={styles.text}>
        <Text variant="label" style={{ textAlign: endAlign }}>
          {label}
        </Text>
        <Text variant="caption" color="muted" style={{ textAlign: endAlign }}>
          {updated}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  text: { alignItems: 'flex-end', flexShrink: 1 },
});
