import { Pressable, Text } from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '@huroofi/design-system';

export function ControlButton({
  label,
  onPress,
  testID,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: touchTargets.preReader,
        minWidth: touchTargets.preReader,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? colors.primary : colors.surface,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          fontSize: typography.size.body,
          lineHeight: typography.size.body * typography.lineHeightRatio,
          color: primary ? colors.onPrimary : colors.textPrimary,
          writingDirection: 'rtl',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
