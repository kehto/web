import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPajaResourceSettings, installPajaResourceSettings } from './browser-resource-settings.js';

const KEY = 'kehto:paja:resource-servers';
afterEach(() => vi.unstubAllGlobals());

function storage(initial?: string) {
  const values = new Map(initial === undefined ? [] : [[KEY, initial]]);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  } as unknown as Storage;
}

describe('host resource server settings', () => {
  it('normalizes shorthand, default ports, slash, blanks and duplicates in order', () => {
    const store = storage();
    const settings = createPajaResourceSettings(() => store);
    expect(settings.getServers()).toEqual([]);
    expect(settings.save('\n CDN.Example \nhttps://cdn.example:443/\nother.example:8443\n')).toMatchObject({ ok: true });
    expect(settings.getServers()).toEqual(['https://cdn.example', 'https://other.example:8443']);
    expect(createPajaResourceSettings(() => store).getServers()).toEqual(settings.getServers());
    expect(() => (settings.getServers() as string[]).push('https://injected.example')).toThrow();
    expect(store.getItem(KEY)).toBe(JSON.stringify(settings.getServers()));
  });

  it.each([
    'http://cdn.example', 'ftp://cdn.example', '//cdn.example', 'https:cdn.example',
    'https://cdn.example/path', 'https://user:secret@cdn.example', 'https://cdn.example?q=1',
    'https://cdn.example#fragment', 'https://cdn.example?', 'https://cdn.example#', 'https://cdn.example\\',
    'https://cdn.example/path/..', 'https://cd\tn.example',
    'localhost', 'host.local', 'host.internal', 'host.localhost', 'not a domain', 'https://',
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.2', '169.254.1.2',
    'https://[::1]', 'https://[fd00::1]', 'https://[::ffff:127.0.0.1]',
  ])('rejects %s atomically with a line-specific error', (invalid) => {
    const store = storage();
    const settings = createPajaResourceSettings(() => store);
    settings.save('previous.example');
    const durable = store.getItem(KEY);
    expect(settings.save(`valid.example\n${invalid}`)).toMatchObject({ ok: false, message: expect.stringContaining('Line 2:') });
    expect(settings.getServers()).toEqual(['https://previous.example']);
    expect(store.getItem(KEY)).toBe(durable);
  });

  it.each(['broken JSON', '{}', 'null', '[1]', '["https://localhost"]', '["valid.example\\nsecond.example"]'])('ignores corrupt storage %s', (value) => {
    const settings = createPajaResourceSettings(() => storage(value));
    expect(settings.getServers()).toEqual([]);
    expect(settings.getStatus()).toContain('could not be restored');
  });

  it('clears only the dedicated key and restores an empty list', () => {
    const store = storage('["https://previous.example"]');
    store.setItem('unrelated', 'keep');
    const settings = createPajaResourceSettings(() => store);
    expect(settings.save(' \n ')).toMatchObject({ ok: true, message: expect.stringContaining('cleared') });
    expect(store.getItem(KEY)).toBeNull();
    expect(store.getItem('unrelated')).toBe('keep');
    expect(createPajaResourceSettings(() => store).getServers()).toEqual([]);
  });

  it.each(['access', 'getItem', 'setItem', 'removeItem'] as const)('keeps settings usable with %s blocked and reports session-only failures', (operation) => {
    const store = storage('["https://previous.example"]');
    if (operation !== 'access') vi.spyOn(store, operation).mockImplementation(() => { throw new Error('Blocked'); });
    const getStorage = () => {
      if (operation === 'access') throw new Error('Blocked');
      return store;
    };
    const settings = createPajaResourceSettings(getStorage);
    const result = settings.save(operation === 'removeItem' ? '' : 'next.example');
    expect(result.ok).toBe(true);
    expect(settings.getServers()).toEqual(operation === 'removeItem' ? [] : ['https://next.example']);
    if (operation !== 'getItem') {
      expect(result.message).toContain('session-only');
      expect(result.message).toContain('previously saved list may return');
    } else {
      expect(settings.getStatus()).toContain('saved for this host origin');
    }
    if (operation === 'setItem' || operation === 'removeItem') expect(store.getItem(KEY)).toBe('["https://previous.example"]');
  });

  it('does not persist drafts or let invalid saves overwrite failure feedback', () => {
    const store = storage();
    const settings = createPajaResourceSettings(() => store);
    expect(store.setItem).not.toHaveBeenCalled();
    expect(settings.save('<img src=x onerror=alert(1)>').ok).toBe(false);
    expect(store.setItem).not.toHaveBeenCalled();
    expect(settings.getStatus()).toBe('No extra resource servers saved.');
  });

  it('only saves on submit, uses safe inline feedback, and detaches its listener', () => {
    const store = storage();
    const form = new EventTarget();
    const attributes = new Map<string, string>();
    const input = { value: '', setAttribute: (key: string, value: string) => attributes.set(key, value) };
    const status = { textContent: '' };
    const elements = new Map<string, unknown>([
      ['paja-resource-servers-form', form], ['paja-resource-servers-input', input], ['paja-resource-servers-status', status],
    ]);
    vi.stubGlobal('document', { getElementById: (id: string) => elements.get(id) });
    vi.stubGlobal('localStorage', store);
    const settings = installPajaResourceSettings();
    input.value = 'draft.example';
    expect(store.setItem).not.toHaveBeenCalled();
    expect(form.dispatchEvent(new Event('submit', { cancelable: true }))).toBe(false);
    expect(input.value).toBe('https://draft.example');
    expect(settings.getServers()).toEqual(['https://draft.example']);
    input.value = '<img src=x onerror=alert(1)>';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(attributes.get('aria-invalid')).toBe('true');
    expect(status.textContent).toContain('Line 1:');
    expect(status.textContent).not.toContain('<img');
    expect(settings.getServers()).toEqual(['https://draft.example']);
    settings.dispose();
    input.value = 'ignored.example';
    form.dispatchEvent(new Event('submit'));
    expect(settings.getServers()).toEqual(['https://draft.example']);
  });
});
