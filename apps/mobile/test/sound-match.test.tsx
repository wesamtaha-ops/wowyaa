import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HuroofiApp } from '../src/App';
import { count, PACK, startPlaying, testDeps } from './helpers/harness';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-audio', () => ({}));

/**
 * Fixture audio only: these entries stand in for real recordings so the Sound Match flow
 * can be tested before voice talent is booked. Nothing here ships.
 */
const AUDIO_IDS = [
  ...new Set(
    PACK.activities
      .filter((a) => a.type === 'match_sound_letter')
      .map((a) => (a.config as { promptAudioRef: string }).promptAudioRef),
  ),
];
jest.mock('@huroofi/curriculum', () => {
  const actual = jest.requireActual('@huroofi/curriculum');
  const pack = actual.AR_FOUNDATIONS_V1_RAW;
  const ids = [
    ...new Set(
      pack.activities
        .filter((a: { type: string }) => a.type === 'match_sound_letter')
        .map((a: { config: { promptAudioRef: string } }) => a.config.promptAudioRef),
    ),
  ];
  return {
    ...actual,
    AR_FOUNDATIONS_V1_ASSETS_RAW: {
      packId: pack.packId,
      contentVersion: pack.version,
      assets: ids.map((assetId) => ({
        assetId,
        locale: 'ar',
        contentVersion: pack.version,
        sha256: '0'.repeat(64),
        mime: 'audio/mp4',
        sizeBytes: 1,
        durationMs: 500,
        license: 'test fixture',
        credit: 'test',
        relativePath: `fixture/${assetId}.m4a`,
      })),
    },
  };
});

const sources = Object.fromEntries(AUDIO_IDS.map((id, i) => [id, i + 1]));
const mascotState = () => screen.getByTestId('mascot').props.accessibilityValue.text as string;

describe('Sound Match screen (fixture audio)', () => {
  it('plays the prompt on open and on replay, then accepts a retry after a miss', async () => {
    const t = testDeps({ audioSources: sources, focusTypes: ['match_sound_letter'] });
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    expect(screen.getByTestId('replay')).toBeTruthy();
    await waitFor(() => expect(t.audio.played).toHaveLength(1));

    await fireEvent.press(screen.getByTestId('replay'));
    await waitFor(() => expect(t.audio.played).toHaveLength(2));
    expect(await count(t.db(), 'SELECT count(*) AS n FROM activity_attempts')).toBe(0);

    const item = PACK.activities.find(
      (a) =>
        (a.config as { promptAudioRef?: string }).promptAudioRef ===
        AUDIO_IDS[(t.audio.played[0] as number) - 1],
    );
    const { answerLetterId, choiceLetterIds } = item?.config as {
      answerLetterId: string;
      choiceLetterIds: string[];
    };
    const wrong = choiceLetterIds.find((c) => c !== answerLetterId) as string;

    await fireEvent.press(screen.getByTestId(`choice-${wrong}`));
    await screen.findByTestId('feedback');
    expect(mascotState()).toBe('gently_correcting');
    expect(screen.queryByTestId('next')).toBeNull();

    await fireEvent.press(screen.getByTestId(`choice-${answerLetterId}`));
    await screen.findByTestId('next');
    expect(mascotState()).toBe('celebratory');
    expect(
      await count(
        t.db(),
        "SELECT count(*) AS n FROM activity_attempts WHERE activity_type = 'match_sound_letter'",
      ),
    ).toBe(2);
  });
});
