import { describe, expect, it } from 'vitest';
import { parsePajaArgs, runPajaCli } from './cli.js';

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
});
