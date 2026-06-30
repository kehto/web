import { describe, expect, it } from 'vitest';
import { isDirectPajaCli, parsePajaArgs, runPajaCli } from './cli.js';
import { createPajaHostConfig, normalizePajaOptions, type PajaHostConfig } from './options.js';

describe('@kehto/paja CLI', () => {
  it('parses target URL and argv command separator', () => {
    const parsed = parsePajaArgs([
      '--target-url',
      'http://127.0.0.1:5173',
      '--port',
      '5200',
      '--',
      'pnpm',
      'vite',
      '--host',
      '127.0.0.1',
    ]);

    expect(parsed).toEqual({
      help: false,
      options: {
        targetUrl: 'http://127.0.0.1:5173',
        port: '5200',
        command: {
          mode: 'argv',
          argv: ['pnpm', 'vite', '--host', '127.0.0.1'],
        },
      },
    });
  });

  it('parses simulation flags into the shared raw option schema', () => {
    const pubkey = '2'.repeat(64);
    const parsed = parsePajaArgs([
      '--target-url',
      'http://127.0.0.1:5173',
      '--identity-mode',
      'fixed',
      '--identity-pubkey',
      pubkey,
      '--relay-mode',
      'disabled',
      '--upload-mode',
      'disabled',
      '--capability',
      'relay:off',
      '--capability',
      'upload:off',
      '--theme',
      'light',
      '--config-value',
      'density="compact"',
    ]);

    expect(parsed).toEqual({
      help: false,
      options: {
        targetUrl: 'http://127.0.0.1:5173',
        simulation: {
          identity: { mode: 'fixed', pubkey },
          relay: { mode: 'disabled' },
          upload: { mode: 'disabled' },
          capabilities: { domains: { relay: false, upload: false } },
          theme: { mode: 'light' },
          config: { values: { density: 'compact' } },
        },
      },
    });
  });

  it('prints help without requiring target URL', async () => {
    const stdout: string[] = [];
    const code = await runPajaCli(['--help'], {
      stdout: { write: (chunk) => stdout.push(chunk) },
      stderr: { write: () => undefined },
    }, { serve: false });

    expect(code).toBe(0);
    expect(stdout.join('')).toContain('Usage:');
  });

  it('returns a non-zero code with a clear error for invalid input', async () => {
    const stderr: string[] = [];
    const code = await runPajaCli(['--target-url', 'notaurl'], {
      stdout: { write: () => undefined },
      stderr: { write: (chunk) => stderr.push(chunk) },
    }, { serve: false });

    expect(code).toBe(1);
    expect(stderr.join('')).toContain('Invalid --target-url');
  });

  it('prints the normalized runtime summary for valid input', async () => {
    const stdout: string[] = [];
    const code = await runPajaCli([
      '--target-url',
      'http://127.0.0.1:5173',
      '--command',
      'pnpm vite --host 127.0.0.1',
    ], {
      stdout: { write: (chunk) => stdout.push(chunk) },
      stderr: { write: () => undefined },
    }, { serve: false });

    const output = stdout.join('');
    expect(code).toBe(0);
    expect(output).toContain('Runtime URL: http://127.0.0.1:5197/');
    expect(output).toContain('Target URL: http://127.0.0.1:5173/');
    expect(output).toContain('Mode: managed-command');
    expect(output).toContain('HMR: iframe-target-url');
    expect(output).toContain('Simulation: identity:anon relay:1 storage:local theme:dark off:none');
  });

  it('prints the runtime URL before waiting for managed target readiness', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await runPajaCli([
      '--target-url',
      'http://127.0.0.1:1',
      '--port',
      '0',
      '--ready-timeout',
      '1',
      '--',
      'node',
      '-e',
      'setTimeout(() => {}, 10_000)',
    ], {
      stdout: { write: (chunk) => stdout.push(chunk) },
      stderr: { write: (chunk) => stderr.push(chunk) },
    });

    const output = stdout.join('');
    expect(code).toBe(1);
    expect(output).toContain('Kehto Paja');
    expect(output).toMatch(/Runtime URL: http:\/\/127\.0\.0\.1:\d+\//);
    expect(output).toContain('Target URL: http://127.0.0.1:1/');
    expect(stderr.join('')).toContain('Timed out waiting 1ms for target URL');
  });

  it('updates the served target when a managed command announces a different local URL', async () => {
    const stdout: string[] = [];
    const waitedFor: string[] = [];
    const options = normalizePajaOptions({
      targetUrl: 'http://127.0.0.1:5173',
      command: { mode: 'argv', argv: ['vite'] },
    });
    let hostConfig: PajaHostConfig = createPajaHostConfig(options, new Date('2026-06-21T00:00:00.000Z'));

    const code = await runPajaCli([
      '--target-url',
      'http://127.0.0.1:5173',
      '--',
      'vite',
    ], {
      stdout: { write: (chunk) => stdout.push(chunk) },
      stderr: { write: () => undefined },
    }, {
      startServer: async () => ({
        url: 'http://127.0.0.1:5197/',
        get hostConfig() {
          return hostConfig;
        },
        updateTargetUrl(targetUrl) {
          hostConfig = {
            ...hostConfig,
            target: { ...hostConfig.target, url: new URL(targetUrl).href },
          };
          return hostConfig;
        },
        close: async () => undefined,
      }),
      startCommand: () => ({
        kill: () => undefined,
        detectedTargetUrl: Promise.resolve('http://localhost:5174/'),
      }),
      waitForTargetUrl: async (url) => {
        waitedFor.push(url);
      },
      targetDiscoveryGraceMs: 0,
    });

    expect(code).toBe(0);
    expect(hostConfig.target.url).toBe('http://localhost:5174/');
    expect(waitedFor).toEqual(['http://127.0.0.1:5173/', 'http://localhost:5174/']);
    expect(stdout.join('')).toContain('Target URL updated: http://localhost:5174/');
  });

  it('detects package binary symlinks as direct Paja CLI execution', () => {
    expect(isDirectPajaCli('/home/sandwich/.local/bin/paja')).toBe(true);
    expect(isDirectPajaCli('/home/sandwich/.local/lib/node_modules/@kehto/paja/dist/cli.js')).toBe(true);
  });
});
