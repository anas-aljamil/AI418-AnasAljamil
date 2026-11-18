/**
 * The voice layer (M3, conversational): a microphone on student Home. The student says
 * "Is Dr. Noura in?", "Book with Dr. Khalid" or "راسل د. هدى" and gets the answer as text (and
 * aloud, unless turned off), with one button for the next move. Commands are parsed by rules
 * (commands.ts) against the professor list; the recognizer is the browser's own (useSpeech.ts).
 *
 * When the app is not sure it says so and lets the student correct it: what it heard is always
 * shown; two professors with the same score give "Which professor did you mean?"; no match gives
 * "Try again" and "Type instead"; a professor it picked can be rejected with "Not this
 * professor". Nothing happens without a tap, so a wrong guess costs one tap. The microphone is
 * hidden where the browser has no recognizer (Firefox, Expo Go) or when voice is off in Settings.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Mic from 'lucide-react-native/icons/mic';

import { useOpenConversation, useProfessorSearch } from '@/api/queries';
import type { ProfessorSummary } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Door } from '@/components/Door';
import { statusSentence } from '@/components/StatusLabel';
import { IconButton } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { recordHabit } from '@/features/adaptive/habits';
import { errorKey } from '@/lib/errors';
import { useNow } from '@/lib/hooks';
import { officeText, professorName } from '@/lib/names';
import { useSettings } from '@/settings/SettingsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';
import { parseAlternatives, type VoiceIntent } from './commands';
import { speak, useSpeech, useSpeechSupported } from './useSpeech';

interface VoiceAssistantProps {
  onBand?: boolean;
  /** "Type instead": close and put the cursor in Home's search field. */
  onTypeInstead: () => void;
}

export function VoiceAssistant({ onBand = false, onTypeInstead }: VoiceAssistantProps) {
  const { t, i18n } = useTranslation();
  const appLanguage: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const { assist } = useSettings();
  const [open, setOpen] = useState(false);
  const [listenIn, setListenIn] = useState<Language>(appLanguage);
  const speech = useSpeech();
  const supported = useSpeechSupported();

  if (!assist.voice || !supported) return null;

  const listen = (language: Language = listenIn) => {
    setListenIn(language);
    speech.start(language);
  };
  const close = () => {
    speech.reset();
    setOpen(false);
  };

  return (
    <>
      <IconButton
        label={t('voice.open')}
        onPress={() => {
          setOpen(true);
          // Started from the tap itself: browsers ask for the microphone only after a gesture.
          listen(appLanguage);
        }}
        icon={<Mic color={onBand ? colors.onBand : colors.text} size={24} strokeWidth={1.75} />}
      />
      <BottomSheet visible={open} title={t('voice.title')} onClose={close}>
        {open ? (
          <VoicePanel
            speech={speech}
            listenIn={listenIn}
            onListen={listen}
            onClose={close}
            onTypeInstead={() => {
              close();
              onTypeInstead();
            }}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}

interface VoicePanelProps {
  speech: ReturnType<typeof useSpeech>;
  listenIn: Language;
  onListen: (language?: Language) => void;
  onClose: () => void;
  onTypeInstead: () => void;
}

function VoicePanel({ speech, listenIn, onListen, onClose, onTypeInstead }: VoicePanelProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { assist } = useSettings();
  const now = useNow();
  const toast = useToast();
  const openChat = useOpenConversation();
  // Every professor (the Search tab's list), to match names against.
  const directory = useProfessorSearch({ query: '' }, language, true);
  const [picked, setPicked] = useState<ProfessorSummary | null>(null);
  const { state } = speech;

  const result = useMemo(
    () =>
      state.phase === 'heard' && directory.data
        ? parseAlternatives(state.transcripts, directory.data)
        : null,
    [state, directory.data],
  );
  const heard = state.phase === 'heard' ? (state.transcripts[0] ?? '') : '';
  const professor = picked ?? (result?.kind === 'match' ? result.professor : null);
  const intent: VoiceIntent = result && result.kind !== 'not_understood' ? result.intent : 'status';
  const answer = professor ? statusSentence(professor.status, now, language, t) : null;
  const name = professor ? professorName(professor, language, t) : '';

  // A new attempt forgets the professor chosen from the last one (the panel opens with none).
  const listen = (language?: Language) => {
    setPicked(null);
    onListen(language);
  };

  // Say the answer to "Is … in?" aloud, in the interface language.
  const spoken = professor && answer && intent === 'status' ? `${name}: ${answer.sentence}` : null;
  useEffect(() => {
    if (spoken && assist.readAloud) speak(spoken, language);
  }, [spoken, assist.readAloud, language]);

  // Close the sheet, then move on.
  const leave = (navigate: () => void) => {
    onClose();
    navigate();
  };
  const message = (target: ProfessorSummary) => {
    recordHabit('message');
    openChat.mutate(
      { professor_id: target.professor_id },
      {
        onSuccess: (conversation) =>
          leave(() => router.push(`/conversations/${conversation.conversation_id}`)),
        onError: (error) => toast(t(errorKey(error))),
      },
    );
  };

  const languageChips = (
    <View style={styles.row}>
      <Text variant="caption" color="muted">
        {t('voice.listen_in')}
      </Text>
      {(['ar', 'en'] as const).map((option) => (
        <Chip
          key={option}
          label={t(`settings.language_${option}`)}
          selected={listenIn === option}
          onPress={() => listen(option)}
        />
      ))}
    </View>
  );

  const retry = (
    <Button variant="secondary" label={t('voice.try_again')} onPress={() => listen()} />
  );
  const typeInstead = (
    <Button variant="quiet" label={t('voice.type_instead')} onPress={onTypeInstead} />
  );

  let body: React.ReactNode;
  if (state.phase === 'listening') {
    body = (
      <>
        <Text variant="title" accessibilityLiveRegion="polite">
          {t('voice.listening')}
        </Text>
        <Text color="muted">{t('voice.example')}</Text>
        <Button variant="secondary" label={t('voice.stop')} onPress={speech.reset} />
      </>
    );
  } else if (state.phase === 'error') {
    body = (
      <>
        <Text accessibilityLiveRegion="polite">{t(`voice.error_${state.error}`)}</Text>
        <View style={styles.row}>
          {state.error === 'denied' ? null : retry}
          {typeInstead}
        </View>
      </>
    );
  } else if (state.phase === 'idle') {
    body = (
      <>
        <Text color="muted">{t('voice.example')}</Text>
        <Button label={t('voice.speak')} onPress={() => listen()} />
      </>
    );
  } else if (!result) {
    body = <Text color="muted">{t('voice.matching')}</Text>;
  } else if (professor && answer) {
    body = (
      <>
        <Text variant="caption" color="muted">
          {t('voice.heard', { text: heard })}
        </Text>
        <View style={styles.answer} accessible accessibilityLiveRegion="polite">
          <Door status={answer.door} size={40} />
          <View style={styles.grow}>
            <Text variant="title">{name}</Text>
            <Text weight="semibold">{answer.sentence}</Text>
            <Text variant="caption" color="muted">
              {officeText(professor.office, t)}
            </Text>
          </View>
        </View>
        <View style={styles.row}>
          {intent === 'book' ? (
            <Button
              label={t('voice.book', { name })}
              onPress={() => {
                recordHabit('book');
                leave(() =>
                  router.push({
                    pathname: '/professors/[id]',
                    params: { id: String(professor.professor_id), book: '1' },
                  }),
                );
              }}
            />
          ) : intent === 'message' ? (
            <Button
              label={t('voice.message', { name })}
              disabled={openChat.isPending}
              onPress={() => message(professor)}
            />
          ) : (
            <Button
              label={t('voice.open_profile')}
              onPress={() => leave(() => router.push(`/professors/${professor.professor_id}`))}
            />
          )}
          <Button variant="quiet" label={t('voice.not_this')} onPress={() => listen()} />
        </View>
      </>
    );
  } else if (result.kind === 'choose') {
    body = (
      <>
        <Text variant="caption" color="muted">
          {t('voice.heard', { text: heard })}
        </Text>
        <Text variant="title" role="heading">
          {t('voice.which')}
        </Text>
        {result.options.map((option) => (
          <Button
            key={option.professor_id}
            variant="secondary"
            label={professorName(option, language, t)}
            onPress={() => setPicked(option)}
          />
        ))}
        <View style={styles.row}>
          {retry}
          {typeInstead}
        </View>
      </>
    );
  } else {
    body = (
      <>
        <Text accessibilityLiveRegion="polite">{t('voice.not_understood', { text: heard })}</Text>
        <Text color="muted">{t('voice.example')}</Text>
        <View style={styles.row}>
          {retry}
          {typeInstead}
        </View>
      </>
    );
  }

  return (
    <View style={styles.panel}>
      {languageChips}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  answer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
});
