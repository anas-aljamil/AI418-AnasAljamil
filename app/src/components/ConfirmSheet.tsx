/**
 * Confirmation for destructive actions (cancel an appointment, delete a row). A bottom sheet
 * rather than a system alert so it looks the same everywhere and works on the web build,
 * where React Native's Alert does nothing.
 */
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Text } from './Text';
import { space } from '@/theme/tokens';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy,
}: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onCancel}>
      <Text>{body}</Text>
      <View style={styles.actions}>
        <Button variant="danger" label={confirmLabel} onPress={onConfirm} disabled={busy} block />
        <Button variant="secondary" label={cancelLabel} onPress={onCancel} block />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ actions: { gap: space.sm } });
