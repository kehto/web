import { describe, expect, it, vi } from 'vitest';
import {
  createPajaSecuritySettings,
  readStoredNestedContextLockSetting,
} from './browser-security-settings.js';

const KEY = 'kehto:paja:nested-context-lock';

function storage(initial?: string) {
  const values = new Map(initial === undefined ? [] : [[KEY, initial]]);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  } as unknown as Storage;
}

describe('host nested-context-lock GUI setting', () => {
  it('reads a saved setting and ignores junk or an absent value', () => {
    expect(readStoredNestedContextLockSetting(() => storage('on'))).toBe('on');
    expect(readStoredNestedContextLockSetting(() => storage('auto'))).toBe('auto');
    expect(readStoredNestedContextLockSetting(() => storage())).toBeNull();
    expect(readStoredNestedContextLockSetting(() => storage('nonsense'))).toBeNull();
  });

  it('reads as null when storage is unavailable (private window / no DOM)', () => {
    expect(readStoredNestedContextLockSetting(() => { throw new Error('blocked'); })).toBeNull();
  });

  it('saves on/off/auto, persists per origin, and clears on host default', () => {
    const store = storage();
    const settings = createPajaSecuritySettings(() => store);
    expect(settings.getSetting()).toBeNull();
    expect(settings.save('on')).toMatchObject({ ok: true });
    expect(store.getItem(KEY)).toBe('on');
    expect(createPajaSecuritySettings(() => store).getSetting()).toBe('on');
    expect(settings.save('')).toMatchObject({ ok: true, message: expect.stringContaining('host default') });
    expect(store.getItem(KEY)).toBeNull();
  });

  it('rejects an invalid choice without changing the saved value', () => {
    const store = storage('auto');
    const settings = createPajaSecuritySettings(() => store);
    expect(settings.save('maybe')).toMatchObject({ ok: false });
    expect(settings.getSetting()).toBe('auto');
    expect(store.getItem(KEY)).toBe('auto');
  });

  it('stays usable session-only when storage writes throw', () => {
    const store = storage();
    vi.spyOn(store, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const settings = createPajaSecuritySettings(() => store);
    const result = settings.save('off');
    expect(result).toMatchObject({ ok: true, message: expect.stringContaining('session only') });
    expect(settings.getSetting()).toBe('off');
  });
});
