import * as Crypto from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AUDIO_SOURCES } from './audio/asset-sources.generated';
import { createExpoPromptPlayer } from './audio/expo-player';
import { bootstrap, type BootedApp, type BootstrapDeps } from './bootstrap';
import { CONTENT_VALIDATION_MODE } from './config';
import { openExpoSqlite } from './db/expo-driver';
import { BootErrorScreen, LoadingScreen } from './screens/StatusScreens';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';

const deviceDeps: BootstrapDeps = {
  openDb: () => openExpoSqlite(),
  sha256Hex: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
  now: Date.now,
  newId: () => Crypto.randomUUID(),
  validationMode: CONTENT_VALIDATION_MODE,
  audioSources: AUDIO_SOURCES,
  audioPlayer: createExpoPromptPlayer() as BootstrapDeps['audioPlayer'],
};

type BootState =
  { kind: 'loading' } | { kind: 'ready'; app: BootedApp } | { kind: 'failed'; error: Error };

export function HuroofiApp({ deps }: { deps: BootstrapDeps }) {
  const [state, setState] = useState<BootState>({ kind: 'loading' });
  const [playing, setPlaying] = useState<{ childId: string; seed: number } | null>(null);

  const start = useCallback(() => {
    setState({ kind: 'loading' });
    bootstrap(deps).then(
      (app) => setState({ kind: 'ready', app }),
      (error: unknown) =>
        setState({
          kind: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
        }),
    );
  }, [deps]);

  useEffect(start, [start]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {state.kind === 'loading' && <LoadingScreen />}
      {state.kind === 'failed' && <BootErrorScreen error={state.error} onRetry={start} />}
      {state.kind === 'ready' && !playing && (
        <HomeScreen
          app={state.app}
          onPlay={(child) =>
            // Any safe integer works; the seed is stored with the session for replay.
            setPlaying({ childId: child.id, seed: Math.floor(deps.now()) % 2_147_483_647 })
          }
        />
      )}
      {state.kind === 'ready' && playing && (
        <PlayScreen
          app={state.app}
          childId={playing.childId}
          seed={playing.seed}
          now={deps.now}
          onExit={() => setPlaying(null)}
        />
      )}
    </SafeAreaProvider>
  );
}

export default function App() {
  return <HuroofiApp deps={deviceDeps} />;
}
