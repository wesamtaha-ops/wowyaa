import type { AudioCatalog } from './catalog';

/** Platform playback, implemented with expo-audio in the app and with fakes in tests. */
export interface AudioPlayer<TSource = unknown> {
  play(source: TSource): Promise<void>;
  stop(): Promise<void>;
}

export type PromptOutcome = 'played' | 'missing' | 'muted' | 'failed';

export interface PromptAudio {
  play(assetId: string): Promise<PromptOutcome>;
  stop(): Promise<void>;
}

/**
 * Plays prompts without ever throwing into gameplay: a missing asset, a muted parent
 * setting or a platform error each return an outcome the UI can show non-verbally.
 */
export function createPromptAudio<TSource>(deps: {
  catalog: AudioCatalog<TSource>;
  player: AudioPlayer<TSource>;
  isEnabled: () => boolean;
  onError?: (assetId: string, error: unknown) => void;
}): PromptAudio {
  return {
    async play(assetId) {
      if (!deps.isEnabled()) return 'muted';
      const entry = deps.catalog.resolve(assetId);
      if (!entry) return 'missing';
      try {
        // Replays interrupt the previous prompt rather than overlap it.
        await deps.player.stop();
        await deps.player.play(entry.source);
        return 'played';
      } catch (e) {
        deps.onError?.(assetId, e);
        return 'failed';
      }
    },
    stop: () => deps.player.stop().catch(() => undefined),
  };
}
