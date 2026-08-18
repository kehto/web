import { lstat, mkdir, mkdtemp, readFile, rename, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createServer, type Server } from 'node:net';
import { describe, expect, it } from 'vitest';
import { createSocketDirectory } from './socket-directory.js';

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function makeBase(prefix = 'kehto-ipc-test-'): Promise<string> {
  return mkdtemp(join('/tmp', prefix));
}

async function leaveRefusedSocket(path: string): Promise<void> {
  const script = [
    "const net = require('node:net');",
    `net.createServer().listen(${JSON.stringify(path)}, () => process.stdout.write('ready\\n'));`,
  ].join('');
  const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  await once(child.stdout, 'data');
  child.kill('SIGKILL');
  await once(child, 'exit');
  expect((await lstat(path)).isSocket()).toBe(true);
}

describe('createSocketDirectory', () => {
  it('creates unique mode-0700 directories with a fixed short basename', async () => {
    const base = await makeBase();
    const first = await createSocketDirectory(base, 90, 1);
    const second = await createSocketDirectory(base, 90, 2);

    try {
      expect(first.directory).not.toBe(second.directory);
      expect(first.path).toBe(join(first.directory, 'endpoint.sock'));
      expect(second.path).toBe(join(second.directory, 'endpoint.sock'));
      expect((await lstat(first.directory)).mode & 0o777).toBe(0o700);
      expect((await lstat(second.directory)).mode & 0o777).toBe(0o700);
    } finally {
      await first.close();
      await second.close();
      await rmdir(base);
    }
  });

  it('counts pathname limits in UTF-8 bytes at the exact threshold', async () => {
    const base = await makeBase('kehto-ipc-😀-');
    const probe = await createSocketDirectory(base, 1_024, 1);
    const exactBytes = Buffer.byteLength(probe.path, 'utf8');
    await probe.close();

    const exact = await createSocketDirectory(base, exactBytes, 2);
    try {
      expect(Buffer.byteLength(exact.path, 'utf8')).toBeLessThanOrEqual(exactBytes);
    } finally {
      await exact.close();
    }
    await expect(createSocketDirectory(base, exactBytes - 1, 3)).rejects.toMatchObject({ code: 'PATH_TOO_LONG' });
    await rmdir(base);
  });

  it('refuses to recover an active socket and leaves it present', async () => {
    const base = await makeBase();
    const directory = await createSocketDirectory(base, 90, 1);
    const server = createServer();

    try {
      await directory.listen(server);
      await expect(directory.retryStaleSocket()).rejects.toMatchObject({ code: 'PATH_OWNERSHIP_MISMATCH' });
      expect((await lstat(directory.path)).isSocket()).toBe(true);
    } finally {
      await closeServer(server);
      await directory.close();
      await rmdir(base);
    }
  });

  it('retries exactly one owned refused stale socket after unchanged lstat checks', async () => {
    const base = await makeBase();
    const directory = await createSocketDirectory(base, 90, 1);
    const replacement = createServer();

    try {
      await leaveRefusedSocket(directory.path);
      await directory.recordSocket();
      await directory.listen(replacement);
      expect((await lstat(directory.path)).isSocket()).toBe(true);
    } finally {
      await closeServer(replacement);
      await directory.close();
      await rmdir(base);
    }
  });

  it('leaves a regular file, symlink sentinel, and substituted socket untouched', async () => {
    const base = await makeBase();
    const sentinel = join(base, 'sentinel.txt');
    await writeFile(sentinel, 'do not unlink');

    const regular = await createSocketDirectory(base, 90, 1);
    try {
      await writeFile(regular.path, 'not a socket');
      await expect(regular.close()).rejects.toMatchObject({ code: 'PATH_OWNERSHIP_MISMATCH' });
      expect(await readFile(regular.path, 'utf8')).toBe('not a socket');
    } finally {
      await unlink(regular.path).catch(() => undefined);
      await regular.close().catch(() => undefined);
    }

    const linked = await createSocketDirectory(base, 90, 2);
    try {
      await symlink(sentinel, linked.path);
      await expect(linked.close()).rejects.toMatchObject({ code: 'PATH_OWNERSHIP_MISMATCH' });
      expect(await readFile(sentinel, 'utf8')).toBe('do not unlink');
      expect((await lstat(linked.path)).isSymbolicLink()).toBe(true);
    } finally {
      await unlink(linked.path).catch(() => undefined);
      await linked.close().catch(() => undefined);
    }

    const stale = await createSocketDirectory(base, 90, 3);
    try {
      await leaveRefusedSocket(stale.path);
      await stale.recordSocket();
      await expect(stale.retryStaleSocket({
        beforeUnlink: async () => {
          await unlink(stale.path);
          await writeFile(stale.path, 'substituted');
        },
      })).rejects.toMatchObject({ code: 'PATH_SUBSTITUTED' });
      expect(await readFile(stale.path, 'utf8')).toBe('substituted');
    } finally {
      await unlink(stale.path).catch(() => undefined);
      await stale.close().catch(() => undefined);
      await rmdir(stale.directory).catch(() => undefined);
    }

    await unlink(sentinel);
    await rmdir(regular.directory);
    await rmdir(linked.directory);
    await rmdir(base);
  });

  it('leaves a replacement directory untouched during owned cleanup', async () => {
    const base = await makeBase();
    const directory = await createSocketDirectory(base, 90, 1);
    const moved = `${directory.directory}-moved`;

    try {
      await rename(directory.directory, moved);
      await mkdir(directory.directory);
      await expect(directory.close()).rejects.toMatchObject({ code: 'PATH_SUBSTITUTED' });
      expect((await lstat(directory.directory)).isDirectory()).toBe(true);
    } finally {
      await rmdir(directory.directory).catch(() => undefined);
      await rmdir(moved).catch(() => undefined);
      await rmdir(base);
    }
  });
});
