import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text } from 'react-native';
import type { MascotState } from '@huroofi/design-system';
import { mascotMotionFor } from '@huroofi/mascot';
import { strings } from '../strings';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Placeholder pose per state until the Faseeh character art is approved (plan §4). */
const POSE: Record<MascotState, string> = {
  neutral: '🦊',
  asking: '🦊',
  thinking: '🦊',
  celebratory: '🦊🎉',
  encouraging: '🦊💪',
  gently_correcting: '🦊',
};

export function Mascot({ state, size = 72 }: { state: MascotState; size?: number }) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const move = mascotMotionFor(state, reduceMotion);
  const kind = move.kind;
  const durationMs = move.kind === 'none' ? 0 : move.durationMs;
  const repeat = move.kind === 'none' ? 0 : move.repeat;

  useEffect(() => {
    anim.setValue(0);
    if (kind === 'none') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: durationMs / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: durationMs / 2,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      { iterations: repeat },
    );
    loop.start();
    return () => loop.stop();
  }, [anim, kind, durationMs, repeat]);

  const transform =
    kind === 'bounce'
      ? [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }]
      : kind === 'nod'
        ? [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }]
        : kind === 'tilt'
          ? [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) }]
          : [];

  return (
    <Animated.View
      testID="mascot"
      accessibilityRole="image"
      accessibilityLabel={strings.faseeh}
      accessibilityValue={{ text: state }}
      style={{ transform, alignItems: 'center' }}
    >
      <Text style={{ fontSize: size }}>{POSE[state]}</Text>
    </Animated.View>
  );
}
