import { describe, expect, it } from 'vitest';
import {
  UnavailableHandwritingRecognizer,
  withRecognitionGuard,
  type HandwritingRecognizer,
  type InkRequest,
} from '../src';

const request: InkRequest = {
  requestId: 'r1',
  targetGrapheme: 'ب',
  expectedPresentation: 'isolated',
  strokes: [{ points: [{ x: 0, y: 0, tMs: 0 }] }],
  canvas: { width: 100, height: 100 },
};

const fake = (recognize: HandwritingRecognizer['recognize']): HandwritingRecognizer => ({
  isAvailable: async () => true,
  ensureModelInstalled: async () => 'ready',
  recognize,
  dispose: async () => {},
});

describe('handwriting fallback', () => {
  it('unavailable recognizer never claims readiness', async () => {
    const r = new UnavailableHandwritingRecognizer();
    expect(await r.isAvailable()).toBe(false);
    expect(await r.ensureModelInstalled()).toBe('unsupported');
    expect((await r.recognize()).status).toBe('unavailable');
  });

  it('guard turns a hung engine into uncertain', async () => {
    const guarded = withRecognitionGuard(
      fake(() => new Promise(() => {})),
      20,
    );
    const out = await guarded.recognize(request);
    expect(out).toMatchObject({ status: 'uncertain', diagnosticCodes: ['timeout'] });
  });

  it('guard turns a crashing engine into unavailable', async () => {
    const guarded = withRecognitionGuard(
      fake(async () => {
        throw new Error('native crash');
      }),
      1000,
    );
    expect(await guarded.recognize(request)).toMatchObject({
      status: 'unavailable',
      diagnosticCodes: ['engine_error'],
    });
  });

  it('guard passes through timely results', async () => {
    const ok = {
      status: 'recognized' as const,
      candidates: [{ text: 'ب' }],
      engine: 'x',
      engineVersion: '1',
      elapsedMs: 3,
      diagnosticCodes: [],
    };
    expect(
      await withRecognitionGuard(
        fake(async () => ok),
        1000,
      ).recognize(request),
    ).toEqual(ok);
  });
});
