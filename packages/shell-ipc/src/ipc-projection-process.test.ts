import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(process.cwd(), 'packages/shell-ipc');
const cliPath = resolve(packageRoot, 'dist/cli.js');
const hostPath = resolve(packageRoot, 'examples/ipc-projection-reference-host.mjs');
const redactionHostPath = resolve(packageRoot, 'tests/fixtures/redaction-ipc-host.mjs');
const childPath = resolve(packageRoot, 'tests/fixtures/raw-ipc-napplet.mjs');
const missingFactoryPath = resolve(packageRoot, 'tests/fixtures/missing-ipc-host-factory.mjs');
const throwingFactoryPath = resolve(packageRoot, 'tests/fixtures/throwing-ipc-host-factory.mjs');
const asyncThrowingFactoryPath = resolve(packageRoot, 'tests/fixtures/async-throwing-ipc-host-factory.mjs');

interface RunResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface RunningCli {
  readonly child: ChildProcess;
  readonly result: Promise<RunResult>;
  waitForOutput(marker: string): Promise<void>;
}

function start(arguments_: readonly string[], environment: NodeJS.ProcessEnv = {}): RunningCli {
  const child = spawn(process.execPath, [cliPath, ...arguments_], {
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  const waiters: Array<{ readonly marker: string; readonly resolve: () => void }> = [];
  const notify = (): void => {
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      if (stdout.includes(waiter.marker)) {
        waiters.splice(index, 1);
        waiter.resolve();
      }
    }
  };
  child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); notify(); });
  child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
  const result = new Promise<RunResult>((resolveRun, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolveRun({ code, stdout, stderr }));
  });
  return {
    child,
    result,
    waitForOutput(marker) {
      if (stdout.includes(marker)) return Promise.resolve();
      return new Promise((resolveOutput) => waiters.push({ marker, resolve: resolveOutput }));
    },
  };
}

function run(arguments_: readonly string[], environment?: NodeJS.ProcessEnv): Promise<RunResult> {
  return start(arguments_, environment).result;
}

function command(mode: string, host = hostPath): readonly string[] {
  return ['--host', host, '--', process.execPath, childPath, '--mode', mode];
}

async function temporaryBase(): Promise<string> {
  return mkdtemp('/tmp/kehto-ipc-cli-');
}

describe('kehto-ipc-shell built binary', () => {
  it('runs packaged help successfully', async () => {
    execFileSync('pnpm', ['--filter', '@kehto/shell-ipc', 'build'], { cwd: process.cwd(), stdio: 'ignore' });
    await expect(run(['--help'])).resolves.toEqual({
      code: 0,
      stdout: 'Usage: kehto-ipc-shell --host ./host-config.mjs -- <executable> [...argv]\n',
      stderr: '',
    });
  });

  it.each([
    ['missing host value', ['--host']],
    ['missing delimiter', ['--host', hostPath, process.execPath, '-e', '0']],
    ['missing command', ['--host', hostPath, '--']],
    ['duplicate host', ['--host', hostPath, '--host', hostPath, '--', process.execPath, '-e', '0']],
    ['extra host flag', ['--host', hostPath, '--unexpected', '--', process.execPath, '-e', '0']],
  ])('rejects %s with exact usage', async (_name, arguments_) => {
    await expect(run(arguments_)).resolves.toEqual({
      code: 1,
      stdout: '',
      stderr: 'Usage: kehto-ipc-shell --host ./host-config.mjs -- <executable> [...argv]\n',
    });
  });

  it.each([
    ['missing module', './missing-host-config.mjs'],
    ['malformed module', './package.json'],
    ['missing factory', missingFactoryPath],
    ['throwing factory', throwingFactoryPath],
    ['async throwing factory', asyncThrowingFactoryPath],
  ])('safely rejects %s', async (_name, host) => {
    await expect(run(['--host', host, '--', process.execPath, '-e', '0'])).resolves.toEqual({
      code: 1,
      stdout: '',
      stderr: 'kehto-ipc-shell: host configuration failed\n',
    });
  });

  it('passes shell metacharacters literally rather than interpreting them', async () => {
    const base = await temporaryBase();
    const sentinel = join(base, 'shell-was-used');
    try {
      const result = await run(['--host', hostPath, '--', process.execPath, '-e', 'process.exit(0)', `;touch ${sentinel}`]);
      expect(result.code).toBe(0);
      await expect(readdir(base)).resolves.toEqual([]);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('scrubs stale IPC environment without exposing host registration facts to a raw child', async () => {
    const result = await run(command('report-env'), {
      KEHTO_IPC_SOCKET_PATH: 'stale-socket-sentinel',
      KEHTO_IPC_STALE_SECRET: 'stale-environment-sentinel',
    });
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout) as { milestone: string; environment: Record<string, string> };
    expect(report.milestone).toBe('environment');
    expect(Object.keys(report.environment)).toEqual(['KEHTO_IPC_SOCKET_PATH']);
    expect(report.environment.KEHTO_IPC_SOCKET_PATH).toContain('endpoint.sock');
    expect(result.stdout).not.toContain('stale-environment-sentinel');
    expect(result.stdout).not.toContain('ipc-proof-window');
    expect(result.stdout).not.toContain('ipc-proof-napplet');
    expect(result.stdout).not.toContain('ipc-proof-hash');
  });

  it('proves one real raw handshake, request/result, push, numeric exit, and base cleanup', async () => {
    const base = await temporaryBase();
    try {
      const result = await run(command('graceful', redactionHostPath), { KEHTO_IPC_TEST_BASE: base });
      expect(result.code).toBe(0);
      expect((result.stdout.match(/"milestone":"shell.ready"/g) ?? [])).toHaveLength(1);
      expect((result.stdout.match(/"milestone":"shell.init"/g) ?? [])).toHaveLength(1);
      expect(result.stdout).toContain('"milestone":"result","id":"ipc-proof-available"');
      expect(result.stdout).toContain('"milestone":"intent.changed"');
      await expect(readdir(base)).resolves.toEqual([]);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it.each([
    ['signal-hup', 129], ['signal-int', 130], ['signal-term', 143],
  ] as const)('preserves raw child independent %s status', async (mode, status) => {
    await expect(run(command(mode))).resolves.toMatchObject({ code: status });
  });

  it.each([
    ['SIGHUP', 129], ['SIGINT', 130], ['SIGTERM', 143],
  ] as const)('forwards host %s after the raw child is ready and holding', async (signal, status) => {
    const base = await temporaryBase();
    try {
      const running = start(command('forced', redactionHostPath), { KEHTO_IPC_TEST_BASE: base });
      await running.waitForOutput('"milestone":"hold"');
      running.child.kill(signal);
      await expect(running.result).resolves.toMatchObject({ code: status });
      await expect(readdir(base)).resolves.toEqual([]);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('escalates a disconnected, SIGTERM-ignoring raw child and removes endpoint resources', async () => {
    const base = await temporaryBase();
    try {
      const result = await run(command('disconnect-ignore-term', redactionHostPath), { KEHTO_IPC_TEST_BASE: base });
      expect(result).toMatchObject({ code: 137, stdout: expect.stringContaining('"milestone":"sigterm"') });
      await expect(readdir(base)).resolves.toEqual([]);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('redacts shell-owned config and post-allocation launch failures without filtering child output', async () => {
    const base = await temporaryBase();
    try {
      const configurationFailure = await run(['--host', throwingFactoryPath, '--', process.execPath, '-e', '0']);
      expect(configurationFailure).toEqual({ code: 1, stdout: '', stderr: 'kehto-ipc-shell: host configuration failed\n' });
      const launchFailure = await run(['--host', redactionHostPath, '--', './missing-executable-sentinel'], { KEHTO_IPC_TEST_BASE: base });
      expect(launchFailure).toEqual({ code: 1, stdout: '', stderr: 'kehto-ipc-shell: launch failed\n' });
      expect(launchFailure.stderr).not.toContain(base);
      expect(launchFailure.stderr).not.toContain('registration-window-sentinel');
      expect(launchFailure.stderr).not.toContain('registration-dtag-sentinel');
      expect(launchFailure.stderr).not.toContain('registration-hash-sentinel');
      expect(launchFailure.stderr).not.toContain('endpoint.sock');
      await expect(readdir(base)).resolves.toEqual([]);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
