import { describe, expect, it } from 'vitest';
import { resolveNestedContextLock } from './browser-target-frame.js';

describe('resolveNestedContextLock (experimental, dev-facing)', () => {
  it('honors explicit on and off regardless of domains', () => {
    expect(resolveNestedContextLock('on', [])).toBe(true);
    expect(resolveNestedContextLock('on', ['dm'])).toBe(true);
    expect(resolveNestedContextLock('off', ['dm'])).toBe(false);
    expect(resolveNestedContextLock('off', [])).toBe(false);
  });

  it('auto locks only when a privacy-sensitive domain (NAP-DM) is granted', () => {
    expect(resolveNestedContextLock('auto', ['relay', 'identity'])).toBe(false);
    expect(resolveNestedContextLock('auto', [])).toBe(false);
    expect(resolveNestedContextLock('auto', ['dm'])).toBe(true);
    expect(resolveNestedContextLock('auto', ['relay', 'dm', 'storage'])).toBe(true);
  });
});
