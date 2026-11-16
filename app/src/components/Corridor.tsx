/**
 * The corridor (DESIGN.md Section 11): a navy band with a row of tall doors, one per professor.
 * A lit door means the professor is in, so the answer is seen before a word is read. Under
 * each door sit the name and the status sentence, the only centred text in the app. The row
 * scrolls sideways when the doors do not fit; one floor line runs under all of them.
 */
import { Pressable, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ProfessorStatus } from '@/api/types';
import { spokenList } from '@/lib/names';
import { useTextFactor } from '@/settings/SettingsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space } from '@/theme/tokens';
import { statusSentence } from './StatusLabel';
import { TallDoor } from './TallDoor';
import { Text } from './Text';

/** The navy ground of the corridor; also the top of the professor's own status screen. */
export function Band({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.band }, style]} {...rest} />;
}

// The floor sits at 80 of the door's 96 grid rows; the door is one and a half times its width.
const FLOOR = (80 / 96) * 1.5;
const FLOOR_LINE = 2;
// Room beside each door for a name of two short words; grows with the text size.
const CAPTION_ROOM = 36;

interface CorridorProps {
  /** Door width: 72 on phones, 92 on desktop. */
  doorSize?: number;
  /** The band's side padding: the row then scrolls to the band's edges, not to the padding. */
  bleed?: number;
  children: React.ReactNode;
}

export function Corridor({ doorSize = 72, bleed = 0, children }: CorridorProps) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -bleed }}
      contentContainerStyle={{ paddingHorizontal: bleed }}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.floor,
            { top: doorSize * FLOOR - FLOOR_LINE / 2, backgroundColor: colors.bandLine },
          ]}
        />
        {children}
      </View>
    </ScrollView>
  );
}

interface CorridorDoorProps {
  /** The professor's short name ("Dr. Noura"). */
  name: string;
  status: ProfessorStatus;
  now?: Date;
  doorSize?: number;
  onPress?: () => void;
}

export function CorridorDoor({
  name,
  status,
  now = new Date(),
  doorSize = 72,
  onPress,
}: CorridorDoorProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const textFactor = useTextFactor();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const { door, label, when } = statusSentence(status, now, language, t);
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={spokenList([name, label, when], t)}
      style={({ pressed }) => [
        styles.door,
        {
          width: doorSize + CAPTION_ROOM * textFactor,
          backgroundColor: pressed ? colors.bandRaised : 'transparent',
        },
      ]}
    >
      <TallDoor status={door} size={doorSize} onBand floor={false} />
      <Text
        variant="label"
        weight="semibold"
        color="onBand"
        numberOfLines={2}
        style={styles.center}
      >
        {name}
      </Text>
      <Text
        variant="caption"
        weight="medium"
        numberOfLines={3}
        style={[styles.center, { color: colors.bandStatusText[door] }]}
      >
        {label}
      </Text>
      {when ? (
        <Text variant="caption" color="onBandMuted" numberOfLines={2} style={styles.center}>
          {when}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxs },
  floor: { position: 'absolute', left: 0, right: 0, height: FLOOR_LINE, borderRadius: 1 },
  door: { alignItems: 'center', borderRadius: radii.input, paddingBottom: space.xs },
  center: { textAlign: 'center' },
});
