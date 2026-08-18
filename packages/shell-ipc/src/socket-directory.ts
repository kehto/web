import { chmod, lstat, mkdtemp, realpath, rmdir, unlink } from 'node:fs/promises';
import { connect, type Server } from 'node:net';
import { basename, join, relative, resolve } from 'node:path';
import { IpcTransportError } from './types.js';

const SOCKET_BASENAME = 'endpoint.sock';
const DIRECTORY_PREFIX = 'k-';

/** Immutable filesystem identity retained for an endpoint-owned path. */
export interface PathFingerprint {
  readonly dev: number;
  readonly ino: number;
  readonly mode: number;
}

/** Testable narrow hook used to prove compare-before-unlink behavior. */
export interface StaleSocketRetryOptions {
  readonly beforeUnlink?: () => void | Promise<void>;
}

/** Private directory handle owned by exactly one endpoint generation. */
export interface SocketDirectory {
  readonly directory: string;
  readonly path: string;
  readonly generation: number;
  recordSocket(): Promise<void>;
  listen(server: Server): Promise<void>;
  retryStaleSocket(options?: StaleSocketRetryOptions): Promise<void>;
  close(): Promise<void>;
}

/**
 * Create a private, owned directory for one experimental Unix socket endpoint.
 * The host-held pathname is connection information, not peer authentication.
 */
export async function createSocketDirectory(
  baseDirectory: string,
  maxPathBytes: number,
  generation = 0,
): Promise<SocketDirectory> {
  const base = await realpath(resolve(baseDirectory));
  const directory = await mkdtemp(join(base, DIRECTORY_PREFIX));
  const path = join(directory, SOCKET_BASENAME);
  let directoryFingerprint: PathFingerprint | undefined;

  try {
    await chmod(directory, 0o700);
    directoryFingerprint = await fingerprintPath(directory);
    if (!isPrivateDirectory(directoryFingerprint)) {
      throw new IpcTransportError('PATH_OWNERSHIP_MISMATCH', 'IPC endpoint directory is not mode 0700.');
    }
    assertContainedPath(base, directory);
    assertContainedPath(directory, path);
    if (basename(path) !== SOCKET_BASENAME || Buffer.byteLength(path, 'utf8') > maxPathBytes) {
      throw new IpcTransportError('PATH_TOO_LONG', 'IPC socket pathname exceeds the configured byte limit.');
    }
  } catch (error) {
    await rmdir(directory).catch(() => undefined);
    throw error;
  }

  let socketFingerprint: PathFingerprint | undefined;
  let closePromise: Promise<void> | undefined;
  let closed = false;

  const assertOwnedDirectory = async (): Promise<void> => {
    assertContainedPath(base, directory);
    const current = await readFingerprint(directory);
    if (!current) return;
    if (!current.isDirectory || !sameFingerprint(directoryFingerprint, current.fingerprint)) {
      throw new IpcTransportError('PATH_SUBSTITUTED', 'IPC endpoint directory no longer matches its owned fingerprint.');
    }
  };

  const recordSocket = async (): Promise<void> => {
    await assertOwnedDirectory();
    const current = await readFingerprint(path);
    if (!current || !current.isSocket) {
      throw new IpcTransportError('PATH_OWNERSHIP_MISMATCH', 'IPC listener did not create an owned Unix socket.');
    }
    socketFingerprint = current.fingerprint;
  };

  const retryStaleSocket = async (options: StaleSocketRetryOptions = {}): Promise<void> => {
    await assertOwnedDirectory();
    if (!socketFingerprint) {
      throw new IpcTransportError('PATH_OWNERSHIP_MISMATCH', 'No owned socket fingerprint is available for stale recovery.');
    }
    const current = await readFingerprint(path);
    if (!current || !current.isSocket || !sameFingerprint(socketFingerprint, current.fingerprint)) {
      throw new IpcTransportError('PATH_SUBSTITUTED', 'IPC socket no longer matches its recorded owned fingerprint.');
    }
    if (await probeSocketLiveness(path)) {
      throw new IpcTransportError('PATH_OWNERSHIP_MISMATCH', 'Refusing to remove an active IPC socket.');
    }
    await options.beforeUnlink?.();
    await assertOwnedDirectory();
    const unchanged = await readFingerprint(path);
    if (!unchanged || !unchanged.isSocket || !sameFingerprint(socketFingerprint, unchanged.fingerprint)) {
      throw new IpcTransportError('PATH_SUBSTITUTED', 'IPC socket changed after stale liveness probing.');
    }
    await unlink(path);
    socketFingerprint = undefined;
  };

  const listen = async (server: Server): Promise<void> => {
    try {
      await listenServer(server, path);
    } catch (error) {
      if (!isAddressInUse(error)) throw error;
      await retryStaleSocket();
      await listenServer(server, path);
    }
    await recordSocket();
  };

  const close = async (): Promise<void> => {
    if (closed) return;
    await assertOwnedDirectory();
    const socket = await readFingerprint(path);
    if (socket) {
      if (!socketFingerprint || !socket.isSocket) {
        throw new IpcTransportError('PATH_OWNERSHIP_MISMATCH', 'Refusing to remove an unrecorded or non-socket IPC path.');
      }
      if (!sameFingerprint(socketFingerprint, socket.fingerprint)) {
        throw new IpcTransportError('PATH_SUBSTITUTED', 'IPC socket no longer matches its recorded owned fingerprint.');
      }
      await unlink(path);
      socketFingerprint = undefined;
    }
    await assertOwnedDirectory();
    await rmdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return;
      if (error.code === 'ENOTEMPTY') {
        throw new IpcTransportError('PATH_OWNERSHIP_MISMATCH', 'Refusing to remove a non-empty IPC endpoint directory.');
      }
      throw error;
    });
    closed = true;
  };

  return {
    directory,
    path,
    generation,
    recordSocket,
    listen,
    retryStaleSocket,
    close() {
      closePromise ??= close();
      return closePromise;
    },
  };
}

/** Read a path's device, inode, and mode without following a symbolic link. */
export async function fingerprintPath(path: string): Promise<PathFingerprint> {
  const current = await lstat(path);
  return { dev: current.dev, ino: current.ino, mode: current.mode };
}

/** Compare immutable path identities. */
export function sameFingerprint(left: PathFingerprint, right: PathFingerprint): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

/** Refuse paths that escape an already-resolved owned root. */
export function assertContainedPath(root: string, candidate: string): void {
  const relativePath = relative(root, candidate);
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${join('')}`) || relativePath.startsWith('../')) {
    throw new IpcTransportError('PATH_OWNERSHIP_MISMATCH', 'IPC path escapes its owned directory.');
  }
}

/** Probe whether a Unix socket accepts a local connection without trusting a pathname as identity. */
export function probeSocketLiveness(path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    const finish = (value: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', (error: NodeJS.ErrnoException) => {
      socket.removeAllListeners();
      socket.destroy();
      if (error.code === 'ECONNREFUSED') {
        resolve(false);
        return;
      }
      reject(new IpcTransportError('PATH_OWNERSHIP_MISMATCH', `IPC socket liveness probe failed: ${error.code ?? error.message}`));
    });
  });
}

async function readFingerprint(path: string): Promise<{ readonly fingerprint: PathFingerprint; readonly isDirectory: boolean; readonly isSocket: boolean } | undefined> {
  try {
    const current = await lstat(path);
    return {
      fingerprint: { dev: current.dev, ino: current.ino, mode: current.mode },
      isDirectory: current.isDirectory(),
      isSocket: current.isSocket(),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function isPrivateDirectory(fingerprint: PathFingerprint): boolean {
  return (fingerprint.mode & 0o777) === 0o700;
}

function isAddressInUse(error: unknown): error is NodeJS.ErrnoException {
  return (error as NodeJS.ErrnoException).code === 'EADDRINUSE';
}

function listenServer(server: Server, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, () => {
      server.off('error', reject);
      resolve();
    });
  });
}
