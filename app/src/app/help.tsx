/**
 * Help and contact (owner request 2026-11-16: "a contact-us button"). Open to everyone, signed
 * in or not: what Mawjood is, the questions people ask first, and how to reach the
 * administrator: a form that stores the message for them (ContactForm, S4), and, when the build
 * sets EXPO_PUBLIC_SUPPORT_EMAIL, also a link that opens the visitor's own mail app. Mawjood
 * sends no email itself (CLAUDE.md Section 3).
 */
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Mail from 'lucide-react-native/icons/mail';

import { Button } from '@/components/Button';
import { ContactForm } from '@/features/account/ContactForm';
import { IconButton } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { useColumn } from '@/lib/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const QUESTIONS = [1, 2, 3, 4, 5, 6];
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export default function HelpScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useColumn();
  // Icons are drawings: layout direction moves them but never mirrors them.
  const flip = i18n.language === 'ar';
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
        <IconButton
          label={t('prof.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          icon={
            <View style={flip ? styles.flipped : undefined}>
              <ChevronLeft color={colors.text} size={26} strokeWidth={1.75} />
            </View>
          }
        />
        <Text variant="heading" role="heading" style={styles.grow}>
          {t('help.title')}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.page, column, { paddingBottom: insets.bottom + space.xl }]}
      >
        <View style={styles.section}>
          <Text variant="title" role="heading">
            {t('help.about_title')}
          </Text>
          <Text>{t('help.about_body')}</Text>
        </View>

        <View style={styles.section}>
          <Text variant="title" role="heading">
            {t('help.faq_title')}
          </Text>
          {QUESTIONS.map((n) => (
            <View key={n} style={[styles.question, { borderTopColor: colors.line }]}>
              <Text weight="semibold">{t(`help.q${n}`)}</Text>
              <Text color="muted">{t(`help.a${n}`)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text variant="title" role="heading">
            {t('help.contact_title')}
          </Text>
          <Text>{t('help.contact_form_body')}</Text>
          <ContactForm />
          {SUPPORT_EMAIL ? (
            <View style={styles.start}>
              <Text color="muted">{t('help.contact_body')}</Text>
              <Button
                label={t('help.contact_email', { email: SUPPORT_EMAIL })}
                icon={<Mail color={colors.onPrimary} size={20} strokeWidth={1.75} />}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined)}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  flipped: { transform: [{ scaleX: -1 }] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
  },
  page: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.xl },
  section: { gap: space.sm },
  question: { gap: space.xxs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  start: { alignItems: 'flex-start' },
});
