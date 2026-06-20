import { describe, expect, it } from 'vitest';
import {
  DevRuntimeOptionsError,
  createDevRuntimeHostConfig,
  formatDevRuntimeUrl,
  normalizeDevRuntimeOptions,
} from './index.js';

describe('@kehto/dev-runtime options', () => {
  it('normalizes external target URL mode', () => {
    const options = normalizeDevRuntimeOptions({
      targetUrl: 'http://127.0.0.1:5173',
    });

    expect(options).toMatchObject({
      targetUrl: 'http://127.0.0.1:5173/',
      host: '127.0.0.1',
      port: 5197,
      readyTimeoutMs: 30_000,
      mode: 'external-target',
    });
    expect(formatDevRuntimeUrl(options)).toBe('http://127.0.0.1:5197/');
  });

  it('preserves arbitrary command argv without framework-specific parsing', () => {
    const options = normalizeDevRuntimeOptions({
      targetUrl: 'http://localhost:4321/app/',
      command: { mode: 'argv', argv: ['pnpm', 'astro', 'dev', '--host', '127.0.0.1'] },
      port: '5200',
    });

    expect(options.mode).toBe('managed-command');
    expect(options.command).toEqual({
      mode: 'argv',
      argv: ['pnpm', 'astro', 'dev', '--host', '127.0.0.1'],
    });
    expect(options.port).toBe(5200);
  });

  it('rejects missing target URL even when a command is provided', () => {
    expect(() => normalizeDevRuntimeOptions({
      command: { mode: 'shell', command: 'pnpm vite' },
    })).toThrow(/Missing --target-url/);
  });

  it('rejects invalid URL protocols and invalid ports', () => {
    expect(() => normalizeDevRuntimeOptions({ targetUrl: 'file:///tmp/index.html' }))
      .toThrow(DevRuntimeOptionsError);
    expect(() => normalizeDevRuntimeOptions({ targetUrl: 'http://127.0.0.1:5173', port: '70000' }))
      .toThrow(/Invalid --port/);
  });

  it('creates framework-agnostic host config with minimal chrome defaults', () => {
    const options = normalizeDevRuntimeOptions({
      targetUrl: 'https://example.test/napplet',
      readyTimeoutMs: '1000',
      configPath: 'kehto.dev.json',
    });
    const hostConfig = createDevRuntimeHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));

    expect(hostConfig).toEqual({
      version: 1,
      target: {
        url: 'https://example.test/napplet',
        hmrStrategy: 'iframe-target-url',
        command: undefined,
      },
      runtime: {
        host: '127.0.0.1',
        port: 5197,
        readyTimeoutMs: 1000,
        configPath: 'kehto.dev.json',
        reloadToken: 'reload-20260621T000000000Z',
        createdAt: '2026-06-21T00:00:00.000Z',
      },
      chrome: {
        topBar: true,
        bottomBar: true,
        sidePanels: false,
      },
    });
  });
});
