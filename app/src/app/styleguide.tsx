/**
 * Styleguide (DESIGN.md Section 10, Foundations): every token and component in
 * Arabic and English, light and dark. Also checks the connection to the API,
 * which helps when setting up a phone (docs/run-on-phone.md).
 */
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleX from 'lucide-react-native/icons/circle-x';
import House from 'lucide-react-native/icons/house';
import LoaderCircle from 'lucide-react-native/icons/loader-circle';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Search from 'lucide-react-native/icons/search';
import UserRound from 'lucide-react-native/icons/user-round';

import type { Block, ProfessorStatus } from '@/api/types';
import { AppBar } from '@/components/AppBar';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Band, Corridor, CorridorDoor } from '@/components/Corridor';
import { DayRibbon } from '@/components/DayRibbon';
import { Door } from '@/components/Door';
import { EmptyState, SkeletonRow } from '@/components/Placeholders';
import { StatusLabel, statusSentence } from '@/components/StatusLabel';
import { Card, ListRow } from '@/components/Surfaces';
import { TabIconPill } from '@/components/tabs';
import { TallDoor } from '@/components/TallDoor';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { switchLanguage } from '@/i18n';
import { apiUrl } from '@/lib/apiUrl';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import {
  layout,
  radii,
  space,
  type Language,
  type Palette,
  type StatusKey,
  type TextVariant,
} from '@/theme/tokens';

const STATUSES: StatusKey[] = ['in_office', 'in_class', 'busy', 'away', 'unknown'];
const VARIANTS: TextVariant[] = ['display', 'heading', 'title', 'body', 'label', 'caption'];
type ColorKey = { [K in keyof Palette]: Palette[K] extends string ? K : never }[keyof Palette];
const COLOR_KEYS: ColorKey[] = [
  'bg',
  'surface',
  'text',
  'muted',
  'primary',
  'onPrimary',
  'tint',
  'line',
  'lamp',
  'danger',
  'band',
  'bandRaised',
  'onBand',
  'onBandMuted',
  'bandLine',
];
const TOPICS = ['topic_assignment', 'topic_exam_review', 'topic_advising', 'topic_other'] as const;
const minutesAgo = (n: number) => new Date(Date.now() - n * 60000);

// The corridor, sentences and ribbon are shown at one fixed moment (Monday 10:00 AM in Riyadh,
// the seed's demo moment), so the page and its screenshots do not change with the clock.
const DEMO_NOW = new Date('2026-10-05T07:00:00Z');
const sampleStatus = (
  status: ProfessorStatus['status'],
  until: string | null,
  rest: Partial<ProfessorStatus> = {},
): ProfessorStatus => ({
  status,
  confirmed: true,
  source: 'schedule',
  note: null,
  until,
  updated_at: null,
  ...rest,
});
const CORRIDOR: { name: string; status: ProfessorStatus }[] = [
  { name: 'sample.corridor_1', status: sampleStatus('in_office', '2026-10-05T09:00:00Z') },
  { name: 'sample.corridor_2', status: sampleStatus('in_class', '2026-10-05T08:00:00Z') },
  {
    name: 'sample.corridor_3',
    status: sampleStatus('in_office', '2026-10-05T08:30:00Z', {
      confirmed: false,
      updated_at: '2026-10-05T02:00:00Z',
    }),
  },
  {
    name: 'sample.corridor_4',
    status: sampleStatus('busy', '2026-10-05T07:30:00Z', { source: 'override' }),
  },
  // Riyadh midnight: an away status without a return time.
  {
    name: 'sample.corridor_5',
    status: sampleStatus('away', '2026-10-05T21:00:00Z', { source: 'override' }),
  },
];
const sampleBlock = (block_id: number, kind: Block['kind'], start: string, end: string): Block => ({
  block_id,
  kind,
  start_time: start,
  end_time: end,
  label: null,
  day_of_week: 1,
  on_date: null,
  ends_on: null,
  skipped_dates: [],
});
const DAY: Block[] = [
  sampleBlock(1, 'class', '08:00', '09:00'),
  sampleBlock(2, 'office_hours', '09:30', '12:00'),
  sampleBlock(3, 'meeting', '13:00', '14:00'),
  sampleBlock(4, 'class', '14:30', '16:00'),
];
const TABS = [
  { key: 'home', Icon: House },
  { key: 'search', Icon: Search },
  { key: 'appointments', Icon: CalendarDays },
  { key: 'messages', Icon: MessageCircle },
  { key: 'profile', Icon: UserRound },
] as const;

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
  const { width } = useWindowDimensions();
  const doorSize = width >= layout.desktopMin ? 92 : 72;
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

      <Section title={t('styleguide.corridor')}>
        <Text color="muted">{t('styleguide.corridor_hint')}</Text>
        <Band style={styles.band}>
          <AppBar onBand />
          <Corridor doorSize={doorSize}>
            {CORRIDOR.map(({ name, status }) => (
              <CorridorDoor
                key={name}
                name={t(name)}
                status={status}
                now={DEMO_NOW}
                doorSize={doorSize}
                onPress={() => undefined}
              />
            ))}
          </Corridor>
        </Band>
        <Band style={[styles.band, styles.myDoor]}>
          <TallDoor status={demoStatus} size={104} onBand />
          <View style={styles.grow}>
            <Text variant="caption" color="onBandMuted">
              {t('styleguide.my_door')}
            </Text>
            <Text variant="heading" color="onBand">
              {t(`status.${demoStatus}`)}
            </Text>
          </View>
        </Band>
      </Section>

      <Section title={t('styleguide.doors')}>
        <Text color="muted">{t('styleguide.door_hint')}</Text>
        <Card style={styles.demo}>
          <View style={styles.demoDoors}>
            <TallDoor status={demoStatus} size={96} />
            <Door
              status={demoStatus}
              size={96}
              accessibilityLabel={t('status.door', { status: t(`status.${demoStatus}`) })}
            />
          </View>
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
                <TallDoor status={status} size={56} />
                <Door status={status} size={24} />
                <Door status={status} size={16} />
              </View>
              <Text variant="label">{t(`status.${status}`)}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t('styleguide.sentences')}>
        <View>
          {CORRIDOR.map(({ name, status }) => {
            const { door, sentence } = statusSentence(status, DEMO_NOW, language, t);
            return (
              <ListRow
                key={name}
                leading={<Door status={door} size={32} />}
                title={t(name)}
                subtitle={sentence}
              />
            );
          })}
        </View>
      </Section>

      <Section title={t('styleguide.ribbon')}>
        <Text color="muted">{t('styleguide.ribbon_hint')}</Text>
        <Card>
          <DayRibbon blocks={DAY} now="10:00" />
        </Card>
        <Band style={styles.band}>
          <DayRibbon blocks={DAY} now="10:00" onBand />
        </Band>
      </Section>

      <Section title={t('styleguide.tabs')}>
        <Text color="muted">{t('styleguide.tabs_hint')}</Text>
        <View
          style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.line }]}
        >
          {TABS.map(({ key, Icon }, index) => (
            <View key={key} style={styles.tab}>
              <TabIconPill
                Icon={Icon}
                focused={index === 0}
                color={index === 0 ? colors.primary : colors.muted}
                size={24}
                rail={false}
              />
              <Text
                variant="caption"
                weight={index === 0 ? 'semibold' : 'medium'}
                color={index === 0 ? 'primary' : 'muted'}
                numberOfLines={1}
              >
                {t(`tabs.${key}`)}
              </Text>
            </View>
          ))}
        </View>
        <Band style={[styles.band, styles.rail]}>
          {TABS.map(({ key, Icon }, index) => (
            <View
              key={key}
              style={[
                styles.railItem,
                { backgroundColor: index === 0 ? colors.bandRaised : 'transparent' },
              ]}
            >
              <TabIconPill
                Icon={Icon}
                focused={index === 0}
                color={index === 0 ? colors.onBand : colors.onBandMuted}
                size={24}
                rail
              />
              <Text
                variant="label"
                weight={index === 0 ? 'semibold' : 'medium'}
                color={index === 0 ? 'onBand' : 'onBandMuted'}
              >
                {t(`tabs.${key}`)}
              </Text>
            </View>
          ))}
        </Band>
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
  demoDoors: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  band: { borderRadius: radii.card, padding: space.md, gap: space.sm },
  myDoor: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingVertical: space.xs,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  rail: { maxWidth: layout.rail, gap: space.xxs },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.sm,
    borderRadius: radii.input,
  },
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
