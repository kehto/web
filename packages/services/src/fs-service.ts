/**
 * NAP-FS service boundary for runtime-owned virtual filesystems.
 *
 * The service owns wire correlation and per-window watch identity. Backends own
 * virtual-path policy, authorization, persistence, picker mediation, and I/O.
 */

import type {
  FsChange,
  FsDirectoryEntry,
  FsError,
  FsInfo,
  FsMetadata,
  FsMkdirOptions,
  FsPickOptions,
  FsPickResult,
  FsReadOptions,
  FsReadResult,
  FsWatchOptions,
  FsWriteOptions,
  FsWriteResult,
  NappletMessage,
} from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

/** Change details emitted by a backend before the service adds its scoped watch id. */
export type FsBackendChange = Omit<FsChange, 'watchId'>;

/** Active backend watch handle. */
export interface FsBackendWatch {
  /** Stop the backing watch. Must be idempotent. */
  close(): void | Promise<void>;
}

/** Filesystem operations supplied to the NAP-FS service. */
export interface FsBackend {
  info(windowId: string): FsInfo | Promise<FsInfo>;
  pickFile(windowId: string, options?: FsPickOptions): FsPickResult | Promise<FsPickResult>;
  pickFiles(windowId: string, options?: FsPickOptions): FsPickResult | Promise<FsPickResult>;
  pickDirectory(windowId: string, options?: FsPickOptions): FsPickResult | Promise<FsPickResult>;
  pickSaveFile(windowId: string, options?: FsPickOptions): FsPickResult | Promise<FsPickResult>;
  stat(windowId: string, path: string): FsMetadata | Promise<FsMetadata>;
  list(windowId: string, path: string): FsDirectoryEntry[] | Promise<FsDirectoryEntry[]>;
  read(windowId: string, path: string, options?: FsReadOptions): FsReadResult | Promise<FsReadResult>;
  write(windowId: string, path: string, data: string, options?: FsWriteOptions): FsWriteResult | Promise<FsWriteResult>;
  mkdir(windowId: string, path: string, options?: FsMkdirOptions): void | Promise<void>;
  remove(windowId: string, path: string, recursive?: boolean): void | Promise<void>;
  move(windowId: string, fromPath: string, toPath: string): void | Promise<void>;
  watch(
    windowId: string,
    path: string,
    options: FsWatchOptions | undefined,
    onChange: (change: FsBackendChange) => void,
  ): FsBackendWatch | Promise<FsBackendWatch>;
  /** Release session-scoped backend state for a destroyed runtime window. */
  onWindowDestroyed?(windowId: string): void;
  /** Release all backend resources. */
  close?(): void;
}

/** Error with a closed NAP-FS wire reason. */
export class FsServiceError extends Error {
  constructor(readonly code: FsError, message = code) {
    super(message);
    this.name = 'FsServiceError';
  }
}

/** Options for {@link createFsService}. */
export interface FsServiceOptions {
  backend: FsBackend;
}

/** Created NAP-FS service. */
export interface FsService extends ServiceHandler {
  /** Close watches and backend resources. */
  dispose(): void;
}

interface OwnedWatch {
  readonly windowId: string;
  readonly handle: FsBackendWatch;
}

const FS_DESCRIPTOR: ServiceDescriptor = {
  name: 'fs',
  version: '1.0.0',
  description: 'NAP-FS runtime-owned virtual filesystem',
};

let watchCounter = 0;

function fsError(error: unknown): FsError {
  return error instanceof FsServiceError ? error.code : 'io-error';
}

/**
 * Create a NAP-FS wire service over a runtime-owned backend.
 *
 * @param options - Filesystem backend.
 * @returns Service handler for `runtime.registerService('fs', handler)`.
 */
export function createFsService(options: FsServiceOptions): FsService {
  if (!options?.backend) throw new Error('createFsService: options.backend is required');
  const watches = new Map<string, OwnedWatch>();
  const watchesByWindow = new Map<string, Set<string>>();

  function ownWatch(windowId: string, watchId: string, handle: FsBackendWatch): void {
    watches.set(watchId, { windowId, handle });
    let ids = watchesByWindow.get(windowId);
    if (!ids) {
      ids = new Set();
      watchesByWindow.set(windowId, ids);
    }
    ids.add(watchId);
  }

  function forgetWatch(watchId: string): OwnedWatch | undefined {
    const owned = watches.get(watchId);
    if (!owned) return undefined;
    watches.delete(watchId);
    const ids = watchesByWindow.get(owned.windowId);
    ids?.delete(watchId);
    if (ids?.size === 0) watchesByWindow.delete(owned.windowId);
    return owned;
  }

  function result(
    send: (message: NappletMessage) => void,
    type: string,
    id: string,
    operation: () => unknown | Promise<unknown>,
    field?: string,
  ): void {
    void Promise.resolve()
      .then(operation)
      .then((value) => send({
        type,
        id,
        ...(field ? { [field]: value } : {}),
      } as NappletMessage))
      .catch((error) => send({ type, id, error: fsError(error) } as NappletMessage));
  }

  function closeWindowWatches(windowId: string): void {
    for (const watchId of watchesByWindow.get(windowId) ?? []) {
      const owned = forgetWatch(watchId);
      if (owned) void Promise.resolve(owned.handle.close()).catch(() => undefined);
    }
  }

  return {
    descriptor: FS_DESCRIPTOR,

    handleMessage(windowId, message, send): void {
      const input = message as NappletMessage & Record<string, unknown>;
      const id = typeof input.id === 'string' ? input.id : '';
      switch (input.type) {
        case 'fs.info':
          result(send, 'fs.info.result', id, () => options.backend.info(windowId), 'info');
          return;
        case 'fs.pickFile':
          result(send, 'fs.pickFile.result', id, () => options.backend.pickFile(windowId, input.options as FsPickOptions | undefined), 'result');
          return;
        case 'fs.pickFiles':
          result(send, 'fs.pickFiles.result', id, () => options.backend.pickFiles(windowId, input.options as FsPickOptions | undefined), 'result');
          return;
        case 'fs.pickDirectory':
          result(send, 'fs.pickDirectory.result', id, () => options.backend.pickDirectory(windowId, input.options as FsPickOptions | undefined), 'result');
          return;
        case 'fs.pickSaveFile':
          result(send, 'fs.pickSaveFile.result', id, () => options.backend.pickSaveFile(windowId, input.options as FsPickOptions | undefined), 'result');
          return;
        case 'fs.stat':
          result(send, 'fs.stat.result', id, () => options.backend.stat(windowId, input.path as string), 'metadata');
          return;
        case 'fs.list':
          result(send, 'fs.list.result', id, () => options.backend.list(windowId, input.path as string), 'entries');
          return;
        case 'fs.read':
          result(send, 'fs.read.result', id, () => options.backend.read(windowId, input.path as string, input.options as FsReadOptions | undefined), 'result');
          return;
        case 'fs.write':
          result(send, 'fs.write.result', id, () => options.backend.write(windowId, input.path as string, input.data as string, input.options as FsWriteOptions | undefined), 'result');
          return;
        case 'fs.mkdir':
          result(send, 'fs.mkdir.result', id, () => options.backend.mkdir(windowId, input.path as string, input.options as FsMkdirOptions | undefined));
          return;
        case 'fs.remove':
          result(send, 'fs.remove.result', id, () => options.backend.remove(windowId, input.path as string, input.recursive as boolean | undefined));
          return;
        case 'fs.move':
          result(send, 'fs.move.result', id, () => options.backend.move(windowId, input.fromPath as string, input.toPath as string));
          return;
        case 'fs.watch': {
          const watchId = `fs-watch-${++watchCounter}`;
          result(send, 'fs.watch.result', id, async () => {
            const handle = await options.backend.watch(
              windowId,
              input.path as string,
              input.options as FsWatchOptions | undefined,
              (change) => {
                if (watches.get(watchId)?.windowId !== windowId) return;
                send({ type: 'fs.changed', change: { ...change, watchId } } as NappletMessage);
              },
            );
            ownWatch(windowId, watchId, handle);
            return watchId;
          }, 'watchId');
          return;
        }
        case 'fs.unwatch': {
          const watchId = typeof input.watchId === 'string' ? input.watchId : '';
          const owned = watches.get(watchId);
          if (!owned || owned.windowId !== windowId) {
            send({ type: 'fs.unwatch.result', id } as NappletMessage);
            return;
          }
          const forgotten = forgetWatch(watchId);
          result(send, 'fs.unwatch.result', id, () => forgotten?.handle.close());
          return;
        }
        default:
          return;
      }
    },

    onWindowDestroyed(windowId): void {
      closeWindowWatches(windowId);
      options.backend.onWindowDestroyed?.(windowId);
    },

    dispose(): void {
      for (const windowId of watchesByWindow.keys()) closeWindowWatches(windowId);
      options.backend.close?.();
    },
  };
}
