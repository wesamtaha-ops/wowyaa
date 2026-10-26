import { describe, expect, it } from 'vitest';
import {
  CapabilityRegistry,
  checkAvailability,
  createActivityRegistry,
  UnknownActivityError,
  type ActivityDefinition,
} from '../src';

const noop: ActivityDefinition<{ n: number }, number> = {
  type: 'noop',
  version: 1,
  supportedSources: ['touch'],
  requiredCapabilities: ['touchReady'],
  optionalCapabilities: ['audioReady'],
  validateConfig: (raw) => raw as { n: number },
  createInitialState: (c) => c.n,
  reduce: (s) => s + 1,
  evaluate: () => null,
};

describe('activity registry', () => {
  it('resolves by type and version', () => {
    const r = createActivityRegistry();
    r.register(noop);
    expect(r.resolve('noop', 1).type).toBe('noop');
    expect(r.list()).toEqual([{ type: 'noop', version: 1 }]);
  });

  it('rejects duplicates and unknown versions', () => {
    const r = createActivityRegistry();
    r.register(noop);
    expect(() => r.register(noop)).toThrow(/already registered/);
    expect(() => r.resolve('noop', 2)).toThrow(UnknownActivityError);
  });
});

describe('capabilities', () => {
  it('reports missing required and degraded optional capabilities', () => {
    const caps = new CapabilityRegistry();
    expect(checkAvailability(['touchReady'], ['audioReady'], caps.snapshot())).toEqual({
      playable: false,
      missing: ['touchReady'],
    });
    caps.set('touchReady', true);
    expect(checkAvailability(['touchReady'], ['audioReady'], caps.snapshot())).toEqual({
      playable: true,
      degraded: ['audioReady'],
    });
  });

  it('notifies subscribers only on change', () => {
    const caps = new CapabilityRegistry();
    const seen: boolean[] = [];
    const off = caps.subscribe((s) => seen.push(s.audioReady));
    caps.set('audioReady', true);
    caps.set('audioReady', true);
    off();
    caps.set('audioReady', false);
    expect(seen).toEqual([true]);
  });
});
