/**
 * The app's name beside its door logo, at the top of each role's first screen (student Home,
 * professor My status, admin Overview), so the app is recognisable at a glance (owner request
 * 2026-11-11). Anything passed in (the notification bell) sits at the end edge.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { space, touchTarget } from '@/theme/tokens';
import { Door } from './Door';
import { Text } from './Text';

export function AppBar({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Door status="in_office" size={28} />
        <Text weight="semibold" color="primary">
          {t('app.name')}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
