import { Pressable, Text, View } from 'react-native';
import type { MatchSoundLetterAction, MatchSoundLetterState } from '@huroofi/activities-audio';
import { colors, radii, spacing, touchTargets, typography } from '@huroofi/design-system';
import { strings } from '../strings';
import { ControlButton } from './ControlButton';

/** Sound-to-Letter (plan §8.2): hear the bundled recording, pick the letter. */
export function SoundMatchView({
  state,
  glyphOf,
  onAction,
}: {
  state: MatchSoundLetterState;
  glyphOf: (letterId: string) => string;
  onAction: (action: MatchSoundLetterAction) => void;
}) {
  const solved = state.status === 'submitted' && state.selected === state.answerLetterId;
  return (
    <View style={{ gap: spacing.lg, alignItems: 'center' }}>
      <ControlButton
        testID="replay"
        label={`🔊 ${strings.replay}`}
        primary
        onPress={() => onAction({ action: 'replay' })}
      />
      <View style={{ flexDirection: 'row', direction: 'rtl', gap: spacing.md }}>
        {state.choices.map((letterId) => {
          const out = state.eliminated.includes(letterId);
          const picked = state.selected === letterId;
          return (
            <Pressable
              key={letterId}
              testID={`choice-${letterId}`}
              accessibilityRole="button"
              accessibilityLabel={glyphOf(letterId)}
              accessibilityState={{ disabled: out || solved, selected: picked }}
              disabled={out || solved}
              onPress={() => onAction({ action: 'choose', letterId })}
              style={{
                minWidth: touchTargets.preReader * 1.5,
                minHeight: touchTargets.preReader * 1.5,
                borderRadius: radii.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                opacity: out ? 0.25 : 1,
                borderWidth: picked ? 4 : 0,
                borderColor: picked && solved ? colors.success : colors.retry,
              }}
            >
              <Text
                style={{
                  fontSize: typography.size.letterTile,
                  lineHeight: typography.size.letterTile * typography.lineHeightRatio,
                  color: colors.textPrimary,
                }}
              >
                {glyphOf(letterId)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ControlButton
        testID="hint"
        label={strings.hint}
        disabled={solved}
        onPress={() => onAction({ action: 'hint' })}
      />
    </View>
  );
}
