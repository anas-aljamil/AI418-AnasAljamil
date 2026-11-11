/**
 * First launch: choose العربية or English before anything else (DESIGN.md 7.1).
 * The device language is preselected but not applied until "Continue". The screen speaks
 * both languages because no choice has been made yet; the selected language's text is shown
 * in that language's font and direction.
 */
import { useState } from 'react';
import { I18nManager, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Door } from '@/components/Door';
import { Text } from '@/components/Text';
import { deviceLanguage, switchLanguage } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget, type Language } from '@/theme/tokens';

const OPTIONS: { language: Language; name: string }[] = [
  { language: 'ar', name: 'العربية' },
  { language: 'en', name: 'English' },
];

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Language>(deviceLanguage);
  const [saving, setSaving] = useState(false);
  const inSelected = { lng: selected };
  const flipsDirection = Platform.OS !== 'web' && I18nManager.isRTL !== (selected === 'ar');

  const confirm = async () => {
    setSaving(true);
    // On native a direction change reloads the app, which then opens on sign-in.
    await switchLanguage(selected);
    router.replace('/');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.page,
        { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.lg },
      ]}
    >
      <View style={styles.titles}>
        <Door status="in_office" size={56} />
        <Text variant="display" lang="ar" role="heading" style={styles.center}>
          {t('language.title', { lng: 'ar' })}
        </Text>
        <Text variant="title" lang="en" color="muted" style={styles.center}>
          {t('language.title', { lng: 'en' })}
        </Text>
      </View>

      <View role="radiogroup" style={styles.options}>
        {OPTIONS.map(({ language, name }) => {
          const checked = selected === language;
          return (
            <Pressable
              key={language}
              role="radio"
              aria-checked={checked}
              accessibilityLabel={name}
              onPress={() => setSelected(language)}
              style={[
                styles.option,
                {
                  borderColor: checked ? colors.primary : colors.line,
                  borderWidth: checked ? 2 : 1,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <View
                style={[styles.radio, { borderColor: checked ? colors.primary : colors.muted }]}
              >
                {checked ? (
                  <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                ) : null}
              </View>
              <Text variant="title" lang={language} style={styles.optionLabel}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text variant="caption" color="muted" lang={selected} style={styles.center}>
          {flipsDirection
            ? t('settings.direction_reload', inSelected)
            : t('language.hint', inSelected)}
        </Text>
        <Button
          label={t('language.continue', inSelected)}
          onPress={confirm}
          disabled={saving}
          block
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: space.md, gap: space.xl, justifyContent: 'center' },
  titles: { alignItems: 'center', gap: space.xs },
  center: { textAlign: 'center' },
  options: { gap: space.sm },
  option: {
    minHeight: touchTarget + space.md,
    borderRadius: radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: radii.pill },
  optionLabel: { flex: 1 },
  footer: { gap: space.sm },
});
