import { useRef, useState } from 'react';
import {
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import type { InkPoint, TraceLetterAction, TraceLetterState } from '@huroofi/activities-writing';
import type { TraceGuide } from '@huroofi/content-schema';
import { colors, radii, spacing } from '@huroofi/design-system';
import { strings } from '../strings';
import { ControlButton } from './ControlButton';

/** Below this movement (normalized) a new point adds nothing but cost. */
const MIN_STEP = 0.004;
const MAX_SIZE = 420;
/** Share of the screen height the canvas may take, so the controls stay on screen. */
const MAX_HEIGHT_SHARE = 0.45;

/**
 * Letter Tracing (plan §8.3). The letter is drawn large with its dots outlined; the child
 * traces with a finger. Ink is normalized to the unit square and sent per finished stroke.
 */
export function TraceView({
  state,
  guide,
  now,
  onAction,
}: {
  state: TraceLetterState;
  guide: TraceGuide;
  now: () => number;
  onAction: (action: TraceLetterAction) => void;
}) {
  // An explicit square side: width '100%' with aspectRatio stretched tall on iOS.
  const screen = useWindowDimensions();
  const side = Math.max(
    1,
    Math.round(Math.min(screen.width - 2 * spacing.lg, screen.height * MAX_HEIGHT_SHARE, MAX_SIZE)),
  );
  const [measured, setSize] = useState<number | null>(null);
  const size = measured ?? side;
  const [live, setLive] = useState<InkPoint[] | null>(null);
  const liveRef = useRef<InkPoint[] | null>(null);
  const done = state.status === 'submitted' && state.verdict?.status === 'correct';

  const point = (e: GestureResponderEvent): InkPoint => ({
    x: e.nativeEvent.locationX / size,
    y: e.nativeEvent.locationY / size,
    tMs: now(),
  });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize(Math.min(width, height));
  };

  return (
    <View style={{ gap: spacing.lg, alignItems: 'center' }}>
      <View
        testID="trace-canvas"
        accessibilityRole="adjustable"
        accessibilityLabel={`${strings.traceLetter} ${guide.glyph}`}
        onLayout={onLayout}
        onStartShouldSetResponder={() => !done}
        onMoveShouldSetResponder={() => !done}
        onResponderGrant={(e) => {
          liveRef.current = [point(e)];
          setLive(liveRef.current);
        }}
        onResponderMove={(e) => {
          const pts = liveRef.current;
          if (!pts) return;
          const p = point(e);
          const last = pts[pts.length - 1];
          if (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_STEP) return;
          liveRef.current = [...pts, p];
          setLive(liveRef.current);
        }}
        onResponderRelease={() => {
          const pts = liveRef.current;
          liveRef.current = null;
          setLive(null);
          if (pts && pts.length > 0) onAction({ action: 'stroke', points: pts });
        }}
        onResponderTerminate={() => {
          liveRef.current = null;
          setLive(null);
        }}
        style={{
          width: side,
          height: side,
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
        }}
      >
        {/* Touches must land on the wrapper so locationX/Y are relative to the canvas. */}
        <Svg width="100%" height="100%" viewBox="0 0 1 1" pointerEvents="none">
          <Path d={guide.outlinePath} fill={colors.surfaceSunken} />
          {guide.marks.map((m, i) => (
            <Circle
              key={i}
              cx={m.cx}
              cy={m.cy}
              r={m.r}
              fill="none"
              stroke={colors.textSecondary}
              strokeWidth={0.006}
              strokeDasharray="0.02 0.015"
            />
          ))}
          {state.hintsUsed > 0 &&
            guide.skeleton.map(([x, y], i) => (
              <Circle key={`h${i}`} cx={x} cy={y} r={0.006} fill={colors.focusRing} />
            ))}
          {[...state.strokes, ...(live ? [live] : [])].map((stroke, i) =>
            stroke.length === 1 ? (
              <Circle
                key={`s${i}`}
                cx={stroke[0]?.x ?? 0}
                cy={stroke[0]?.y ?? 0}
                r={0.02}
                fill={colors.primary}
              />
            ) : (
              <Polyline
                key={`s${i}`}
                points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={colors.primary}
                strokeWidth={0.035}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ),
          )}
        </Svg>
      </View>

      <View style={{ flexDirection: 'row', direction: 'rtl', gap: spacing.md }}>
        <ControlButton
          testID="check"
          label={strings.check}
          primary
          disabled={state.strokes.length === 0 || state.status === 'submitted'}
          onPress={() => onAction({ action: 'submit' })}
        />
        <ControlButton
          testID="undo"
          label={strings.undo}
          disabled={state.strokes.length === 0 || done}
          onPress={() => onAction({ action: 'undo_stroke' })}
        />
        <ControlButton
          testID="clear"
          label={strings.clear}
          disabled={state.strokes.length === 0 || done}
          onPress={() => onAction({ action: 'clear' })}
        />
        <ControlButton
          testID="hint"
          label={strings.hint}
          disabled={done || state.hintsUsed > 0}
          onPress={() => onAction({ action: 'hint' })}
        />
      </View>
    </View>
  );
}
