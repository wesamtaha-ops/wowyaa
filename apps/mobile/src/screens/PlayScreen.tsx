import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { ConstructWordConfig, ConstructWordState } from '@huroofi/activities-word';
import type { MatchSoundLetterConfig, MatchSoundLetterState } from '@huroofi/activities-audio';
import { MATCH_SOUND_LETTER_TYPE } from '@huroofi/activities-audio';
import { CONSTRUCT_WORD_TYPE } from '@huroofi/activities-word';
import {
  TRACE_LETTER_TYPE,
  type TraceLetterConfig,
  type TraceLetterState,
} from '@huroofi/activities-writing';
import type { EvaluationResult } from '@huroofi/content-schema';
import { colors, spacing, type MascotState } from '@huroofi/design-system';
import { mascotStateFor } from '@huroofi/mascot';
import type { BootedApp } from '../bootstrap';
import { ConstructWordView } from '../game/ConstructWordView';
import { ControlButton } from '../game/ControlButton';
import { Mascot } from '../game/Mascot';
import { startPlaySession, type PlaySession } from '../game/play-session';
import { SoundMatchView } from '../game/SoundMatchView';
import { TraceView } from '../game/TraceView';
import { feedbackText, strings } from '../strings';
import { layout } from './layout';

/** After this many tries the child may move on, so no item can trap them (plan §8). */
const TRIES_BEFORE_SKIP = 3;

type Phase =
  | { kind: 'starting' }
  | { kind: 'playing'; session: PlaySession }
  | { kind: 'done' }
  | { kind: 'failed'; message: string };

export function PlayScreen({
  app,
  childId,
  seed,
  now,
  types,
  onExit,
}: {
  app: BootedApp;
  childId: string;
  seed: number;
  now: () => number;
  types?: readonly string[];
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [, setTick] = useState(0);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [mascot, setMascot] = useState<MascotState>('neutral');
  const wrongStreak = useRef(0);
  const busy = useRef(false);

  const glyphOf = useMemo(() => {
    const byId = new Map(app.pack.letters.map((l) => [l.letterId, l.glyph]));
    return (id: string) => byId.get(id) ?? '?';
  }, [app]);
  const wordById = useMemo(() => new Map(app.pack.words.map((w) => [w.wordId, w])), [app]);

  useEffect(() => {
    let cancelled = false;
    startPlaySession(app, { childId, seed, now, ...(types && { types }) }).then(
      (session) => {
        if (cancelled) return;
        if (!session.current()) {
          void session.finish('complete');
          setPhase({ kind: 'done' });
          return;
        }
        setPhase({ kind: 'playing', session });
      },
      (e: unknown) => !cancelled && setPhase({ kind: 'failed', message: String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [app, childId, seed, now, types]);

  const session = phase.kind === 'playing' ? phase.session : null;
  const current = session?.current() ?? null;

  const playPrompt = useCallback(() => {
    if (current?.item.type !== MATCH_SOUND_LETTER_TYPE) return;
    const config = current.def.validateConfig(current.item.config) as MatchSoundLetterConfig;
    void app.promptAudio.play(config.promptAudioRef);
  }, [app, current]);

  // Each new item starts fresh and, for sound items, asks its question out loud.
  useEffect(() => {
    if (!current) return;
    setResult(null);
    setMascot(mascotStateFor({ kind: 'prompt' }));
    wrongStreak.current = 0;
    playPrompt();
  }, [current, playPrompt]);

  const onAction = useCallback(
    async (payload: { action: string }) => {
      if (!session || busy.current) return;
      busy.current = true;
      try {
        if (payload.action === 'replay') playPrompt();
        const outcome = await session.dispatch(payload);
        if (payload.action === 'hint') setMascot(mascotStateFor({ kind: 'hint' }));
        if (outcome) {
          const r = outcome.record.result;
          wrongStreak.current = r.status === 'correct' ? 0 : wrongStreak.current + 1;
          setResult(r);
          setMascot(
            mascotStateFor({ kind: 'evaluated', result: r, wrongStreak: wrongStreak.current }),
          );
        } else if (payload.action !== 'hint' && payload.action !== 'replay') {
          // Editing after a miss reopens the board: clear the old feedback.
          setResult((prev) => (prev?.status === 'correct' ? prev : null));
        }
      } finally {
        busy.current = false;
        setTick((t) => t + 1);
      }
    },
    [session, playPrompt],
  );

  const onNext = useCallback(async () => {
    if (!session) return;
    if (session.next()) {
      setTick((t) => t + 1);
      return;
    }
    await session.finish('complete');
    setMascot(mascotStateFor({ kind: 'session_complete' }));
    setPhase({ kind: 'done' });
  }, [session]);

  const onLeave = useCallback(async () => {
    await app.promptAudio.stop();
    if (session && phase.kind === 'playing') await session.finish('abandoned').catch(() => {});
    onExit();
  }, [app, session, phase.kind, onExit]);

  return (
    <ScrollView contentContainerStyle={layout.screen} testID="play-screen">
      <View style={{ flexDirection: 'row', direction: 'rtl', justifyContent: 'space-between' }}>
        <ControlButton testID="exit" label={strings.exit} onPress={() => void onLeave()} />
        {current && (
          <Text style={layout.body} testID="progress">
            {strings.progress(current.index + 1, current.total)}
          </Text>
        )}
      </View>

      <Mascot state={phase.kind === 'done' ? 'celebratory' : mascot} />

      {phase.kind === 'failed' && (
        <Text style={layout.debug} testID="play-error">
          {phase.message}
        </Text>
      )}

      {phase.kind === 'done' && (
        <View style={[layout.center, { gap: spacing.md }]}>
          <Text style={layout.title} testID="session-done">
            {strings.sessionDone}
          </Text>
          <ControlButton testID="home" label={strings.exit} primary onPress={onExit} />
        </View>
      )}

      {current?.item.type === CONSTRUCT_WORD_TYPE && (
        <ConstructWordView
          state={current.run.state as ConstructWordState}
          word={wordById.get(
            (current.def.validateConfig(current.item.config) as ConstructWordConfig).wordId,
          )}
          glyphOf={glyphOf}
          onAction={(a) => void onAction(a)}
        />
      )}
      {current?.item.type === MATCH_SOUND_LETTER_TYPE && (
        <SoundMatchView
          state={current.run.state as MatchSoundLetterState}
          glyphOf={glyphOf}
          onAction={(a) => void onAction(a)}
        />
      )}

      {current?.item.type === TRACE_LETTER_TYPE &&
        (() => {
          const config = current.def.validateConfig(current.item.config) as TraceLetterConfig;
          const guide = app.traceGuides.guides.find((g) => g.letterId === config.letterId);
          return guide ? (
            <TraceView
              state={current.run.state as TraceLetterState}
              guide={guide}
              now={now}
              onAction={(a) => void onAction(a)}
            />
          ) : null;
        })()}

      {result && (
        <Text
          testID="feedback"
          accessibilityLiveRegion="polite"
          style={[
            layout.title,
            { color: result.status === 'correct' ? colors.success : colors.retry },
          ]}
        >
          {feedbackText(result.feedbackKey)}
        </Text>
      )}
      {current &&
        (result?.status === 'correct' ||
          current.def.submissionCount(current.run.state) >= TRIES_BEFORE_SKIP) && (
          <View style={layout.center}>
            <ControlButton
              testID="next"
              label={strings.next}
              primary
              onPress={() => void onNext()}
            />
          </View>
        )}
    </ScrollView>
  );
}
