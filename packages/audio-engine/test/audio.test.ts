import { describe, expect, it, vi } from 'vitest';
import type { AssetManifest } from '@huroofi/content-schema';
import { createAudioCatalog, createPromptAudio, type AudioPlayer } from '../src';

const manifest: AssetManifest = {
  packId: 'ar-foundations-v1',
  contentVersion: '1.0.0-draft.1',
  assets: [
    {
      assetId: 'audio.letter.ba.sound',
      locale: 'ar',
      contentVersion: '1.0.0-draft.1',
      sha256: 'a'.repeat(64),
      mime: 'audio/mp4',
      sizeBytes: 1000,
      durationMs: 600,
      license: 'test-fixture',
      credit: 'test',
      relativePath: 'audio/ba.m4a',
    },
    {
      assetId: 'audio.letter.ta.sound',
      locale: 'ar',
      contentVersion: '1.0.0-draft.1',
      sha256: 'b'.repeat(64),
      mime: 'audio/mp4',
      sizeBytes: 1000,
      durationMs: 600,
      license: 'test-fixture',
      credit: 'test',
      relativePath: 'audio/ta.m4a',
    },
  ],
};
// ta is in the manifest but the build has no source for it.
const sources = { 'audio.letter.ba.sound': 101 };

const fakePlayer = (): AudioPlayer<number> & { played: number[] } => {
  const played: number[] = [];
  return { played, play: vi.fn(async (s: number) => void played.push(s)), stop: vi.fn(async () => {}) };
};

describe('audio catalog', () => {
  const catalog = createAudioCatalog(manifest, sources);

  it('resolves only refs that are in the manifest and bundled', () => {
    expect(catalog.resolve('audio.letter.ba.sound')?.source).toBe(101);
    expect(catalog.has('audio.letter.ta.sound')).toBe(false);
    expect(catalog.has('audio.word.qamar')).toBe(false);
  });

  it('reports missing refs once each', () => {
    expect(
      catalog.missing(['audio.letter.ba.sound', 'audio.word.qamar', 'audio.word.qamar']),
    ).toEqual(['audio.word.qamar']);
  });
});

describe('prompt audio', () => {
  const catalog = createAudioCatalog(manifest, sources);

  it('plays a resolvable prompt, stopping the previous one first', async () => {
    const player = fakePlayer();
    const audio = createPromptAudio({ catalog, player, isEnabled: () => true });
    expect(await audio.play('audio.letter.ba.sound')).toBe('played');
    expect(player.stop).toHaveBeenCalledBefore(player.play as never);
    expect(player.played).toEqual([101]);
  });

  it('returns missing instead of throwing for unbundled audio', async () => {
    const player = fakePlayer();
    const audio = createPromptAudio({ catalog, player, isEnabled: () => true });
    expect(await audio.play('audio.letter.ta.sound')).toBe('missing');
    expect(player.played).toEqual([]);
  });

  it('respects the parent audio setting', async () => {
    const player = fakePlayer();
    const audio = createPromptAudio({ catalog, player, isEnabled: () => false });
    expect(await audio.play('audio.letter.ba.sound')).toBe('muted');
  });

  it('turns platform errors into a failed outcome', async () => {
    const onError = vi.fn();
    const audio = createPromptAudio({
      catalog,
      player: { play: async () => Promise.reject(new Error('route lost')), stop: async () => {} },
      isEnabled: () => true,
      onError,
    });
    expect(await audio.play('audio.letter.ba.sound')).toBe('failed');
    expect(onError).toHaveBeenCalledWith('audio.letter.ba.sound', expect.any(Error));
  });
});
