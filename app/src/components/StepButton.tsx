import { Pressable, StyleSheet } from 'react-native';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';

import { useTheme } from '@/theme/ThemeProvider';
import { touchTarget } from '@/theme/tokens';

interface StepButtonProps {
  /** What the tap does, for example "5 minutes shorter". */
  label: string;
  icon: 'minus' | 'plus';
  disabled: boolean;
  onPress: () => void;
}

/** A round 48 px button that makes a length one step shorter or longer. */
export function StepButton({ label, icon, disabled, onPress }: StepButtonProps) {
  const { colors } = useTheme();
  const Icon = icon === 'minus' ? Minus : Plus;
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        {
          borderColor: colors.line,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon color={colors.text} size={22} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  step: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
