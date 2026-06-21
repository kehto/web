import { unlinkSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  loadDevRuntimeConfigFile,
  mergeDevRuntimeRawOptions,
  normalizeDevRuntimeOptions,
  resolveDevRuntimeRawOptions,
} from './index.js';

describe('@kehto/dev-runtime config files', () => {
  it('loads JSON config files and lets CLI-shaped overrides win', () => {
    const path = `/tmp/kehto-dev-runtime-${Date.now()}.json`;
    writeFileSync(path, JSON.stringify({
      targetUrl: 'http://127.0.0.1:5173',
      simulation: {
        identity: { mode: 'fixed', pubkey: '3'.repeat(64) },
        relay: { mode: 'disabled' },
        upload: { mode: 'disabled' },
        intent: { enabled: false },
        capabilities: { domains: { relay: false, upload: false, intent: false } },
        theme: { mode: 'light' },
        config: { values: { source: 'file', density: 'cozy' } },
      },
    }), 'utf8');

    try {
      const resolved = resolveDevRuntimeRawOptions({
        configPath: path,
        simulation: {
          theme: { mode: 'dark' },
          config: { values: { density: 'compact' } },
        },
      });
      const options = normalizeDevRuntimeOptions(resolved);

      expect(options.targetUrl).toBe('http://127.0.0.1:5173/');
      expect(options.simulation.identity.pubkey).toBe('3'.repeat(64));
      expect(options.simulation.theme.mode).toBe('dark');
      expect(options.simulation.config.values).toMatchObject({
        source: 'file',
        density: 'compact',
      });
      expect(options.simulation.relay.mode).toBe('disabled');
    } finally {
      unlinkSync(path);
    }
  });

  it('merges nested raw simulation values without losing siblings', () => {
    const merged = mergeDevRuntimeRawOptions({
      targetUrl: 'http://127.0.0.1:5173',
      simulation: {
        config: { values: { a: 1, b: 2 } },
        theme: { mode: 'light' },
      },
    }, {
      simulation: {
        config: { values: { b: 3 } },
      },
    });

    expect(merged.simulation?.config?.values).toEqual({ a: 1, b: 3 });
    expect(merged.simulation?.theme?.mode).toBe('light');
  });

  it('rejects non-object config files clearly', () => {
    const path = `/tmp/kehto-dev-runtime-invalid-${Date.now()}.json`;
    writeFileSync(path, '[]', 'utf8');

    try {
      expect(() => loadDevRuntimeConfigFile(path)).toThrow(/expected a JSON object/);
    } finally {
      unlinkSync(path);
    }
  });
});
