import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer as ExpoAudioPlayer,
} from 'expo-audio';
import type { AudioPlayer } from '@huroofi/audio-engine';

/**
 * One reusable native player for prompts. Sources are bundled `require` ids from
 * asset-sources.generated.ts, so playback never touches the network.
 */
export function createExpoPromptPlayer(): AudioPlayer<number> {
  let player: ExpoAudioPlayer | null = null;
  return {
    async play(source) {
      if (!player) {
        // Children often play with the silent switch on; prompts are the lesson, so play anyway.
        await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
        player = createAudioPlayer(source);
      } else player.replace(source);
      await player.seekTo(0);
      player.play();
    },
    async stop() {
      player?.pause();
    },
  };
}
