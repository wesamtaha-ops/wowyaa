/**
 * On-device recognition contracts (plan §6.1). Native adapters (e.g. ML Kit Digital Ink)
 * implement these interfaces; nothing here depends on a native module or the network.
 */
export type StrokePoint = { x: number; y: number; tMs: number };
export type Stroke = { points: StrokePoint[] };

export type InkRequest = {
  requestId: string;
  targetGrapheme: string;
  expectedPresentation: 'isolated' | 'initial' | 'medial' | 'final';
  strokes: Stroke[];
  canvas: { width: number; height: number };
};

export type RecognitionOutcome = {
  status: 'recognized' | 'uncertain' | 'unavailable';
  candidates: Array<{ text: string; score?: number }>;
  engine: string;
  engineVersion: string;
  elapsedMs: number;
  diagnosticCodes: string[];
};

export type ModelInstallState = 'ready' | 'download_required' | 'unsupported';

export interface HandwritingRecognizer {
  isAvailable(): Promise<boolean>;
  /** Must never download on its own; downloads happen only behind the parent screen (plan §9). */
  ensureModelInstalled(): Promise<ModelInstallState>;
  recognize(request: InkRequest): Promise<RecognitionOutcome>;
  dispose(): Promise<void>;
}

/**
 * The P0 default until the native feasibility spike passes: always reports `unavailable`,
 * so tracing runs geometry-only and never blocks or penalizes the child.
 */
export class UnavailableHandwritingRecognizer implements HandwritingRecognizer {
  constructor(private readonly reason = 'not_integrated') {}
  async isAvailable(): Promise<boolean> {
    return false;
  }
  async ensureModelInstalled(): Promise<ModelInstallState> {
    return 'unsupported';
  }
  async recognize(): Promise<RecognitionOutcome> {
    return {
      status: 'unavailable',
      candidates: [],
      engine: 'none',
      engineVersion: '0',
      elapsedMs: 0,
      diagnosticCodes: [this.reason],
    };
  }
  async dispose(): Promise<void> {}
}

/**
 * Wraps a recognizer with a hard timeout and error capture so a slow or crashing native
 * engine degrades to `uncertain`/`unavailable` instead of blocking completion (plan §8.3).
 */
export function withRecognitionGuard(
  inner: HandwritingRecognizer,
  timeoutMs: number,
  now: () => number = Date.now,
): HandwritingRecognizer {
  return {
    isAvailable: () => inner.isAvailable().catch(() => false),
    ensureModelInstalled: () => inner.ensureModelInstalled().catch(() => 'unsupported' as const),
    dispose: () => inner.dispose(),
    async recognize(request) {
      const started = now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<RecognitionOutcome>((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              status: 'uncertain',
              candidates: [],
              engine: 'guard',
              engineVersion: '1',
              elapsedMs: now() - started,
              diagnosticCodes: ['timeout'],
            }),
          timeoutMs,
        );
      });
      try {
        return await Promise.race([inner.recognize(request), timeout]);
      } catch {
        return {
          status: 'unavailable',
          candidates: [],
          engine: 'guard',
          engineVersion: '1',
          elapsedMs: now() - started,
          diagnosticCodes: ['engine_error'],
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
