import { StyleSheet } from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '@huroofi/design-system';

/**
 * RTL is applied explicitly with `direction: 'rtl'` on the root, so layout is right-to-left
 * on first launch without relying on I18nManager.forceRTL (which needs an app reload).
 */
export const layout = StyleSheet.create({
  screen: {
    flex: 1,
    direction: 'rtl',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: typography.size.display,
    lineHeight: typography.size.display * typography.lineHeightRatio,
    color: colors.textPrimary,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  body: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeightRatio,
    color: colors.textSecondary,
    writingDirection: 'rtl',
  },
  bigButton: {
    minHeight: touchTargets.preReader,
    minWidth: touchTargets.preReader,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButtonText: {
    fontSize: typography.size.title,
    lineHeight: typography.size.title * typography.lineHeightRatio,
    color: colors.onPrimary,
    writingDirection: 'rtl',
  },
  /** Debug/tooling identifiers are an explicit LTR exception (plan §4). */
  debug: {
    direction: 'ltr',
    writingDirection: 'ltr',
    fontSize: typography.size.caption,
    color: colors.textSecondary,
  },
});
