import { chmod, mkdtemp, rmdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export interface SocketDirectory {
  readonly directory: string;
  readonly path: string;
  close(): Promise<void>;
}

/** Create a private, owned directory for one experimental Unix socket endpoint. */
export async function createSocketDirectory(baseDirectory: string, maxPathBytes: number): Promise<SocketDirectory> {
  const directory = await mkdtemp(join(baseDirectory, 'kehto-ipc-'));
  await chmod(directory, 0o700);
  const path = join(directory, 'endpoint.sock');
  if (Buffer.byteLength(path, 'utf8') > maxPathBytes) {
    await rmdir(directory);
    throw new Error('IPC socket pathname exceeds the configured byte limit.');
  }

  let closed = false;
  return {
    directory,
    path,
    async close() {
      if (closed) return;
      closed = true;
      await unlink(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
      await rmdir(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    },
  };
}
