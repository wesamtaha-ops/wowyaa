import type { AssetEntry, AssetManifest } from '@huroofi/content-schema';

/**
 * Resolves content `audioRef`s to bundled, checksummed assets (plan §4, §8.2). A reference
 * only counts as playable when it is in the manifest AND the build bundled a source for it,
 * so a missing file degrades the activity instead of failing mid-game.
 */
export interface AudioCatalog<TSource = unknown> {
  resolve(assetId: string): { asset: AssetEntry; source: TSource } | null;
  has(assetId: string): boolean;
  /** Asset ids referenced but not playable, for QA screens and logs. */
  missing(assetIds: readonly string[]): string[];
}

export function createAudioCatalog<TSource>(
  manifest: AssetManifest,
  sources: Readonly<Record<string, TSource>>,
): AudioCatalog<TSource> {
  const byId = new Map(
    manifest.assets.filter((a) => a.mime.startsWith('audio/')).map((a) => [a.assetId, a]),
  );
  const resolve = (assetId: string) => {
    const asset = byId.get(assetId);
    const source = sources[assetId];
    return asset && source !== undefined ? { asset, source } : null;
  };
  return {
    resolve,
    has: (assetId) => resolve(assetId) !== null,
    missing: (assetIds) => [...new Set(assetIds)].filter((id) => resolve(id) === null),
  };
}
