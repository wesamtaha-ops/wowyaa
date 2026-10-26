import { createHash, randomUUID } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openNodeSqlite } from '@huroofi/offline-storage/node';
import { HuroofiApp } from '../src/App';
import type { BootstrapDeps } from '../src/bootstrap';

jest.mock('expo-sqlite', () => ({}));

const deps = (overrides: Partial<BootstrapDeps> = {}): BootstrapDeps => ({
  openDb: async () => openNodeSqlite(),
  sha256Hex: async (t) => createHash('sha256').update(t).digest('hex'),
  now: () => Date.UTC(2026, 9, 26),
  newId: randomUUID,
  validationMode: 'draft',
  ...overrides,
});

describe('offline app shell', () => {
  it('boots to the home screen from local storage and bundled content only', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    await render(<HuroofiApp deps={deps()} />);
    expect(await screen.findByTestId('offline-badge')).toBeTruthy();
    expect(screen.getByTestId('build-info').props.children).toMatch(
      /^ar-foundations-v1@1\.0\.0-draft\.1 · db v1 · content 0 errors \/ \d+ warnings · activities construct_word@1$/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('creates and lists child profiles through the real repository', async () => {
    await render(<HuroofiApp deps={deps()} />);
    await fireEvent.press(await screen.findByTestId('add-child-4-6'));
    await waitFor(() => expect(screen.getAllByTestId('child-profile')).toHaveLength(1));
    await fireEvent.press(screen.getByTestId('add-child-7-9'));
    await waitFor(() => expect(screen.getAllByTestId('child-profile')).toHaveLength(2));
  });

  it('refuses to boot unreviewed content in release mode, and offers retry', async () => {
    await render(<HuroofiApp deps={deps({ validationMode: 'release' })} />);
    expect((await screen.findByTestId('boot-error')).props.children.join('')).toMatch(
      /BootError: bundled content failed validation/,
    );
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('surfaces storage failures instead of crashing', async () => {
    await render(
      <HuroofiApp
        deps={deps({
          openDb: async () => {
            throw new Error('disk full');
          },
        })}
      />,
    );
    expect((await screen.findByTestId('boot-error')).props.children.join('')).toMatch(
      /storage_failed|local storage/,
    );
  });
});
