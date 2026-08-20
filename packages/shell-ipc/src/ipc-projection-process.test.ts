import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(process.cwd(), 'packages/shell-ipc');
const cliPath = resolve(packageRoot, 'dist/cli.js');
const hostPath = resolve(packageRoot, 'examples/ipc-projection-reference-host.mjs');
const childPath = resolve(packageRoot, 'tests/fixtures/raw-ipc-napplet.mjs');

function run(arguments_: readonly string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveRun, reject) => {
    const child: ChildProcess = spawn(process.execPath, [cliPath, ...arguments_], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.once('error', reject);
    child.once('exit', (code) => resolveRun({ code, stdout, stderr }));
  });
}

describe('kehto-ipc-shell built binary', () => {
  it('runs the packaged help and preserves literal child argv without printing the endpoint', async () => {
    execFileSync('pnpm', ['--filter', '@kehto/shell-ipc', 'build'], { cwd: process.cwd(), stdio: 'ignore' });
    await expect(run(['--help'])).resolves.toMatchObject({ code: 0, stdout: expect.stringContaining('kehto-ipc-shell --host') });
    const result = await run(['--host', hostPath, '--', process.execPath, childPath, '--mode', 'exit-23']);
    expect(result.code).toBe(23);
    expect(result.stdout).not.toContain('endpoint.sock');
    expect(result.stderr).not.toContain('endpoint.sock');
  });

  it('returns concise safe failures for malformed host configuration and spawn errors', async () => {
    await expect(run(['--host', './missing-host-config.mjs', '--', process.execPath, '-e', '0']))
      .resolves.toMatchObject({ code: 1, stderr: 'kehto-ipc-shell: host configuration failed\n' });
    await expect(run(['--host', hostPath, '--', './definitely-not-an-executable']))
      .resolves.toMatchObject({ code: 1, stderr: 'kehto-ipc-shell: launch failed\n' });
  });

  it.each([
    ['--host', hostPath], ['--', process.execPath, '-e', '0'],
    ['--host', hostPath, '--host', hostPath, '--', process.execPath, '-e', '0'],
    ['--host', hostPath, '--unexpected', '--', process.execPath, '-e', '0'],
  ])('rejects malformed CLI grammar with exact usage: %j', async (arguments_) => {
    await expect(run(arguments_)).resolves.toEqual({
      code: 1,
      stdout: '',
      stderr: 'Usage: kehto-ipc-shell --host ./host-config.mjs -- <executable> [...argv]\n',
    });
  });

  it.each(['./missing-host-config.mjs', './package.json'])('safely rejects invalid host modules: %s', async (host) => {
    await expect(run(['--host', host, '--', process.execPath, '-e', '0']))
      .resolves.toMatchObject({ code: 1, stderr: 'kehto-ipc-shell: host configuration failed\n' });
  });

  it('passes shell metacharacters literally rather than interpreting them', async () => {
    const sentinel = resolve(packageRoot, 'shell-was-used');
    const result = await run(['--host', hostPath, '--', process.execPath, '-e', 'process.exit(0)', `;touch ${sentinel}`]);
    expect(result.code).toBe(0);
    expect(() => execFileSync('test', ['-e', sentinel])).toThrow();
  });
});
