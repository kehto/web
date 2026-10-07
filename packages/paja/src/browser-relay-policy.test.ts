import { afterEach, expect, it, vi } from 'vitest';
import { hasWritableLocalStorage } from './browser-relay-policy.js';

afterEach(() => vi.unstubAllGlobals());

it('reports unavailable storage when accessing the global getter throws', () => {
  vi.stubGlobal('localStorage', undefined);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Blocked', 'SecurityError'); },
  });
  expect(hasWritableLocalStorage()).toBe(false);
});
