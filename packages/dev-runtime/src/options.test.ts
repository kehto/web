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
      simulation: {
        identity: { mode: 'anonymous', pubkey: '' },
        relay: { mode: 'memory', urls: ['wss://relay.kehto.dev'] },
        storage: { mode: 'local' },
        theme: { mode: 'dark' },
      },
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

    expect(hostConfig).toMatchObject({
      version: 1,
      window: {
        id: 'kehto-dev-runtime-window',
        dTag: 'dev-target',
        aggregateHash: 'dev-runtime',
      },
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
      simulation: {
        relay: { mode: 'memory' },
        upload: { mode: 'memory', rail: 'dev-memory' },
        intent: { enabled: true },
      },
    });
  });

  it('normalizes fixed identity and disabled capability modes', () => {
    const pubkey = '1'.repeat(64);
    const options = normalizeDevRuntimeOptions({
      targetUrl: 'http://127.0.0.1:5173',
      simulation: {
        capabilities: { domains: { relay: false, upload: false, intent: false } },
        identity: { mode: 'fixed', pubkey },
        relay: { mode: 'disabled' },
        upload: { mode: 'disabled' },
        intent: { enabled: false },
        theme: { mode: 'light' },
      },
    });

    expect(options.simulation.identity).toEqual({ mode: 'fixed', pubkey });
    expect(options.simulation.relay.mode).toBe('disabled');
    expect(options.simulation.upload.mode).toBe('disabled');
    expect(options.simulation.intent.enabled).toBe(false);
    expect(options.simulation.theme.mode).toBe('light');
    expect(options.simulation.capabilities.disabledDomains).toEqual(expect.arrayContaining(['relay', 'outbox', 'upload', 'intent']));
  });

  it('rejects invalid fixed identity config before serving', () => {
    expect(() => normalizeDevRuntimeOptions({
      targetUrl: 'http://127.0.0.1:5173',
      simulation: { identity: { mode: 'fixed', pubkey: 'short' } },
    })).toThrow(/identity.pubkey/);
  });
});
