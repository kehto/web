import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hostPath = resolve(process.cwd(), 'packages/shell-ipc/examples/ipc-projection-reference-host.mjs');
const childPath = resolve(process.cwd(), 'packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs');

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

function spawnHost(baseDirectory: string, mode: 'graceful' | 'forced'): HostRun {
  const child = spawn(process.execPath, [hostPath, '--base-dir', baseDirectory, '--mode', mode], {
    stdio: ['ignore', 'pipe', 'pipe'],
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
  const result = records.findIndex((record) => record.source === 'child' && record.milestone === 'result' && record.id === 'ipc-proof-available');
  const push = recordIndex(records, 'host', 'context-push');
  const receivedPush = recordIndex(records, 'child', 'intent.changed');
  const cleanup = records.filter((record) => record.source === 'host' && record.milestone === 'cleanup');

  expect(init).toBeGreaterThanOrEqual(0);
  expect(records.filter((record) => record.source === 'child' && record.milestone === 'shell.init')).toHaveLength(1);
  expect(result).toBeGreaterThan(init);
  expect(push).toBeGreaterThan(result);
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

describe('IPC projection raw-process proof', () => {
  it('proves the graceful public-ESM host, exact shell lifecycle, runtime result, and eligible push', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-process-graceful-');
    const run = spawnHost(baseDirectory, 'graceful');
    try {
      await expect(awaitExit(run)).resolves.toMatchObject({ code: 0, signal: null });
      expectProof(run.records, 'graceful');
      await expect(readdir(baseDirectory)).resolves.toEqual([]);
    } finally {
      if (!run.child.killed && run.child.exitCode === null) run.child.kill('SIGKILL');
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('proves SIGKILL after the same runtime result and eligible push converges on cleanup', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-process-forced-');
    const run = spawnHost(baseDirectory, 'forced');
    try {
      await expect(awaitExit(run)).resolves.toMatchObject({ code: null, signal: 'SIGKILL' });
      expectProof(run.records, 'forced');
      await expect(readdir(baseDirectory)).resolves.toEqual([]);
    } finally {
      if (!run.child.killed && run.child.exitCode === null) run.child.kill('SIGKILL');
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('keeps the raw napplet Node-only and the reference host on public seams', async () => {
    const [rawNapplet, referenceHost] = await Promise.all([readFile(childPath, 'utf8'), readFile(hostPath, 'utf8')]);
    const imports = [...rawNapplet.matchAll(/(?:import\s+(?:[^'";]+?\s+from\s+)?|import\()(['"])([^'"]+)\1/g)].map((match) => match[2]);

    expect(imports).toContain('node:net');
    expect(imports).not.toHaveLength(0);
    expect(imports.every((specifier) => specifier.startsWith('node:'))).toBe(true);
    expect(rawNapplet).toContain('0x1e');
    expect(rawNapplet).not.toMatch(/@kehto|@napplet|window\.|postMessage|tauri|electron/i);
    expect(referenceHost).toContain("from '@kehto/shell-ipc'");
    expect(referenceHost).not.toMatch(/@kehto\/shell-ipc\/src|\.\/src\/|injectEvent|\.send\(/);
  });
});
