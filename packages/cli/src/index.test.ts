import { describe, expect, it } from 'vitest';
import { isDirectCli, runKehtoCli } from './index.js';

describe('@kehto/cli', () => {
  it('prints top-level help', async () => {
    const stdout: string[] = [];
    const code = await runKehtoCli(['--help'], {
      stdout: { write: (chunk) => stdout.push(chunk) },
      stderr: { write: () => undefined },
    });

    expect(code).toBe(0);
    expect(stdout.join('')).toContain('kehto paja');
  });

  it('dispatches paja arguments through the top-level command', async () => {
    const stdout: string[] = [];
    const code = await runKehtoCli([
      'paja',
      '--target-url',
      'http://127.0.0.1:5173',
      '--',
      'pnpm',
      'vite',
    ], {
      stdout: { write: (chunk) => stdout.push(chunk) },
      stderr: { write: () => undefined },
    }, { paja: { serve: false } });

    const output = stdout.join('');
    expect(code).toBe(0);
    expect(output).toContain('Kehto Paja');
    expect(output).toContain('Target URL: http://127.0.0.1:5173/');
    expect(output).toContain('Command: pnpm vite');
  });

  it('returns a non-zero code for unknown commands', async () => {
    const stderr: string[] = [];
    const code = await runKehtoCli(['unknown'], {
      stdout: { write: () => undefined },
      stderr: { write: (chunk) => stderr.push(chunk) },
    });

    expect(code).toBe(1);
    expect(stderr.join('')).toContain('unknown command "unknown"');
  });

  it('detects global binary symlinks as direct CLI execution', () => {
    expect(isDirectCli('/home/sandwich/.local/bin/kehto')).toBe(true);
    expect(isDirectCli('/home/sandwich/.local/lib/node_modules/@kehto/cli/dist/index.js')).toBe(true);
  });
});
