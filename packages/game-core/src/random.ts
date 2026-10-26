/**
 * Seeded PRNG (mulberry32). Every random choice in gameplay flows through this so a
 * session is reproducible from its seed in tests and bug reports (plan §6).
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed)) throw new RangeError(`seed must be an integer, got ${seed}`);
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, maxExclusive). */
export function nextInt(rng: Rng, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`maxExclusive must be a positive integer, got ${maxExclusive}`);
  }
  return Math.floor(rng() * maxExclusive);
}

/** Fisher–Yates shuffle returning a new array; the input is not mutated. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Derive an independent child seed, e.g. per activity within a session. */
export function deriveSeed(seed: number, salt: string): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h | 0;
}
