/**
 * Capability flags (plan §12). Activities declare what they need; the shell degrades
 * gracefully instead of silently falling back to anything networked.
 */
export type Capability =
  | 'touchReady'
  | 'audioReady'
  | 'geometryTraceReady'
  | 'digitalInkReady'
  | 'speechReady'
  | 'physicalVisionReady';

export type CapabilitySnapshot = Readonly<Record<Capability, boolean>>;

export const NO_CAPABILITIES: CapabilitySnapshot = Object.freeze({
  touchReady: false,
  audioReady: false,
  geometryTraceReady: false,
  digitalInkReady: false,
  speechReady: false,
  physicalVisionReady: false,
});

export class CapabilityRegistry {
  private state: Record<Capability, boolean> = { ...NO_CAPABILITIES };
  private readonly listeners = new Set<(s: CapabilitySnapshot) => void>();

  set(capability: Capability, ready: boolean): void {
    if (this.state[capability] === ready) return;
    this.state = { ...this.state, [capability]: ready };
    const snapshot = this.snapshot();
    this.listeners.forEach((l) => l(snapshot));
  }

  snapshot(): CapabilitySnapshot {
    return Object.freeze({ ...this.state });
  }

  subscribe(listener: (s: CapabilitySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export type Availability =
  { playable: true; degraded: Capability[] } | { playable: false; missing: Capability[] };

export function checkAvailability(
  required: readonly Capability[],
  optional: readonly Capability[],
  caps: CapabilitySnapshot,
): Availability {
  const missing = required.filter((c) => !caps[c]);
  if (missing.length > 0) return { playable: false, missing };
  return { playable: true, degraded: optional.filter((c) => !caps[c]) };
}
