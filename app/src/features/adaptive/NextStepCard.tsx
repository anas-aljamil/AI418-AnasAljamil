/**
 * The adaptive layer on a professor's profile (M3, intelligent layer 1 in the M2 task flow:
 * "how likely the status is right now, shown with its uncertainty"). One card under the band:
 * how sure the app is (Sure, Likely, Not sure), what to do next in one sentence, and the moves
 * that fit, best first (nextStep.ts). "Why this?" lists the reasons; "Hide" removes the card for
 * this professor until the app is opened again; Settings turns tips off for good.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Sparkles from 'lucide-react-native/icons/sparkles';

import type { ProfessorDetail } from '@/api/types';
import { Button } from '@/components/Button';
import { describeStatus } from '@/components/StatusLabel';
import { Card, Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { dateText } from '@/lib/dates';
import { clockText } from '@/lib/format';
import { professorShortName } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';
import { useHabits } from './habits';
import { nextStep, type NextStep, type StepAction } from './nextStep';

// Professors whose tip was hidden, until the app is opened again.
const hidden = new Set<number>();

interface NextStepCardProps {
  professor: ProfessorDetail;
  now: Date;
  onBook: () => void;
  onMessage: () => void;
  messagePending?: boolean;
}

export function NextStepCard({
  professor,
  now,
  onBook,
  onMessage,
  messagePending = false,
}: NextStepCardProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const habits = useHabits();
  const [why, setWhy] = useState(false);
  const [gone, setGone] = useState(hidden.has(professor.professor_id));
  if (gone) return null;

  const step = nextStep(professor, now, habits);
  const name = professorShortName(professor, language, t);
  const time = step.time ? clockText(step.time, t) : '';
  const updated = describeStatus(
    professor.status.status,
    professor.status.confirmed,
    professor.status.updated_at ? new Date(professor.status.updated_at) : null,
    now,
    language,
    t,
  ).updated;

  const headline = headlineOf(step, name, time, t, professor.status.status);
  const reasons = step.reasons.map((reason) => t(`tips.why_${reason}`, { name, updated }));

  const actionLabel = (action: StepAction) =>
    action === 'book'
      ? t('tips.action_book')
      : step.kind === 'check_first'
        ? t('tips.action_ask')
        : step.kind === 'go'
          ? t('tips.action_coming')
          : t('tips.action_message');

  return (
    <Card
      role="region"
      aria-label={t('tips.title')}
      style={{ borderColor: step.confidence === 'unsure' ? colors.status.unknown : colors.line }}
    >
      <View style={styles.head}>
        <Sparkles color={colors.primary} size={18} strokeWidth={1.75} />
        <Text variant="label" role="heading" style={styles.grow}>
          {t('tips.title')}
        </Text>
        <Pill
          label={t(`tips.confidence_${step.confidence}`)}
          tone={step.confidence === 'sure' ? 'primary' : 'muted'}
        />
      </View>
      <Text weight="semibold" accessibilityLiveRegion="polite">
        {headline}
      </Text>
      {why ? (
        <View style={styles.reasons}>
          {reasons.map((reason) => (
            <Text key={reason} variant="caption" color="muted">
              {t('tips.bullet', { reason })}
            </Text>
          ))}
        </View>
      ) : null}
      {step.actions.length > 0 ? (
        <View style={styles.actions}>
          {step.actions.map((action, index) => (
            <Button
              key={action}
              variant={index === 0 ? 'primary' : 'secondary'}
              label={actionLabel(action)}
              disabled={action === 'message' && messagePending}
              onPress={action === 'book' ? onBook : onMessage}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          variant="quiet"
          label={t(why ? 'tips.why_hide' : 'tips.why_show')}
          aria-expanded={why}
          onPress={() => setWhy(!why)}
        />
        <Button
          variant="quiet"
          label={t('tips.hide')}
          accessibilityLabel={t('tips.hide_label', { name })}
          onPress={() => {
            hidden.add(professor.professor_id);
            setGone(true);
          }}
        />
      </View>
    </Card>
  );
}

function headlineOf(
  step: NextStep,
  name: string,
  time: string,
  t: TFunction,
  status: string,
): string {
  switch (step.kind) {
    case 'go':
      return time ? t('tips.go_until', { name, time }) : t('tips.go', { name });
    case 'check_first':
      return t('tips.check_first', { name });
    case 'wait':
      return time
        ? t('tips.wait', { status: t(`status.${status}`), time })
        : t('tips.wait_now', { status: t(`status.${status}`) });
    case 'back_later':
      return t('tips.back_later', { name, time });
    case 'next_hours':
      return step.date
        ? t('tips.next_day', { date: dateText(step.date, t), time })
        : t('tips.next_today', { time });
    case 'no_hours':
      return t('tips.no_hours', { name });
  }
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
  reasons: { gap: space.xxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
});
