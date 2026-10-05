/** Professors and administrators until their screens arrive in P4: a clear notice and sign-out. */
import { StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/Placeholders';
import { Text } from '@/components/Text';
import { fullName } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function StaffScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, signOut } = useAuth();
  if (state.status !== 'signedIn') return <Redirect href="/" />;

  const leave = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <View
      style={[
        styles.page,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.lg,
        },
      ]}
    >
      <Text variant="title" style={styles.center}>
        {fullName(state.user, i18n.language === 'ar' ? 'ar' : 'en')}
      </Text>
      <Text color="muted" style={styles.center}>
        {t(`role.${state.user.role}`)}
      </Text>
      <EmptyState title={t('staff.title')} body={t('staff.body')} />
      <Button variant="secondary" label={t('profile.sign_out')} onPress={leave} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: space.md, gap: space.xs, justifyContent: 'center' },
  center: { textAlign: 'center' },
});
