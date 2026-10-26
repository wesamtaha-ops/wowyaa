import { createHash, randomUUID } from 'node:crypto';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AR_FOUNDATIONS_V1_RAW, type CurriculumPack } from '@huroofi/curriculum';
import type { SqlDriver } from '@huroofi/offline-storage';
import { openNodeSqlite } from '@huroofi/offline-storage/node';
import type { BootstrapDeps } from '../../src/bootstrap';

export const PACK = AR_FOUNDATIONS_V1_RAW as CurriculumPack;

export function fakePlayer() {
  const played: unknown[] = [];
  return {
    played,
    player: {
      play: async (source: unknown) => {
        played.push(source);
      },
      stop: async () => undefined,
    },
  };
}

/** Deps backed by real node:sqlite; `db` stays reachable so tests can inspect what was stored. */
export function testDeps(overrides: Partial<BootstrapDeps> = {}) {
  let db: SqlDriver | null = null;
  let clock = Date.UTC(2026, 9, 26);
  const audio = fakePlayer();
  const deps: BootstrapDeps = {
    openDb: async () => (db ??= openNodeSqlite()),
    sha256Hex: async (t) => createHash('sha256').update(t).digest('hex'),
    now: () => (clock += 1000),
    newId: randomUUID,
    validationMode: 'draft',
    audioSources: {},
    audioPlayer: audio.player,
    ...overrides,
  };
  return {
    deps,
    audio,
    db: () => {
      if (!db) throw new Error('db not opened yet');
      return db;
    },
  };
}

export async function startPlaying() {
  await fireEvent.press(await screen.findByTestId('add-child-4-6'));
  await fireEvent.press(await screen.findByTestId('child-profile'));
  await screen.findByTestId('play-screen');
}

const isEnabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) =>
  !el.props.accessibilityState?.disabled;

export async function tapTile(letterId: string) {
  const id = new RegExp(`^tile-${letterId.replace('.', '\\.')}(-hinted)?$`);
  const tile = (await screen.findAllByTestId(id)).find(isEnabled);
  if (!tile) throw new Error(`no free tile for ${letterId}`);
  await fireEvent.press(tile);
}

/** The word currently being built, read back from the on-screen written model. */
export async function currentWordAnswer(): Promise<string[]> {
  const prompt = await screen.findByTestId('word-prompt');
  const word = PACK.words.find((w) => within(prompt).queryByText(w.display) !== null);
  if (!word) throw new Error('word prompt not found in pack');
  const item = PACK.activities.find(
    (a) => a.type === 'construct_word' && (a.config as { wordId: string }).wordId === word.wordId,
  );
  return (item?.config as { answer: string[] }).answer;
}

export async function solveCurrentWord() {
  for (const letterId of await currentWordAnswer()) await tapTile(letterId);
  await fireEvent.press(screen.getByTestId('check'));
  await waitFor(() => expect(screen.getByTestId('feedback')).toBeTruthy());
}

export async function count(db: SqlDriver, sql: string, params: unknown[] = []) {
  const row = await db.first<{ n: number }>(sql, params as never[]);
  return row?.n ?? 0;
}
