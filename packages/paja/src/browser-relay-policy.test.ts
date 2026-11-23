import { afterEach, expect, it, vi } from 'vitest';
import { hasWritableLocalStorage, isPajaRelayAllowed } from './browser-relay-policy.js';

afterEach(() => vi.unstubAllGlobals());

it.each(['wss://localhost.', 'wss://router.local.', 'wss://router.internal.', 'wss://printer.'])(
  'rejects unconfigured private DNS spelling %s', (url) => {
    expect(isPajaRelayAllowed(url, () => [])).toBe(false);
  },
);

it('reports unavailable storage when accessing the global getter throws', () => {
  vi.stubGlobal('localStorage', undefined);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Blocked', 'SecurityError'); },
  });
  expect(hasWritableLocalStorage()).toBe(false);
});
