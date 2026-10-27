import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RecognitionOutcome } from '@huroofi/ai-gateway';
import { TraceGuideSetSchema, type GameEvent } from '@huroofi/content-schema';
import { replayActivity } from '@huroofi/activity-sdk';
import {
  createTraceLetter,
  evaluateGeometry,
  idealStrokes,
  prepareGuide,
  scribble,
  type InkStroke,
  type TraceLetterAction,
} from '../src';

const GUIDES = TraceGuideSetSchema.parse(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../curriculum/packs/ar-foundations-v1/trace-guides.json'),
      'utf8',
    ),
  ),
);
const guide = (id: string) => {
  const g = GUIDES.guides.find((x) => x.letterId === id);
  if (!g) throw new Error(id);
  return g;
};
const trace = createTraceLetter(GUIDES);
const ba = { letterId: 'letter.ba', presentation: 'isolated' as const };

let seq = 0;
const ev = (payload: TraceLetterAction): GameEvent => ({
  eventId: `e${seq++}`,
  sessionId: 's',
  activityId: 'a',
  source: 'touch',
  kind: 'stroke_set',
  payload,
  occurredAtMs: 0,
});
const strokeEvents = (strokes: InkStroke[]) =>
  strokes.map((points) => ev({ action: 'stroke', points: [...points] }));
const recognized = (text: string): RecognitionOutcome => ({
  status: 'recognized',
  candidates: [{ text }],
  engine: 'fake',
  engineVersion: '1',
  elapsedMs: 5,
  diagnosticCodes: [],
});

function play(config: { letterId: string; presentation: 'isolated' }, events: GameEvent[]) {
  const c = trace.validateConfig(config);
  const { state, evaluation } = replayActivity(trace, c, 1, events);
  return { state, evaluation };
}

describe('TraceGeometryEvaluator golden fixtures (synthetic, not child data)', () => {
  it('a trace along the centerline with dots is correct', () => {
    const v = evaluateGeometry(prepareGuide(guide('letter.ba')), idealStrokes(guide('letter.ba')));
    expect(v).toMatchObject({ status: 'correct', errorCodes: [] });
    expect(v.metrics.coverage).toBeGreaterThan(0.9);
  });

  it('a scribble off the letter is incorrect with off_path', () => {
    const v = evaluateGeometry(prepareGuide(guide('letter.ba')), scribble());
    expect(v.status).toBe('incorrect');
    expect(v.errorCodes).toContain('off_path');
  });

  it('the body without its dot is incorrect with missing_dots', () => {
    const v = evaluateGeometry(
      prepareGuide(guide('letter.ba')),
      idealStrokes(guide('letter.ba'), { withMarks: false }),
    );
    expect(v).toMatchObject({ status: 'incorrect', errorCodes: ['missing_dots'] });
  });

  it('half a letter is borderline, so indeterminate', () => {
    const full = idealStrokes(guide('letter.ba'), { withMarks: true });
    const body = full[0] ?? [];
    const half = [body.slice(0, Math.ceil(body.length * 0.55)), ...full.slice(1)];
    const v = evaluateGeometry(prepareGuide(guide('letter.ba')), half);
    expect(v.status).toBe('indeterminate');
    expect(v.errorCodes).toEqual(expect.arrayContaining(['borderline', 'low_coverage']));
  });

  it('a tap or tiny line is too little to judge', () => {
    const v = evaluateGeometry(prepareGuide(guide('letter.alif')), [[{ x: 0.5, y: 0.5, tMs: 0 }]]);
    expect(v).toMatchObject({ status: 'indeterminate', errorCodes: ['incomplete'] });
  });

  it('every one of the 28 letters is solvable from its own guide', () => {
    for (const g of GUIDES.guides) {
      expect([g.letterId, evaluateGeometry(prepareGuide(g), idealStrokes(g)).status]).toEqual([
        g.letterId,
        'correct',
      ]);
    }
  });
});

describe('trace_letter activity', () => {
  it('rejects letters without a guide or with the wrong presentation', () => {
    expect(() =>
      trace.validateConfig({ letterId: 'letter.nope', presentation: 'isolated' }),
    ).toThrow(/no trace guide/);
    expect(() => trace.validateConfig({ letterId: 'letter.ba', presentation: 'final' })).toThrow(
      /presentation/,
    );
  });

  it('works with no recognizer: geometry only, deterministic provenance', () => {
    const { evaluation } = play(ba, [
      ...strokeEvents(idealStrokes(guide('letter.ba'))),
      ev({ action: 'submit' }),
    ]);
    expect(evaluation).toMatchObject({
      status: 'correct',
      provenance: 'deterministic',
      targetSkillIds: ['letter.ba.trace'],
      scoreDelta: 1,
    });
  });

  it('an agreeing recognizer upgrades provenance; a disagreeing one makes it indeterminate', () => {
    const strokes = strokeEvents(idealStrokes(guide('letter.ba')));
    expect(
      play(ba, [...strokes, ev({ action: 'submit', recognition: recognized('ب') })]).evaluation,
    ).toMatchObject({
      status: 'correct',
      provenance: 'hybrid',
    });
    expect(
      play(ba, [...strokes, ev({ action: 'submit', recognition: recognized('ت') })]).evaluation,
    ).toMatchObject({
      status: 'indeterminate',
      errorCodes: ['recognizer_disagrees'],
    });
    // A recognizer cannot rescue a geometry failure into "correct" either.
    const scribbled = [
      ...strokeEvents(scribble()),
      ev({ action: 'submit', recognition: recognized('ب') }),
    ];
    expect(play(ba, scribbled).evaluation?.status).toBe('indeterminate');
  });

  it('unavailable or uncertain recognition is ignored', () => {
    const strokes = strokeEvents(idealStrokes(guide('letter.ba')));
    const outcome: RecognitionOutcome = { ...recognized('ت'), status: 'uncertain' };
    expect(
      play(ba, [...strokes, ev({ action: 'submit', recognition: outcome })]).evaluation,
    ).toMatchObject({
      status: 'correct',
      provenance: 'deterministic',
    });
  });

  it('counts one submission per submit, allows retry after a miss, locks after success', () => {
    const miss = play(ba, [
      ...strokeEvents(idealStrokes(guide('letter.ba'), { withMarks: false })),
      ev({ action: 'submit' }),
      ev({ action: 'submit' }),
    ]);
    expect(miss.state.submissionCount).toBe(1);
    expect(miss.evaluation?.feedbackKey).toBe('trace_letter.try_again.missing_dots');

    const retry = play(ba, [
      ...strokeEvents(idealStrokes(guide('letter.ba'), { withMarks: false })),
      ev({ action: 'submit' }),
      ev({
        action: 'stroke',
        points: [
          {
            x: guide('letter.ba').marks[0]?.cx ?? 0,
            y: guide('letter.ba').marks[0]?.cy ?? 0,
            tMs: 1,
          },
        ],
      }),
      ev({ action: 'submit' }),
      ev({ action: 'clear' }),
    ]);
    expect(retry.state.submissionCount).toBe(2);
    expect(retry.evaluation?.status).toBe('correct');
    expect(retry.state.strokes.length).toBeGreaterThan(0); // clear ignored after success
  });

  it('hints are counted and halve the score; undo and clear edit the ink', () => {
    const { state, evaluation } = play(ba, [
      ev({ action: 'hint' }),
      ...strokeEvents(idealStrokes(guide('letter.ba'))),
      ev({ action: 'stroke', points: [{ x: 0.1, y: 0.1, tMs: 0 }] }),
      ev({ action: 'undo_stroke' }),
      ev({ action: 'submit' }),
    ]);
    expect(evaluation).toMatchObject({ status: 'correct', hintsUsed: 1, scoreDelta: 0.5 });
    expect(state.strokes).toHaveLength(idealStrokes(guide('letter.ba')).length);
  });

  it('keeps raw ink out of the evaluation result', () => {
    const { evaluation } = play(ba, [
      ...strokeEvents(idealStrokes(guide('letter.ba'))),
      ev({ action: 'submit' }),
    ]);
    expect(JSON.stringify(evaluation)).not.toMatch(/"x":|"points"|tMs/);
  });
});
