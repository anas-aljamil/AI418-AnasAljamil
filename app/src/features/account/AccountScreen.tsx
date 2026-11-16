/**
 * Account and settings (DESIGN.md 7.9): who is signed in, language, theme, text size, which
 * in-app notifications to show, and sign-out (student Profile tab, professor and admin
 * Account tabs).
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColumn } from '@/lib/layout';
import { useAuth, useUser } from '@/auth/AuthProvider';
import { Initials } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Door } from '@/components/Door';
import { MenuPicker } from '@/components/MenuPicker';
import { Text } from '@/components/Text';
import { switchLanguage } from '@/i18n';
import { departmentName, fullName } from '@/lib/names';
import { PasswordSheet, StudySheet } from './AccountSheets';
import { TEXT_SIZES, useSettings, type TextSize } from '@/settings/SettingsProvider';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { COLOR_VISIONS, space, type ColorVision, type Language } from '@/theme/tokens';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES: Language[] = ['ar', 'en'];

export function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { colors, preference, setPreference, colorVision, setColorVision } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useColumn();
  const { signOut } = useAuth();
  const user = useUser();
  const { textSize, setTextSize, notifications, setNotifications } = useSettings();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const [sheet, setSheet] = useState<'password' | 'study' | null>(null);

  const leave = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, column, { paddingTop: insets.top + space.lg }]}
    >
      <Text variant="heading" role="heading">
        {/* Named like its tab: "Profile" for students, "Account" for professors and admins. */}
        {t(user.role === 'student' ? 'tabs.profile' : 'tabs.account')}
      </Text>

      <View style={styles.person}>
        <Initials name={fullName(user, language)} size={56} />
        <View style={styles.identity}>
          <Text variant="title">{fullName(user, language)}</Text>
          <Text color="muted">{t(`role.${user.role}`)}</Text>
          {user.professor ? (
            <Text color="muted">{departmentName(user.professor.department, language)}</Text>
          ) : null}
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
      </View>

      {/* What a person may change about their own account. */}
      <View style={styles.chips}>
        {user.student ? (
          <Button
            variant="secondary"
            label={t('account.study_edit')}
            onPress={() => setSheet('study')}
          />
        ) : null}
        <Button
          variant="secondary"
          label={t('account.change_password')}
          onPress={() => setSheet('password')}
        />
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

      {/* Colour vision (owner request 2026-11-11): a menu, normal by default; the doors below
          show the status colours it gives, each with its name. */}
      <View style={styles.section}>
        <MenuPicker
          label={t('settings.color_vision')}
          options={COLOR_VISIONS.map((vision) => ({
            value: vision,
            label: t(`settings.vision_${vision}`),
          }))}
          value={colorVision}
          onChange={(vision) => setColorVision(vision as ColorVision)}
          placeholder={t('settings.vision_normal')}
        />
        <View style={styles.preview}>
          {(['in_office', 'in_class', 'busy', 'away'] as const).map((status) => (
            <View key={status} style={styles.previewItem}>
              <Door status={status} size={32} />
              <Text variant="caption">{t(`status.${status}`)}</Text>
            </View>
          ))}
        </View>
        <Text variant="caption" color="muted">
          {t('settings.color_vision_helper')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="label" role="heading">
          {t('settings.text_size')}
        </Text>
        <View style={styles.chips}>
          {(Object.keys(TEXT_SIZES) as TextSize[]).map((size) => (
            <Chip
              key={size}
              label={t(`settings.text_${size}`)}
              selected={textSize === size}
              onPress={() => setTextSize(size)}
            />
          ))}
        </View>
        <Text variant="caption" color="muted">
          {t('settings.text_size_helper')}
        </Text>
      </View>

      {user.role !== 'admin' ? (
        <View style={styles.section}>
          <Text variant="label" role="heading">
            {t('settings.notifications')}
          </Text>
          <View style={styles.chips}>
            {(['appointments', 'messages'] as const).map((kind) => (
              <Chip
                key={kind}
                label={t(`settings.notify_${kind}`)}
                selected={notifications[kind]}
                onPress={() => setNotifications({ ...notifications, [kind]: !notifications[kind] })}
              />
            ))}
          </View>
          <Text variant="caption" color="muted">
            {t('settings.notifications_helper')}
          </Text>
        </View>
      ) : null}

      <Button variant="quiet" label={t('help.title')} onPress={() => router.push('/help')} />
      <Button variant="secondary" label={t('profile.sign_out')} onPress={leave} />
      {__DEV__ ? (
        <Button
          variant="quiet"
          label={t('profile.styleguide')}
          onPress={() => router.push('/styleguide')}
        />
      ) : null}
      <PasswordSheet visible={sheet === 'password'} onClose={() => setSheet(null)} />
      {user.student ? (
        <StudySheet
          // Opened again, it starts from the saved values.
          key={`${user.student.study_year}-${user.student.department.department_id}`}
          visible={sheet === 'study'}
          onClose={() => setSheet(null)}
          user={user}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.lg },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identity: { flex: 1, gap: space.xxs },
  section: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  previewItem: { alignItems: 'center', gap: space.xxs },
});
