/**
 * Styleguide (DESIGN.md Section 10, Foundations): every token and component in
 * Arabic and English, light and dark. Also checks the connection to the API,
 * which helps when setting up a phone (docs/run-on-phone.md).
 */
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleX from 'lucide-react-native/icons/circle-x';
import LoaderCircle from 'lucide-react-native/icons/loader-circle';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Door } from '@/components/Door';
import { EmptyState, SkeletonRow } from '@/components/Placeholders';
import { StatusLabel } from '@/components/StatusLabel';
import { Card, ListRow } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { switchLanguage } from '@/i18n';
import { apiUrl } from '@/lib/apiUrl';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import {
  radii,
  space,
  type Language,
  type Palette,
  type StatusKey,
  type TextVariant,
} from '@/theme/tokens';

const STATUSES: StatusKey[] = ['in_office', 'in_class', 'busy', 'away', 'unknown'];
const VARIANTS: TextVariant[] = ['display', 'heading', 'title', 'body', 'label', 'caption'];
const COLOR_KEYS: (keyof Omit<Palette, 'status'>)[] = [
  'bg',
  'surface',
  'text',
  'muted',
  'primary',
  'onPrimary',
  'line',
  'lamp',
  'danger',
];
const TOPICS = ['topic_assignment', 'topic_exam_review', 'topic_advising', 'topic_other'] as const;
const minutesAgo = (n: number) => new Date(Date.now() - n * 60000);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function ConnectionCheck() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const url = apiUrl();
  const [state, setState] = useState<'checking' | 'reachable' | 'unreachable'>('checking');
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    fetch(`${url}/health`, { signal: controller.signal })
      .then((r) => setState(r.ok ? 'reachable' : 'unreachable'))
      .catch(() => setState('unreachable'))
      .finally(() => clearTimeout(timeout));
    return () => controller.abort();
  }, [url]);
  const Icon = state === 'reachable' ? CircleCheck : state === 'checking' ? LoaderCircle : CircleX;
  return (
    <Card>
      <Text variant="label">{t('styleguide.api_address')}</Text>
      <Text lang="en" selectable>
        {url}
      </Text>
      <View style={styles.inline}>
        <Icon
          size={20}
          color={state === 'reachable' ? colors.status.in_office : colors.muted}
          strokeWidth={1.75}
        />
        <Text variant="label">{t(`styleguide.${state}`)}</Text>
      </View>
    </Card>
  );
}

export default function Styleguide() {
  const { t, i18n } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [demoStatus, setDemoStatus] = useState<StatusKey>('in_office');
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('topic_exam_review');
  const [note, setNote] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';

  const pickStatus = (status: StatusKey) => {
    setDemoStatus(status);
    if (Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };
  const showBooked = () => {
    toast(t('sample.booked'));
    if (Platform.OS !== 'web')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      // Keeps a focused input above the keyboard on iOS (Android resizes the window).
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.page,
        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl },
      ]}
    >
      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header">
          {t('styleguide.title')}
        </Text>
        <Text color="muted">{t('styleguide.intro')}</Text>
        <Text variant="label">{t('settings.language')}</Text>
        <View style={styles.wrap}>
          {(['ar', 'en'] as const).map((lang) => (
            <Chip
              key={lang}
              label={t(`settings.language_${lang}`)}
              selected={language === lang}
              onPress={() => switchLanguage(lang)}
            />
          ))}
        </View>
        {Platform.OS !== 'web' && (
          <Text variant="caption" color="muted">
            {t('settings.direction_reload')}
          </Text>
        )}
        <Text variant="label">{t('settings.theme')}</Text>
        <View style={styles.wrap}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((option) => (
            <Chip
              key={option}
              label={t(`settings.theme_${option}`)}
              selected={preference === option}
              onPress={() => setPreference(option)}
            />
          ))}
        </View>
      </View>

      <Section title={t('styleguide.connection')}>
        <ConnectionCheck />
      </Section>

      <Section title={t('styleguide.doors')}>
        <Text color="muted">{t('styleguide.door_hint')}</Text>
        <Card style={styles.demo}>
          <Door
            status={demoStatus}
            size={96}
            accessibilityLabel={t('status.door', { status: t(`status.${demoStatus}`) })}
          />
          <View style={styles.wrap}>
            {STATUSES.map((status) => (
              <Chip
                key={status}
                label={t(`status.${status}`)}
                selected={demoStatus === status}
                onPress={() => pickStatus(status)}
              />
            ))}
          </View>
        </Card>
        <View style={styles.doorGrid}>
          {STATUSES.map((status) => (
            <View
              key={status}
              style={[
                styles.doorCell,
                { borderColor: colors.line, backgroundColor: colors.surface },
              ]}
            >
              <View style={styles.doorSizes}>
                <Door status={status} size={56} />
                <Door status={status} size={24} />
                <Door status={status} size={16} />
              </View>
              <Text variant="label">{t(`status.${status}`)}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t('styleguide.colors')}>
        <View style={styles.wrap}>
          {COLOR_KEYS.map((key) => (
            <View key={key} style={styles.swatch}>
              <View
                style={[
                  styles.chipColor,
                  { backgroundColor: colors[key], borderColor: colors.line },
                ]}
              />
              <Text variant="caption">{key}</Text>
              <Text variant="caption" color="muted" lang="en">
                {colors[key]}
              </Text>
            </View>
          ))}
          {STATUSES.slice(0, 4).map((key) => (
            <View key={key} style={styles.swatch}>
              <View
                style={[
                  styles.chipColor,
                  { backgroundColor: colors.status[key], borderColor: colors.line },
                ]}
              />
              <Text variant="caption">{t(`status.${key}`)}</Text>
              <Text variant="caption" color="muted" lang="en">
                {colors.status[key]}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t('styleguide.type')}>
        {VARIANTS.map((variant) => (
          <View key={variant}>
            <Text variant="caption" color="muted">
              {t(`styleguide.variant_${variant}`)}
            </Text>
            <Text variant={variant}>{t('sample.professor_name')}</Text>
          </View>
        ))}
      </Section>

      <Section title={t('styleguide.spacing')}>
        {Object.entries(space).map(([name, value]) => (
          <View key={name} style={styles.spaceRow}>
            <Text variant="caption" color="muted" lang="en" style={styles.spaceName}>
              {`${name} ${value}`}
            </Text>
            <View
              style={{ width: value, height: 12, backgroundColor: colors.primary, borderRadius: 2 }}
            />
          </View>
        ))}
      </Section>

      <Section title={t('styleguide.radii')}>
        <View style={styles.wrap}>
          {Object.entries(radii).map(([name, value]) => (
            <View key={name} style={styles.swatch}>
              <View
                style={[
                  styles.radiusBox,
                  { borderRadius: Math.min(value, 32), borderColor: colors.primary },
                ]}
              />
              <Text
                variant="caption"
                lang="en"
              >{`${name} ${value === radii.pill ? 'full' : value}`}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t('styleguide.buttons')}>
        <View style={styles.stack}>
          <Button label={t('sample.book_time')} onPress={showBooked} />
          <Button label={t('sample.message')} variant="secondary" />
          <Button label={t('sample.send')} variant="quiet" />
          <Button label={t('sample.cancel_appointment')} variant="danger" />
          <Button label={t('sample.book_time')} disabled />
        </View>
      </Section>

      <Section title={t('styleguide.chips')}>
        <View style={styles.wrap}>
          {TOPICS.map((key) => (
            <Chip
              key={key}
              label={t(`sample.${key}`)}
              selected={topic === key}
              onPress={() => setTopic(key)}
            />
          ))}
        </View>
      </Section>

      <Section title={t('styleguide.inputs')}>
        <TextField
          label={t('sample.note_label')}
          helper={t('sample.note_helper')}
          value={note}
          onChangeText={setNote}
          maxLength={60}
          counterLabel={(count) => t('sample.counter', { count })}
        />
        <TextField
          label={t('sample.note_label')}
          error={t('sample.note_error')}
          value={t('sample.office')}
        />
      </Section>

      <Section title={t('styleguide.rows')}>
        <View>
          <ListRow
            leading={<Door status="in_office" size={32} />}
            title={t('sample.professor_name')}
            subtitle={t('sample.department_and_office')}
            trailing={<StatusLabel status="in_office" updatedAt={minutesAgo(3)} />}
            onPress={() => undefined}
          />
          <ListRow
            leading={<Door status="unknown" size={32} />}
            title={t('sample.professor_name')}
            subtitle={t('sample.department')}
            trailing={
              <StatusLabel status="in_office" confirmed={false} updatedAt={minutesAgo(300)} />
            }
          />
          <ListRow
            leading={<Door status="away" size={32} />}
            title={t('sample.professor_name')}
            subtitle={t('sample.department')}
            trailing={<StatusLabel status="away" updatedAt={null} />}
          />
        </View>
      </Section>

      <Section title={t('styleguide.cards')}>
        <Card>
          <Text variant="caption" color="muted">
            {t('sample.next_appointment')}
          </Text>
          <Text variant="title">{t('sample.professor_name')}</Text>
          <Text>{t('sample.next_appointment_time')}</Text>
          <Text color="muted">{t('sample.office')}</Text>
        </Card>
      </Section>

      <Section title={t('styleguide.sheet')}>
        <Button
          label={t('styleguide.open_sheet')}
          variant="secondary"
          onPress={() => setSheetOpen(true)}
        />
      </Section>

      <Section title={t('styleguide.toast')}>
        <Button label={t('styleguide.show_toast')} variant="secondary" onPress={showBooked} />
      </Section>

      <Section title={t('styleguide.skeletons')}>
        <View>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </Section>

      <Section title={t('styleguide.empty')}>
        <Card>
          <EmptyState
            title={t('sample.empty_title')}
            body={t('sample.empty_body')}
            actionLabel={t('sample.empty_action')}
            onAction={() => undefined}
          />
        </Card>
      </Section>

      <BottomSheet
        visible={sheetOpen}
        title={t('sample.sheet_title')}
        onClose={() => setSheetOpen(false)}
      >
        <Text color="muted">{t('sample.sheet_body')}</Text>
        <View style={styles.wrap}>
          {TOPICS.map((key) => (
            <Chip
              key={key}
              label={t(`sample.${key}`)}
              selected={topic === key}
              onPress={() => setTopic(key)}
            />
          ))}
        </View>
        <Button
          label={t('sample.book_time')}
          block
          onPress={() => {
            setSheetOpen(false);
            showBooked();
          }}
        />
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: space.md,
    gap: space.xl,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  header: { gap: space.sm },
  section: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  stack: { gap: space.sm, alignItems: 'flex-start' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  demo: { alignItems: 'center', gap: space.md },
  doorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  doorCell: {
    flexGrow: 1,
    flexBasis: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    padding: space.sm,
    gap: space.xs,
  },
  doorSizes: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  swatch: { width: 104, gap: 2 },
  chipColor: { height: 40, borderRadius: radii.input, borderWidth: StyleSheet.hairlineWidth },
  spaceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spaceName: { width: 72 },
  radiusBox: { width: 56, height: 56, borderWidth: 2 },
});
