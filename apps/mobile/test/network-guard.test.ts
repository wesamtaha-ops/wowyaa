import { installNetworkGuard, OfflineViolationError } from '../src/network-guard';

function fakeGlobal() {
  class FakeXhr {
    opened: unknown[] = [];
    open(...args: unknown[]) {
      this.opened = args;
    }
  }
  return {
    fetch: jest.fn(async (_url: string) => 'ok'),
    XMLHttpRequest: FakeXhr,
    WebSocket: function RealWebSocket() {},
  };
}

describe('runtime network guard', () => {
  it('blocks fetch, XHR and WebSocket when enforced', async () => {
    const g = fakeGlobal();
    const seen: string[] = [];
    installNetworkGuard({ enforce: true, onAttempt: (k, u) => seen.push(`${k} ${u}`) }, g as never);
    await expect(g.fetch('https://example.com/upload')).rejects.toBeInstanceOf(
      OfflineViolationError,
    );
    expect(() => new g.XMLHttpRequest().open('POST', 'https://example.com/x')).toThrow(
      OfflineViolationError,
    );
    expect(
      () => new (g.WebSocket as unknown as new (u: string) => unknown)('wss://example.com'),
    ).toThrow(OfflineViolationError);
    expect(seen).toEqual([
      'fetch https://example.com/upload',
      'xhr https://example.com/x',
      'websocket wss://example.com',
    ]);
  });

  it('only reports in development so Metro keeps working', async () => {
    const g = fakeGlobal();
    const realFetch = g.fetch;
    const seen: string[] = [];
    installNetworkGuard(
      { enforce: false, onAttempt: (k, u) => seen.push(`${k} ${u}`) },
      g as never,
    );
    await expect(g.fetch('http://localhost:8081/status')).resolves.toBe('ok');
    expect(realFetch).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['fetch http://localhost:8081/status']);
  });

  it('installs once', async () => {
    const g = fakeGlobal();
    const onAttempt = jest.fn();
    installNetworkGuard({ enforce: true, onAttempt }, g as never);
    installNetworkGuard({ enforce: true, onAttempt }, g as never);
    await expect(g.fetch('https://a.b')).rejects.toThrow();
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });
});
