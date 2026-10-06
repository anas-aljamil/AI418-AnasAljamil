/**
 * A time on the 15-minute schedule grid, chosen on the 12-hour clock (owner decision): an hour
 * 1-12, the minutes and AM/PM (ص/م in Arabic), all one tap each, so nobody types "13:00".
 * The value is "HH:MM" on the 24-hour clock, as the API stores it. Each chip names its field
 * ("Start, hour 9") so a screen reader can tell the start and end pickers apart.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { clockText } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Chip } from './Chip';
import { Text } from './Text';

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 15, 30, 45];

interface TimePickerProps {
  label: string;
  /** "HH:MM", 24-hour. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function TimePicker({ label, value, onChange, error }: TimePickerProps) {
  const { t } = useTranslation();
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  const pm = hours >= 12;
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const set = (h12: number, m: number, isPm: boolean) =>
    onChange(`${pad((h12 % 12) + (isPm ? 12 : 0))}:${pad(m)}`);

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text variant="label" role="heading">
          {label}
        </Text>
        <Text weight="semibold">{clockText(value, t)}</Text>
      </View>
      <View style={styles.row}>
        {(['am', 'pm'] as const).map((period) => (
          <Chip
            key={period}
            label={t(`time.${period}`)}
            accessibilityLabel={t('time_picker.period_label', {
              field: label,
              period: t(`time.${period}`),
            })}
            selected={pm === (period === 'pm')}
            onPress={() => set(hour12, minutes, period === 'pm')}
          />
        ))}
      </View>
      <View style={styles.row}>
        {HOURS.map((hour) => (
          <Chip
            key={hour}
            label={String(hour)}
            accessibilityLabel={t('time_picker.hour_label', { field: label, hour })}
            selected={hour12 === hour}
            onPress={() => set(hour, minutes, pm)}
          />
        ))}
      </View>
      <View style={styles.row}>
        {MINUTES.map((minute) => (
          <Chip
            key={minute}
            label={`:${pad(minute)}`}
            accessibilityLabel={t('time_picker.minute_label', {
              field: label,
              minute: pad(minute),
            })}
            selected={minutes === minute}
            onPress={() => set(hour12, minute, pm)}
          />
        ))}
      </View>
      {error ? <Text color="danger">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
