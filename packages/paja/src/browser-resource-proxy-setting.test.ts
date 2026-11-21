import { describe, expect, it } from 'vitest';
import { normalizePajaResourceProxyUrl, readPajaResourceProxyUrl, savePajaResourceProxyUrl } from './browser-resource-proxy-setting.js';
import { createPajaRuntimeHostConfig } from './options.js';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: () => null,
    get length() { return values.size; },
  };
}

describe('resource proxy URL', () => {
  it.each([
    ['https://proxy.example', 'https://proxy.example/'],
    ['https://proxy.example/resource', 'https://proxy.example/resource'],
    ['http://localhost:8787/', 'http://localhost:8787/'],
    ['http://127.0.0.1:8787', 'http://127.0.0.1:8787/'],
  ])('accepts %s', (value, expected) => {
    expect(normalizePajaResourceProxyUrl(value)).toBe(expected);
  });

  it.each(['http://proxy.example/', 'https://user:pass@proxy.example/', 'https://proxy.example/?key=1', 'https://proxy.example/#x', 'ftp://proxy.example/', 'not a url'])(
    'rejects %s', (value) => {
      expect(normalizePajaResourceProxyUrl(value)).toBeNull();
    },
  );

  it('saves, reads back, and clears the host-only proxy', () => {
    const storage = memoryStorage();
    expect(savePajaResourceProxyUrl('http://proxy.example/', () => storage).ok).toBe(false);
    expect(savePajaResourceProxyUrl('https://proxy.example', () => storage)).toMatchObject({ ok: true });
    expect(readPajaResourceProxyUrl(() => storage)).toBe('https://proxy.example/');
    expect(savePajaResourceProxyUrl('', () => storage)).toMatchObject({ ok: true });
    expect(readPajaResourceProxyUrl(() => storage)).toBeUndefined();
    storage.setItem('kehto:paja:resource-proxy', 'http://evil.example/');
    expect(readPajaResourceProxyUrl(() => storage)).toBeUndefined();
  });

  it('validates the static build config option', () => {
    expect(createPajaRuntimeHostConfig({ resourceProxyUrl: 'https://proxy.example' }).resource).toEqual({ proxyUrl: 'https://proxy.example/' });
    expect(createPajaRuntimeHostConfig().resource).toBeUndefined();
    expect(() => createPajaRuntimeHostConfig({ resourceProxyUrl: 'http://proxy.example' })).toThrow('resourceProxyUrl');
  });
});
