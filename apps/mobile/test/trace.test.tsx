import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { idealStrokes, scribble, type InkStroke } from '@huroofi/activities-writing';
import { TraceGuideSetSchema, type TraceGuide } from '@huroofi/content-schema';
import { AR_FOUNDATIONS_V1_TRACE_GUIDES_RAW } from '@huroofi/curriculum';
import { colors } from '@huroofi/design-system';
import { MASTERY_CONFIG_V1 } from '@huroofi/learning-engine';
import { HuroofiApp } from '../src/App';
import { count, startPlaying, testDeps } from './helpers/harness';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-audio', () => ({}));

const GUIDES = TraceGuideSetSchema.parse(AR_FOUNDATIONS_V1_TRACE_GUIDES_RAW);
const SIZE = 300;
const mascotState = () => screen.getByTestId('mascot').props.accessibilityValue.text as string;

function currentGuide(): TraceGuide {
  const label = screen.getByTestId('trace-canvas').props.accessibilityLabel as string;
  const guide = GUIDES.guides.find((g) => label.endsWith(` ${g.glyph}`));
  if (!guide) throw new Error(`no guide for ${label}`);
  return guide;
}

/** Feeds strokes through the canvas responder exactly as touches would arrive. */
async function draw(strokes: InkStroke[]) {
  const canvas = screen.getByTestId('trace-canvas');
  await fireEvent(canvas, 'layout', { nativeEvent: { layout: { width: SIZE, height: SIZE } } });
  const at = (p: { x: number; y: number }) => ({
    nativeEvent: { locationX: p.x * SIZE, locationY: p.y * SIZE },
  });
  for (const stroke of strokes) {
    const [first, ...rest] = stroke;
    if (!first) continue;
    await act(async () => {
      canvas.props.onResponderGrant(at(first));
      for (const p of rest) canvas.props.onResponderMove(at(p));
      canvas.props.onResponderRelease(at(rest[rest.length - 1] ?? first));
    });
  }
}

async function check() {
  await fireEvent.press(screen.getByTestId('check'));
  await screen.findByTestId('feedback');
}

const setup = async () => {
  const t = testDeps({ focusTypes: ['trace_letter'] });
  await render(<HuroofiApp deps={t.deps} />);
  await startPlaying();
  await screen.findByTestId('trace-canvas');
  return t;
};

describe('Letter Tracing screen (geometry only, no ML model)', () => {
  it('a finger trace along the letter is correct, recorded once, and stores no raw ink', async () => {
    const t = await setup();
    await draw(idealStrokes(currentGuide()));
    await check();
    expect(screen.getByTestId('feedback').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: colors.success })]),
    );
    expect(mascotState()).toBe('celebratory');
    expect(await count(t.db(), 'SELECT count(*) AS n FROM activity_attempts')).toBe(1);

    // Raw coordinates must never reach SQLite (plan §6.3): scan every text column.
    const tables = await t
      .db()
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    for (const { name } of tables) {
      const rows = await t.db().all<Record<string, unknown>>(`SELECT * FROM "${name}"`);
      expect(JSON.stringify(rows)).not.toMatch(/"x":|tMs|locationX/);
    }
  });

  it('a scribble gets gentle feedback, and undo/clear edit the ink', async () => {
    await setup();
    await draw(scribble());
    await check();
    expect(screen.getByTestId('feedback').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: colors.retry })]),
    );
    expect(mascotState()).toBe('gently_correcting');
    await draw(scribble());
    await fireEvent.press(screen.getByTestId('undo'));
    await fireEvent.press(screen.getByTestId('clear'));
    expect(screen.getByTestId('check').props.accessibilityState.disabled).toBe(true);
  });

  it('a borderline trace is "keep going" and leaves mastery untouched', async () => {
    const t = await setup();
    const guide = currentGuide();
    const strokes = idealStrokes(guide);
    const body = strokes[0] ?? [];
    await draw([body.slice(0, Math.ceil(body.length * 0.5))]);
    await check();
    const feedback = screen.getByTestId('feedback');
    expect(feedback.props.children).toBe('أَكْمِلْ، أَنْتَ تَتَقَدَّمُ!');
    const row = await t
      .db()
      .first<{ mastery: number; outcome: string }>(
        'SELECT m.mastery, a.outcome FROM skill_mastery m JOIN activity_attempts a ON a.child_id = m.child_id',
      );
    expect(row).toEqual({ mastery: MASTERY_CONFIG_V1.startingMastery, outcome: 'indeterminate' });
  });

  it('after three tries the child may move on', async () => {
    await setup();
    for (let i = 0; i < 3; i++) {
      expect(screen.queryByTestId('next')).toBeNull();
      await draw(scribble());
      await check();
    }
    await waitFor(() => expect(screen.getByTestId('next')).toBeTruthy());
  });

  it('the hint shows the path and is counted on the attempt', async () => {
    const t = await setup();
    await fireEvent.press(screen.getByTestId('hint'));
    expect(screen.getByTestId('hint').props.accessibilityState.disabled).toBe(true);
    await draw(idealStrokes(currentGuide()));
    await check();
    expect(await count(t.db(), 'SELECT hints_used AS n FROM activity_attempts')).toBe(1);
  });
});
