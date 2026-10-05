import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { relativeUpdateKey } from '@/lib/format';
import { space, type StatusKey } from '@/theme/tokens';
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
  const shown: StatusKey = status === 'in_office' && !confirmed ? 'unknown' : status;
  const label =
    status === 'in_office' && !confirmed
      ? t('status.in_office_unconfirmed')
      : t(`status.${status}`);
  const updated = updatedAt ? relativeUpdateKey(language, updatedAt, now) : null;
  // Wrapped lines hug the row's end edge (left in Arabic, right in English).
  const endAlign = language === 'ar' ? 'left' : 'right';

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={updated ? `${label}, ${t(updated.key, { count: updated.count })}` : label}
    >
      {withDoor && <Door status={shown} size={20} />}
      <View style={styles.text}>
        <Text variant="label" style={{ textAlign: endAlign }}>
          {label}
        </Text>
        <Text variant="caption" color="muted" style={{ textAlign: endAlign }}>
          {updated ? t(updated.key, { count: updated.count }) : t('time.from_schedule')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  text: { alignItems: 'flex-end', flexShrink: 1 },
});
