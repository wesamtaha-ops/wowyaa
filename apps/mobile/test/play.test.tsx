import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { colors } from '@huroofi/design-system';
import { HuroofiApp } from '../src/App';
import { SESSION_LENGTH } from '../src/game/play-session';
import {
  count,
  currentWordAnswer,
  solveCurrentWord,
  startPlaying,
  tapTile,
  testDeps,
} from './helpers/harness';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-audio', () => ({}));

const mascotState = () => screen.getByTestId('mascot').props.accessibilityValue.text as string;

describe('Word Construction screen', () => {
  it('builds a word by tapping tiles, records one attempt and updates mastery', async () => {
    const t = testDeps();
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    expect(mascotState()).toBe('asking');

    await solveCurrentWord();
    expect(screen.getByTestId('feedback').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: colors.success })]),
    );
    expect(mascotState()).toBe('celebratory');
    expect(await count(t.db(), 'SELECT count(*) AS n FROM activity_attempts')).toBe(1);
    expect(await count(t.db(), 'SELECT count(*) AS n FROM skill_mastery')).toBeGreaterThan(0);
  });

  it('a double-tapped check records exactly one attempt', async () => {
    const t = testDeps();
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    for (const letterId of await currentWordAnswer()) await tapTile(letterId);
    const check = screen.getByTestId('check');
    await fireEvent.press(check);
    await fireEvent.press(check);
    await screen.findByTestId('feedback');
    expect(await count(t.db(), 'SELECT count(*) AS n FROM activity_attempts')).toBe(1);
  });

  it('a wrong answer gets gentle feedback (never red) and the board can be fixed with undo', async () => {
    const t = testDeps();
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    const answer = await currentWordAnswer();
    for (const letterId of [...answer].reverse()) await tapTile(letterId);
    await fireEvent.press(screen.getByTestId('check'));

    const feedback = await screen.findByTestId('feedback');
    expect(feedback.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: colors.retry })]),
    );
    expect(mascotState()).toBe('gently_correcting');
    expect(screen.queryByTestId('next')).toBeNull();

    // Undo reopens the board and clears the old feedback.
    for (let i = 0; i < answer.length; i++) await fireEvent.press(screen.getByTestId('undo'));
    await waitFor(() => expect(screen.queryByTestId('feedback')).toBeNull());
    await solveCurrentWord();
    expect(screen.getByTestId('next')).toBeTruthy();
    expect(await count(t.db(), 'SELECT count(*) AS n FROM activity_attempts')).toBe(2);
  });

  it('a hint highlights the next correct tile and is recorded with the attempt', async () => {
    const t = testDeps();
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    const [first] = await currentWordAnswer();
    await fireEvent.press(screen.getByTestId('hint'));
    expect(mascotState()).toBe('thinking');
    const hinted = screen.getByTestId(`tile-${first}-hinted`);
    expect(JSON.stringify(hinted.props.style)).toContain('"borderWidth":4');

    await solveCurrentWord();
    expect(await count(t.db(), 'SELECT hints_used AS n FROM activity_attempts LIMIT 1')).toBe(1);
  });

  it('plays a whole session to the end and closes it as complete', async () => {
    const t = testDeps();
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    for (let i = 0; i < SESSION_LENGTH; i++) {
      expect(screen.getByTestId('progress').props.children).toBe(`${i + 1} / ${SESSION_LENGTH}`);
      await solveCurrentWord();
      await fireEvent.press(screen.getByTestId('next'));
    }
    await screen.findByTestId('session-done');
    expect(
      await count(t.db(), "SELECT count(*) AS n FROM learning_sessions WHERE status = 'complete'"),
    ).toBe(1);
    await fireEvent.press(screen.getByTestId('home'));
    await screen.findByTestId('offline-badge');
  });

  it('leaving mid-session keeps progress and marks the session abandoned', async () => {
    const t = testDeps();
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    await solveCurrentWord();
    await fireEvent.press(screen.getByTestId('exit'));
    await screen.findByTestId('offline-badge');
    expect(
      await count(t.db(), "SELECT count(*) AS n FROM learning_sessions WHERE status = 'abandoned'"),
    ).toBe(1);
    expect(await count(t.db(), 'SELECT count(*) AS n FROM activity_attempts')).toBe(1);
  });

  it('respects reduced motion: the mascot changes state but does not move', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const t = testDeps();
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    await solveCurrentWord();
    expect(mascotState()).toBe('celebratory');
    await waitFor(() =>
      expect(screen.getByTestId('mascot').props.style).toMatchObject({ transform: [] }),
    );
  });

  it('never shows sound-match items while no recordings are bundled', async () => {
    const t = testDeps();
    await render(<HuroofiApp deps={t.deps} />);
    await startPlaying();
    expect(screen.queryByTestId('replay')).toBeNull();
    expect(screen.getByTestId('word-prompt')).toBeTruthy();
  });
});
