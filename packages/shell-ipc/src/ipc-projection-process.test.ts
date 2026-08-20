import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hostPath = resolve(process.cwd(), 'packages/shell-ipc/examples/ipc-projection-reference-host.mjs');
const childPath = resolve(process.cwd(), 'packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs');
const adversarialChildPath = resolve(process.cwd(), 'packages/shell-ipc/tests/fixtures/adversarial-ipc-napplet.mjs');

interface TranscriptRecord {
  readonly source: 'child' | 'host';
  readonly milestone: string;
  readonly id?: string;
  readonly delivered?: boolean;
  readonly signal?: string;
  readonly routeAbsent?: boolean;
  readonly sessionAbsent?: boolean;
  readonly endpointPathAbsent?: boolean;
  readonly endpointDirectoryAbsent?: boolean;
}

interface HostRun {
  readonly child: ChildProcess;
  readonly records: TranscriptRecord[];
  readonly stderr: () => string;
  readonly exited: Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>;
}

interface HostOptions {
  readonly baseDirectory?: string;
  readonly mode: 'graceful' | 'forced';
  readonly arguments?: readonly string[];
  readonly childPath?: string;
  readonly testCase?: 'forged' | 'malformed' | 'duplicate' | 'unterminated' | 'oversize';
  readonly proofTimeoutMilliseconds?: number;
  readonly childReadyDelayMilliseconds?: number;
  readonly flagOrder?: 'mode-first' | 'base-first';
}

function spawnHost(options: HostOptions): HostRun {
  const defaultArguments = options.flagOrder === 'base-first'
    ? [
      ...(options.baseDirectory ? ['--base-dir', options.baseDirectory] : []),
      '--mode', options.mode,
    ]
    : [
      '--mode', options.mode,
      ...(options.baseDirectory ? ['--base-dir', options.baseDirectory] : []),
    ];
  const argumentsForHost = options.arguments ?? defaultArguments;
  const child = spawn(process.execPath, [hostPath, ...argumentsForHost], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ...(options.childPath ? { KEHTO_IPC_PROJECTION_TEST_CHILD: options.childPath } : {}),
      ...(options.testCase ? { KEHTO_IPC_PROJECTION_TEST_CASE: options.testCase } : {}),
      ...(options.proofTimeoutMilliseconds !== undefined
        ? { KEHTO_IPC_PROJECTION_TEST_PROOF_TIMEOUT_MS: String(options.proofTimeoutMilliseconds) }
        : {}),
      ...(options.childReadyDelayMilliseconds !== undefined
        ? { KEHTO_IPC_PROJECTION_TEST_CHILD_READY_DELAY_MS: String(options.childReadyDelayMilliseconds) }
        : {}),
    },
  });
  const records: TranscriptRecord[] = [];
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
    let newline = stdout.indexOf('\n');
    while (newline >= 0) {
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      if (line.length > 0) records.push(JSON.parse(line) as TranscriptRecord);
      newline = stdout.indexOf('\n');
    }
  });
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });
  const exited = new Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
  return { child, records, stderr: () => stderr, exited };
}

async function awaitExit(run: HostRun): Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }> {
  return await Promise.race([
    run.exited,
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`Timed out waiting for reference host. stderr: ${run.stderr()}`)), 15_000)),
  ]);
}

function recordIndex(records: readonly TranscriptRecord[], source: TranscriptRecord['source'], milestone: string): number {
  return records.findIndex((record) => record.source === source && record.milestone === milestone);
}

function expectProof(records: readonly TranscriptRecord[], mode: 'graceful' | 'forced'): void {
  const init = recordIndex(records, 'child', 'shell.init');
  const serviceDispatch = recordIndex(records, 'host', 'service-dispatch');
  const serviceResult = recordIndex(records, 'host', 'service-result');
  const result = records.findIndex((record) => record.source === 'child' && record.milestone === 'result' && record.id === 'ipc-proof-available');
  const push = recordIndex(records, 'host', 'context-push');
  const receivedPush = recordIndex(records, 'child', 'intent.changed');
  const cleanup = records.filter((record) => record.source === 'host' && record.milestone === 'cleanup');

  expect(init).toBeGreaterThanOrEqual(0);
  expect(records.filter((record) => record.source === 'child' && record.milestone === 'shell.init')).toHaveLength(1);
  expect(serviceDispatch).toBeGreaterThan(init);
  expect(serviceResult).toBeGreaterThan(serviceDispatch);
  expect(result).toBeGreaterThan(serviceResult);
  expect(push).toBeGreaterThan(serviceResult);
  expect(records[push]).toMatchObject({ delivered: true });
  expect(receivedPush).toBeGreaterThan(push);
  expect(cleanup).toEqual([expect.objectContaining({
    routeAbsent: true,
    sessionAbsent: true,
    endpointPathAbsent: true,
    endpointDirectoryAbsent: true,
  })]);
  if (mode === 'forced') expect(records).toContainEqual(expect.objectContaining({ source: 'host', milestone: 'child-exit', signal: 'SIGKILL' }));
}

async function expectFailedProof(baseDirectory: string, testCase: NonNullable<HostOptions['testCase']>): Promise<void> {
  await writeFile(resolve(baseDirectory, 'caller-sentinel.txt'), testCase, 'utf8');
  const startedAt = Date.now();
  const run = spawnHost({
    baseDirectory,
    mode: 'graceful',
    childPath: adversarialChildPath,
    testCase,
    proofTimeoutMilliseconds: 250,
  });
  try {
    await expect(awaitExit(run)).resolves.toMatchObject({ code: 1, signal: null });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    await expect(readFile(resolve(baseDirectory, 'caller-sentinel.txt'), 'utf8')).resolves.toBe(testCase);
    await expect(readdir(baseDirectory)).resolves.toEqual(['caller-sentinel.txt']);
  } finally {
    if (!run.child.killed && run.child.exitCode === null) run.child.kill('SIGKILL');
  }
}

describe('IPC projection raw-process proof', () => {
  it('runs the exact documented command without --base-dir', async () => {
    const run = spawnHost({ mode: 'graceful' });
    try {
      await expect(awaitExit(run)).resolves.toMatchObject({ code: 0, signal: null });
      expectProof(run.records, 'graceful');
    } finally {
      if (!run.child.killed && run.child.exitCode === null) run.child.kill('SIGKILL');
    }
  });

  it('keeps the ten-second proof deadline for a delayed normal child under NODE_ENV=test', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-process-normal-deadline-');
    const startedAt = Date.now();
    const run = spawnHost({ baseDirectory, mode: 'graceful', childReadyDelayMilliseconds: 1_200 });
    try {
      await expect(awaitExit(run)).resolves.toMatchObject({ code: 0, signal: null });
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_000);
      expectProof(run.records, 'graceful');
      await expect(readdir(baseDirectory)).resolves.toEqual([]);
    } finally {
      if (!run.child.killed && run.child.exitCode === null) run.child.kill('SIGKILL');
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('accepts --base-dir in either flag order', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-process-order-');
    const run = spawnHost({ baseDirectory, mode: 'graceful', flagOrder: 'base-first' });
    try {
      await expect(awaitExit(run)).resolves.toMatchObject({ code: 0, signal: null });
      expectProof(run.records, 'graceful');
      await expect(readdir(baseDirectory)).resolves.toEqual([]);
    } finally {
      if (!run.child.killed && run.child.exitCode === null) run.child.kill('SIGKILL');
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it.each([
    ['duplicate --mode', ['--mode', 'graceful', '--mode', 'forced']],
    ['unknown flag', ['--mode', 'graceful', '--unknown', 'value']],
  ])('rejects %s CLI arguments', async (_label, argumentsForHost) => {
    const run = spawnHost({ mode: 'graceful', arguments: argumentsForHost });
    try {
      await expect(awaitExit(run)).resolves.toMatchObject({ code: 1, signal: null });
    } finally {
      if (!run.child.killed && run.child.exitCode === null) run.child.kill('SIGKILL');
    }
  });

  it('proves SIGKILL after the same runtime result and eligible push converges on cleanup', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-process-forced-');
    const run = spawnHost({ baseDirectory, mode: 'forced' });
    try {
      await expect(awaitExit(run)).resolves.toMatchObject({ code: 0, signal: null });
      expectProof(run.records, 'forced');
      await expect(readdir(baseDirectory)).resolves.toEqual([]);
    } finally {
      if (!run.child.killed && run.child.exitCode === null) run.child.kill('SIGKILL');
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('does not let forged child stdout create host service or push proof', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-process-forged-');
    try {
      await expectFailedProof(baseDirectory, 'forged');
    } finally {
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it.each(['malformed', 'duplicate', 'unterminated', 'oversize'] as const)(
    'rejects %s child control output and preserves caller-owned cleanup boundaries',
    async (testCase) => {
      const baseDirectory = await mkdtemp(`/tmp/k-ipc-process-${testCase}-`);
      try {
        await expectFailedProof(baseDirectory, testCase);
      } finally {
        await rm(baseDirectory, { recursive: true, force: true });
      }
    },
  );

  it('keeps the raw napplet Node-only and the reference host on public seams', async () => {
    const [rawNapplet, referenceHost] = await Promise.all([readFile(childPath, 'utf8'), readFile(hostPath, 'utf8')]);
    const imports = [...rawNapplet.matchAll(/(?:import\s+(?:[^'";]+?\s+from\s+)?|import\()(['"])([^'"]+)\1/g)].map((match) => match[2]);

    expect(imports).toEqual(['node:net']);
    expect(rawNapplet).toContain('0x1e');
    expect(rawNapplet).not.toMatch(/\b(?:require|createRequire)\b|@kehto|@napplet|window\.|postMessage|tauri|electron|shell-ipc|napplet.*(?:sdk|client|helper)/i);
    expect(referenceHost).toContain("from '@kehto/shell-ipc'");
    expect(referenceHost).not.toMatch(/@kehto\/shell-ipc\/src|\.\/src\/|injectEvent|\.send\(/);
  });
});
