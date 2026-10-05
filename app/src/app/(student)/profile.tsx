/** Profile: who is signed in, language, theme and sign-out. Fuller settings arrive in P5. */
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth, useUser } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Text } from '@/components/Text';
import { switchLanguage } from '@/i18n';
import { departmentName, fullName } from '@/lib/names';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES: Language[] = ['ar', 'en'];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const user = useUser();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';

  const leave = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
    >
      <Text variant="heading" role="heading">
        {t('profile.title')}
      </Text>

      <View style={styles.identity}>
        <Text variant="title">{fullName(user, language)}</Text>
        <Text color="muted">{t(`role.${user.role}`)}</Text>
        {user.student ? (
          <Text color="muted">
            {t('profile.student_line', {
              department: departmentName(user.student.department, language),
              year: user.student.study_year,
            })}
          </Text>
        ) : null}
        <Text color="muted">{user.email}</Text>
      </View>

      <View style={styles.section}>
        <Text variant="label" role="heading">
          {t('settings.language')}
        </Text>
        <View style={styles.chips}>
          {LANGUAGES.map((option) => (
            <Chip
              key={option}
              label={t(`settings.language_${option}`)}
              selected={language === option}
              onPress={() => switchLanguage(option)}
            />
          ))}
        </View>
        <Text variant="caption" color="muted">
          {t('settings.direction_reload')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="label" role="heading">
          {t('settings.theme')}
        </Text>
        <View style={styles.chips}>
          {THEMES.map((option) => (
            <Chip
              key={option}
              label={t(`settings.theme_${option}`)}
              selected={preference === option}
              onPress={() => setPreference(option)}
            />
          ))}
        </View>
      </View>

      <Button variant="secondary" label={t('profile.sign_out')} onPress={leave} />
      {__DEV__ ? (
        <Button
          variant="quiet"
          label={t('profile.styleguide')}
          onPress={() => router.push('/styleguide')}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.lg },
  identity: { gap: space.xxs },
  section: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
