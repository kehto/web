import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAJA_SETTINGS_STORAGE_KEY, createPajaSettingsStore } from './browser-settings.js';
import { getPajaSetting, setActivePajaSettings } from './settings.js';

function storage(initial?: string) {
  const values = new Map(initial === undefined ? [] : [[PAJA_SETTINGS_STORAGE_KEY, initial]]);
  return {
    values,
    store: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
    } as unknown as Storage,
  };
}

afterEach(() => setActivePajaSettings({}));

describe('Paja browser settings store', () => {
  it('restores saved overrides and activates them for the page', () => {
    const { store } = storage(JSON.stringify({ 'relay.liveQueryWaitMs': 9000 }));
    const settings = createPajaSettingsStore({ getStorage: () => store });
    expect(settings.status()).toBe('Restored saved settings.');
    expect(settings.override('relay.liveQueryWaitMs')).toBe(9000);
    expect(getPajaSetting('relay.liveQueryWaitMs')).toBe(9000);
  });

  it('drops invalid, retired and server-scope entries from storage', () => {
    const { store } = storage(JSON.stringify({
      'fs.maxWatchCount': 0, 'retired.key': 5, 'server.resourceTimeoutMs': 9000, 'notify.maxActions': 2,
    }));
    const settings = createPajaSettingsStore({ getStorage: () => store });
    expect(settings.status()).toBe('Restored saved settings; ignored 2 invalid or retired entries.');
    expect(getPajaSetting('fs.maxWatchCount')).toBe(16);
    expect(getPajaSetting('server.resourceTimeoutMs')).toBe(30_000);
    expect(getPajaSetting('notify.maxActions')).toBe(2);
  });

  it('falls back to defaults on corrupt JSON', () => {
    const { store } = storage('{not json');
    const settings = createPajaSettingsStore({ getStorage: () => store });
    expect(settings.status()).toContain('could not be restored');
    expect(getPajaSetting('relay.liveQueryWaitMs')).toBe(4000);
  });

  it('persists only values that differ from the baseline', () => {
    const { store, values } = storage();
    const settings = createPajaSettingsStore({ getStorage: () => store });
    const result = settings.save({ 'relay.liveQueryWaitMs': 4000, 'fs.maxWatchCount': 32 });
    expect(result).toEqual({ ok: true, message: 'Settings saved for this host origin.', errors: {} });
    expect(JSON.parse(values.get(PAJA_SETTINGS_STORAGE_KEY)!)).toEqual({ 'fs.maxWatchCount': 32 });
    expect(getPajaSetting('fs.maxWatchCount')).toBe(32);
    settings.save({ 'fs.maxWatchCount': 16 });
    expect(values.has(PAJA_SETTINGS_STORAGE_KEY)).toBe(false);
  });

  it('rejects the whole draft when any field is invalid', () => {
    const { store } = storage(JSON.stringify({ 'fs.maxWatchCount': 32 }));
    const settings = createPajaSettingsStore({ getStorage: () => store });
    const result = settings.save({ 'fs.maxWatchCount': 8, 'resource.maxBytes': Number.NaN, 'webrtc.roomMinChars': 4 });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Fix 2 invalid settings; nothing was saved.');
    expect(Object.keys(result.errors)).toEqual(['resource.maxBytes', 'webrtc.roomMinChars']);
    expect(getPajaSetting('fs.maxWatchCount')).toBe(32);
  });

  // NAP-NOTIFY (napplet/naps#11 @ 67877ef6) §Actions: "Notifications may include up to 3 action
  // buttons" and "The shell MAY limit the number of actions displayed" — a shell may go below 3, never above.
  it('cannot raise notify.maxActions past the NAP-NOTIFY limit of 3', () => {
    const { store } = storage(JSON.stringify({ 'notify.maxActions': 10 }));
    const settings = createPajaSettingsStore({ getStorage: () => store });
    expect(getPajaSetting('notify.maxActions')).toBe(3);
    const result = settings.save({ 'notify.maxActions': 4 });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors)).toEqual(['notify.maxActions']);
    expect(settings.save({ 'notify.maxActions': 0 }).ok).toBe(true);
    expect(getPajaSetting('notify.maxActions')).toBe(0);
  });

  it('layers user overrides over config-file seeds and resets back to the seed', () => {
    const { store } = storage(JSON.stringify({ 'llm.modelsTimeoutMs': 20_000 }));
    const settings = createPajaSettingsStore({
      getStorage: () => store,
      seeds: { 'llm.modelsTimeoutMs': 12_000, 'notify.maxActions': 1 },
    });
    expect(getPajaSetting('llm.modelsTimeoutMs')).toBe(20_000);
    expect(getPajaSetting('notify.maxActions')).toBe(1);
    expect(settings.baseline('llm.modelsTimeoutMs')).toBe(12_000);
    expect(settings.resetAll().message).toBe('All settings reset to defaults.');
    expect(getPajaSetting('llm.modelsTimeoutMs')).toBe(12_000);
  });

  it('applies changes session-only when storage is unavailable', () => {
    const settings = createPajaSettingsStore({ getStorage: () => { throw new Error('denied'); } });
    const result = settings.save({ 'console.messageLogLimit': 50 });
    expect(result.ok).toBe(true);
    expect(result.message).toBe('Applied for this session only; storage is unavailable, so settings will not persist.');
    expect(getPajaSetting('console.messageLogLimit')).toBe(50);
  });
});
