import { Pressable, Text, View } from 'react-native';
import type { ConstructWordAction, ConstructWordState } from '@huroofi/activities-word';
import type { Word } from '@huroofi/content-schema';
import { colors, radii, spacing, touchTargets, typography } from '@huroofi/design-system';
import { strings } from '../strings';
import { layout } from '../screens/layout';
import { ControlButton } from './ControlButton';

/**
 * Tap-to-place Word Construction (plan §8.1, M2 decision in docs/m2/proposal.md): tap a
 * tile to fill the next empty slot, tap a filled slot to send it back.
 */
export function ConstructWordView({
  state,
  word,
  glyphOf,
  onAction,
}: {
  state: ConstructWordState;
  word: Word | undefined;
  glyphOf: (letterId: string) => string;
  onAction: (action: ConstructWordAction) => void;
}) {
  const placed = new Set(state.slots.filter((s): s is string => s !== null));
  const letterOfTile = new Map(state.tiles.map((t) => [t.tileId, t.letterId]));
  const firstEmpty = state.slots.findIndex((s) => s === null);
  const full = firstEmpty < 0;

  return (
    <View style={{ gap: spacing.lg, alignItems: 'center' }}>
      {/* Engineering placeholder until word illustrations and audio exist: show the written model. */}
      <View
        testID="word-prompt"
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          padding: spacing.md,
          minWidth: 200,
          alignItems: 'center',
        }}
      >
        <Text style={layout.body}>{strings.wordModel}</Text>
        <Text style={[layout.title, { color: colors.textSecondary }]}>{word?.display ?? ''}</Text>
      </View>

      <View style={{ flexDirection: 'row', direction: 'rtl', gap: spacing.sm }}>
        {state.slots.map((tileId, i) => {
          const letterId = tileId ? letterOfTile.get(tileId) : undefined;
          return (
            <Pressable
              key={i}
              testID={`slot-${i}`}
              accessibilityRole="button"
              accessibilityLabel={letterId ? glyphOf(letterId) : strings.emptySlot}
              disabled={!tileId}
              onPress={() => onAction({ action: 'remove', slotIndex: i })}
              style={[
                tileStyle,
                { backgroundColor: tileId ? colors.surface : colors.surfaceSunken },
              ]}
            >
              <Text style={glyphStyle}>{letterId ? glyphOf(letterId) : ''}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          direction: 'rtl',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: spacing.sm,
        }}
      >
        {state.tiles.map((tile) => {
          const used = placed.has(tile.tileId);
          const hinted = state.hintedTileId === tile.tileId;
          return (
            <Pressable
              key={tile.tileId}
              testID={`tile-${tile.letterId}${hinted ? '-hinted' : ''}`}
              accessibilityRole="button"
              accessibilityLabel={glyphOf(tile.letterId)}
              accessibilityState={{ disabled: used || full }}
              disabled={used || full}
              onPress={() =>
                onAction({ action: 'place', tileId: tile.tileId, slotIndex: firstEmpty })
              }
              style={[
                tileStyle,
                {
                  backgroundColor: colors.surface,
                  opacity: used ? 0.3 : 1,
                  borderWidth: hinted ? 4 : 0,
                  borderColor: colors.focusRing,
                },
              ]}
            >
              <Text style={glyphStyle}>{glyphOf(tile.letterId)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', direction: 'rtl', gap: spacing.md }}>
        <ControlButton
          testID="check"
          label={strings.check}
          primary
          disabled={!full || state.status === 'submitted'}
          onPress={() => onAction({ action: 'submit' })}
        />
        <ControlButton
          testID="undo"
          label={strings.undo}
          disabled={state.history.length === 0}
          onPress={() => onAction({ action: 'undo' })}
        />
        <ControlButton
          testID="hint"
          label={strings.hint}
          disabled={state.status === 'submitted'}
          onPress={() => onAction({ action: 'hint' })}
        />
      </View>
    </View>
  );
}

const tileStyle = {
  minWidth: touchTargets.preReader,
  minHeight: touchTargets.preReader,
  borderRadius: radii.md,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const glyphStyle = {
  fontSize: typography.size.letterTile,
  lineHeight: typography.size.letterTile * typography.lineHeightRatio,
  color: colors.textPrimary,
} as const;
