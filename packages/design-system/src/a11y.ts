/** WCAG 2.x relative luminance contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m?.[1]) throw new Error(`expected #RRGGBB, got ${hex}`);
    const n = parseInt(m[1], 16);
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Durations to use given the reduced-motion preference. */
export function durationFor<K extends string>(
  normal: Record<K, number>,
  reduced: Record<K, number>,
  key: K,
  reduceMotion: boolean,
): number {
  return reduceMotion ? reduced[key] : normal[key];
}
