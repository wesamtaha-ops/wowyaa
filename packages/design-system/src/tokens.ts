/**
 * Design tokens (plan §4). Engineering placeholders until the Faseeh character bible and
 * licensed Arabic typeface are approved; names are stable, values may change.
 * There is deliberately no "error red": incorrect answers use the gentle `retry` tone.
 */
export const colors = {
  background: '#FFF8EC',
  surface: '#FFFFFF',
  surfaceSunken: '#F4EAD8',
  textPrimary: '#2B2118',
  textSecondary: '#5C4A3A',
  primary: '#B4501F',
  onPrimary: '#FFFFFF',
  success: '#1F7A4D',
  retry: '#8A5A00',
  focusRing: '#1D5FA8',
  faseehOrange: '#E07A2E',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radii = { sm: 8, md: 16, lg: 24, pill: 999 } as const;

export const typography = {
  /** System font until a licensed Arabic face is validated for diacritics (plan §4, §13). */
  family: { arabic: undefined as string | undefined, ui: undefined as string | undefined },
  size: { caption: 14, body: 18, title: 28, display: 44, letterTile: 56, traceGlyph: 220 },
  /** Arabic with stacked diacritics needs generous line height to avoid clipping. */
  lineHeightRatio: 1.6,
} as const;

export const motion = {
  durationMs: { instant: 0, fast: 150, normal: 250, celebratory: 600 },
  /** Durations used when reduced motion is on: state changes still visible, no travel. */
  reducedDurationMs: { instant: 0, fast: 0, normal: 0, celebratory: 0 },
} as const;

export const touchTargets = {
  /** Absolute minimum anywhere in the app (dp). */
  minimum: 48,
  /** Child-facing controls for pre-readers (dp). */
  preReader: 64,
} as const;

export const sounds = {
  tap: 'sfx.tap',
  correct: 'sfx.correct',
  tryAgain: 'sfx.try_again',
  reward: 'sfx.reward',
} as const;

export const mascotStates = [
  'neutral',
  'celebratory',
  'encouraging',
  'thinking',
  'asking',
  'gently_correcting',
] as const;
export type MascotState = (typeof mascotStates)[number];

export const tokens = {
  colors,
  spacing,
  radii,
  typography,
  motion,
  touchTargets,
  sounds,
  mascotStates,
} as const;
export type Tokens = typeof tokens;
