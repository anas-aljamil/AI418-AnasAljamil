/**
 * An address the app does not have (a mistyped or outdated link). It says so in the app's
 * language and look, and offers the way back: the role's home for a signed-in user, sign-in
 * otherwise (the start route decides). It replaces Expo Router's own English page.
 */
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/Placeholders';
import { useColumn } from '@/lib/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useColumn('narrow');
  const { state } = useAuth();
  const signedIn = state.status === 'signedIn';
  return (
    <View
      style={[
        styles.page,
        column,
        { backgroundColor: colors.bg, paddingTop: insets.top + space.lg },
      ]}
    >
      <AppBar />
      <View style={styles.middle}>
        <EmptyState title={t('not_found.title')} body={t('not_found.body')} />
        <Button
          label={t(signedIn ? 'not_found.home' : 'not_found.sign_in')}
          onPress={() => router.replace('/')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: space.md },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
