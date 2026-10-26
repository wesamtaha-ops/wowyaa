/**
 * Runtime half of the offline guarantee (plan §12, §17.10). In enforced mode every
 * JS-initiated fetch, XHR and WebSocket is refused, so a future dependency cannot quietly
 * upload child data. Development builds only warn, because Metro/HMR need the network.
 * OS-level traffic (e.g. system font or update services) is outside JS and is covered by
 * the device network audit in docs/qa/offline-test-matrix.md.
 */
export interface NetworkGuardOptions {
  enforce: boolean;
  onAttempt?: (kind: 'fetch' | 'xhr' | 'websocket', url: string) => void;
}

export class OfflineViolationError extends Error {
  constructor(kind: string, url: string) {
    super(`Blocked ${kind} to ${url}: Huroofi core is offline-only`);
    this.name = 'OfflineViolationError';
  }
}

type GuardTarget = {
  fetch?: (input: unknown, init?: unknown) => Promise<unknown>;
  XMLHttpRequest?: { prototype: { open: (...args: unknown[]) => void } };
  WebSocket?: unknown;
  __huroofiNetworkGuard?: boolean;
};

const urlOf = (input: unknown): string => {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && 'url' in input)
    return String((input as { url: unknown }).url);
  return String(input);
};

export function installNetworkGuard(
  options: NetworkGuardOptions,
  target: GuardTarget = globalThis as GuardTarget,
): void {
  if (target.__huroofiNetworkGuard) return;
  target.__huroofiNetworkGuard = true;
  const report =
    options.onAttempt ?? ((kind, url) => console.warn(`[network-guard] ${kind} ${url}`));

  const originalFetch = target.fetch;
  if (originalFetch) {
    target.fetch = (input, init) => {
      const url = urlOf(input);
      report('fetch', url);
      if (options.enforce) return Promise.reject(new OfflineViolationError('fetch', url));
      return originalFetch(input, init);
    };
  }

  const xhrProto = target.XMLHttpRequest?.prototype;
  if (xhrProto) {
    const originalOpen = xhrProto.open;
    xhrProto.open = function (this: unknown, ...args: unknown[]) {
      const url = urlOf(args[1]);
      report('xhr', url);
      if (options.enforce) throw new OfflineViolationError('xhr', url);
      return originalOpen.apply(this, args);
    };
  }

  if (options.enforce && target.WebSocket) {
    target.WebSocket = function BlockedWebSocket(url: unknown) {
      report('websocket', urlOf(url));
      throw new OfflineViolationError('websocket', urlOf(url));
    };
  }
}
