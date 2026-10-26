import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@huroofi/content-schema';
import { ActivityConfigError, replayActivity } from '@huroofi/activity-sdk';
import { matchSoundLetter, type MatchSoundLetterAction } from '../src';

const config = {
  promptAudioRef: 'audio.letter.ba.sound',
  answerLetterId: 'letter.ba',
  choiceLetterIds: ['letter.ba', 'letter.ta', 'letter.tha', 'letter.nun'],
  confusionSetId: 'sound.ba-ta-tha',
};

let n = 0;
const ev = (payload: MatchSoundLetterAction): GameEvent => ({
  eventId: `e${n++}`,
  sessionId: 's1',
  activityId: 'act.match.ba-ta-tha.ba',
  source: 'touch',
  kind: 'letter',
  payload,
  occurredAtMs: 1_790_000_000_000 + n,
});
const play = (actions: MatchSoundLetterAction[], seed = 3) =>
  replayActivity(matchSoundLetter, config, seed, actions.map(ev));

describe('match_sound_letter', () => {
  it('orders choices reproducibly from the seed', () => {
    const cfg = matchSoundLetter.validateConfig(config);
    const a = matchSoundLetter.createInitialState(cfg, 77).choices;
    expect(matchSoundLetter.createInitialState(cfg, 77).choices).toEqual(a);
    expect([...a].sort()).toEqual([...config.choiceLetterIds].sort());
  });

  it('scores a correct unaided choice', () => {
    expect(play([{ action: 'choose', letterId: 'letter.ba' }]).evaluation).toEqual({
      status: 'correct',
      targetSkillIds: ['letter.ba.sound'],
      feedbackKey: 'match_sound_letter.correct',
      errorCodes: [],
      hintsUsed: 0,
      scoreDelta: 1,
      provenance: 'deterministic',
    });
  });

  it('replaying the sound never penalizes', () => {
    const { evaluation, state } = play([
      { action: 'replay' },
      { action: 'replay' },
      { action: 'replay' },
      { action: 'choose', letterId: 'letter.ba' },
    ]);
    expect(state.replays).toBe(3);
    expect(evaluation).toMatchObject({ status: 'correct', hintsUsed: 0, scoreDelta: 1 });
  });

  it('gives supportive feedback with a confusion code and allows retry', () => {
    const wrong = play([{ action: 'choose', letterId: 'letter.ta' }]);
    expect(wrong.evaluation).toMatchObject({
      status: 'incorrect',
      feedbackKey: 'match_sound_letter.try_again',
      errorCodes: ['wrong_letter', 'confusion.sound.ba-ta-tha'],
      scoreDelta: 0,
    });
    const retry = play([
      { action: 'choose', letterId: 'letter.ta' },
      { action: 'choose', letterId: 'letter.ba' },
    ]);
    expect(retry.evaluation?.status).toBe('correct');
    expect(retry.state.submissionCount).toBe(2);
  });

  it('locks after a correct answer so it records once', () => {
    const { state } = play([{ action: 'choose', letterId: 'letter.ba' }]);
    const again = matchSoundLetter.reduce(state, ev({ action: 'choose', letterId: 'letter.ta' }));
    expect(again).toBe(state);
  });

  it('hint removes a wrong choice, keeps at least two, and costs score', () => {
    const { state, evaluation } = play([
      { action: 'hint' },
      { action: 'hint' },
      { action: 'hint' },
      { action: 'choose', letterId: 'letter.ba' },
    ]);
    expect(state.eliminated).toHaveLength(2);
    expect(state.eliminated).not.toContain('letter.ba');
    expect(state.hintsUsed).toBe(2);
    expect(evaluation).toMatchObject({ status: 'correct', scoreDelta: 0.5, hintsUsed: 2 });
  });

  it('ignores eliminated, unknown or malformed choices', () => {
    const cfg = matchSoundLetter.validateConfig(config);
    const s0 = matchSoundLetter.reduce(
      matchSoundLetter.createInitialState(cfg, 1),
      ev({ action: 'hint' }),
    );
    const gone = s0.eliminated[0] as string;
    expect(matchSoundLetter.reduce(s0, ev({ action: 'choose', letterId: gone }))).toBe(s0);
    expect(matchSoundLetter.reduce(s0, ev({ action: 'choose', letterId: 'letter.mim' }))).toBe(s0);
    expect(matchSoundLetter.reduce(s0, { ...ev({ action: 'replay' }), payload: 42 })).toBe(s0);
  });

  it('rejects ambiguous configs', () => {
    expect(() =>
      matchSoundLetter.validateConfig({ ...config, choiceLetterIds: ['letter.ba'] }),
    ).toThrow(ActivityConfigError);
    expect(() =>
      matchSoundLetter.validateConfig({ ...config, answerLetterId: 'letter.mim' }),
    ).toThrow(/one of the choices/);
    expect(() =>
      matchSoundLetter.validateConfig({
        ...config,
        choiceLetterIds: ['letter.ba', 'letter.ba', 'letter.ta'],
      }),
    ).toThrow(/unique/);
  });

  it('accepts audio-choice input and requires audio capability', () => {
    expect(matchSoundLetter.supportedSources).toContain('audio_choice');
    expect(matchSoundLetter.requiredCapabilities).toContain('audioReady');
  });
});
