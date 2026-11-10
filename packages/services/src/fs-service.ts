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
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';

type FsPermissionRequirement = Parameters<NonNullable<ServiceRuntimeContext['authorizeOperation']>>[2][number];

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
  pickFile(windowId: string, options?: FsPickOptions, signal?: ApprovalSignal): FsPickResult | Promise<FsPickResult>;
  pickFiles(windowId: string, options?: FsPickOptions, signal?: ApprovalSignal): FsPickResult | Promise<FsPickResult>;
  pickDirectory(windowId: string, options?: FsPickOptions, signal?: ApprovalSignal): FsPickResult | Promise<FsPickResult>;
  pickSaveFile(windowId: string, options?: FsPickOptions, signal?: ApprovalSignal): FsPickResult | Promise<FsPickResult>;
  stat(windowId: string, path: string, signal?: ApprovalSignal): FsMetadata | Promise<FsMetadata>;
  list(windowId: string, path: string, signal?: ApprovalSignal): FsDirectoryEntry[] | Promise<FsDirectoryEntry[]>;
  read(windowId: string, path: string, options?: FsReadOptions, signal?: ApprovalSignal): FsReadResult | Promise<FsReadResult>;
  write(windowId: string, path: string, data: string, options?: FsWriteOptions, signal?: ApprovalSignal): FsWriteResult | Promise<FsWriteResult>;
  mkdir(windowId: string, path: string, options?: FsMkdirOptions, signal?: ApprovalSignal): void | Promise<void>;
  remove(windowId: string, path: string, recursive?: boolean, signal?: ApprovalSignal): void | Promise<void>;
  move(windowId: string, fromPath: string, toPath: string, signal?: ApprovalSignal): void | Promise<void>;
  watch(
    windowId: string,
    path: string,
    options: FsWatchOptions | undefined,
    onChange: (change: FsBackendChange) => void,
    signal?: ApprovalSignal,
  ): FsBackendWatch | Promise<FsBackendWatch>;
  /** Revoke host-private picker handles and pending browser work for one source. */
  onPermissionRevoked?(windowId: string): void;
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
  readonly requirements: readonly FsPermissionRequirement[];
  handle?: FsBackendWatch;
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

function pathScope(value: unknown, directory = false): FsPermissionRequirement['scope'] | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('\\') || value.includes('%')
    || value.includes('?') || value.includes('#') || (value !== '/' && (value.endsWith('/') || value.includes('//')))) return null;
  const segments = value === '/' ? [] : value.slice(1).split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return { kind: directory ? 'directory' : 'exact', value };
}

function fsRequirements(operation: string, scopes: readonly FsPermissionRequirement['scope'][]): readonly FsPermissionRequirement[] {
  return [
    { category: 'interface', domain: 'fs', operation: 'access', scope: { kind: 'exact', value: 'fs' } },
    ...scopes.map((scope) => ({ category: 'resource' as const, domain: 'fs', operation, scope })),
  ];
}

function pickerRequirements(operation: string): readonly FsPermissionRequirement[] {
  return fsRequirements(operation, [{ kind: 'exact', value: `picker:${operation.slice(3)}` }]);
}

/**
 * Create a NAP-FS wire service over a runtime-owned backend.
 *
 * @param options - Filesystem backend.
 * @returns Service handler for `runtime.registerService('fs', handler)`.
 */
// aislop-ignore-next-line function-too-long -- Source generation, approval execution, and owned watches share one private lifecycle boundary.
export function createFsService(options: FsServiceOptions): FsService {
  if (!options?.backend) throw new Error('createFsService: options.backend is required');
  const watches = new Map<string, OwnedWatch>();
  const watchesByWindow = new Map<string, Set<string>>();
  const generations = new Map<string, symbol>();
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;

  function generationFor(windowId: string): symbol {
    let generation = generations.get(windowId);
    if (!generation) {
      generation = Symbol(windowId);
      generations.set(windowId, generation);
    }
    return generation;
  }

  function current(windowId: string, generation: symbol): boolean {
    return generations.get(windowId) === generation;
  }

  function warnLegacy(): void {
    if (warnedLegacy) return;
    warnedLegacy = true;
    console.warn('[FW-FS-LEGACY-001] Configure RuntimeAdapter.permissions and verified session permissionPrincipal; host-only filesystem authorization is deprecated. Warning once per service instance.');
  }

  function ownWatch(watchId: string, owned: OwnedWatch): void {
    watches.set(watchId, owned);
    let ids = watchesByWindow.get(owned.windowId);
    if (!ids) {
      ids = new Set();
      watchesByWindow.set(owned.windowId, ids);
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
    windowId: string,
    generation: symbol,
    send: (message: NappletMessage) => void,
    type: string,
    id: string,
    operationName: string,
    requirements: readonly FsPermissionRequirement[],
    operation: (signal?: ApprovalSignal) => unknown | Promise<unknown>,
    field?: string,
  ): void {
    void Promise.resolve()
      .then(async () => {
        if (!current(windowId, generation)) throw new FsServiceError('cancelled');
        if (!runtime?.authorizeOperation) {
          warnLegacy();
          return operation();
        }
        const approval = await runtime.authorizeOperation(windowId, operationName, requirements, async (signal) => {
          if (!current(windowId, generation) || signal.aborted) throw new FsServiceError('cancelled');
          const value = await operation(signal);
          if (!current(windowId, generation) || signal.aborted) throw new FsServiceError('cancelled');
          return value;
        });
        if (approval.status !== 'executed') throw new FsServiceError('policy-denied');
        return approval.value;
      })
      .then((value) => {
        if (!current(windowId, generation)) return;
        send({
        type,
        id,
        ...(field ? { [field]: value } : {}),
        } as NappletMessage);
      })
      .catch((error) => {
        if (current(windowId, generation)) send({ type, id, error: fsError(error) } as NappletMessage);
      });
  }

  function closeWindowWatches(windowId: string): void {
    for (const watchId of watchesByWindow.get(windowId) ?? []) {
      const owned = forgetWatch(watchId);
      if (owned?.handle) void Promise.resolve(owned.handle.close()).catch(() => undefined);
    }
  }

  return {
    descriptor: FS_DESCRIPTOR,

    onRegistered(context): void { runtime = context; },
    onUnregistered(): void { runtime = undefined; },

    handleMessage(windowId, message, send): void {
      const input = message as NappletMessage & Record<string, unknown>;
      const id = typeof input.id === 'string' ? input.id : '';
      const generation = generationFor(windowId);
      const exact = (value: unknown, operation: string, callback: (signal?: ApprovalSignal) => unknown | Promise<unknown>, type: string, field?: string) => {
        const scope = pathScope(value);
        if (!scope) { send({ type, id, error: 'invalid-path' } as NappletMessage); return; }
        result(windowId, generation, send, type, id, operation, fsRequirements(operation, [scope]), callback, field);
      };
      const directory = (value: unknown, operation: string, callback: (signal?: ApprovalSignal) => unknown | Promise<unknown>, type: string, field?: string) => {
        const scope = pathScope(value, true);
        if (!scope) { send({ type, id, error: 'invalid-path' } as NappletMessage); return; }
        result(windowId, generation, send, type, id, operation, fsRequirements(operation, [scope]), callback, field);
      };
      switch (input.type) {
        case 'fs.info':
          result(windowId, generation, send, 'fs.info.result', id, 'fs.info', fsRequirements('fs.info', [{ kind: 'exact', value: 'info' }]), () => options.backend.info(windowId), 'info');
          return;
        case 'fs.pickFile':
          result(windowId, generation, send, 'fs.pickFile.result', id, 'fs.pickFile', pickerRequirements('fs.pickFile'), (signal) => options.backend.pickFile(windowId, input.options as FsPickOptions | undefined, signal), 'result');
          return;
        case 'fs.pickFiles':
          result(windowId, generation, send, 'fs.pickFiles.result', id, 'fs.pickFiles', pickerRequirements('fs.pickFiles'), (signal) => options.backend.pickFiles(windowId, input.options as FsPickOptions | undefined, signal), 'result');
          return;
        case 'fs.pickDirectory':
          result(windowId, generation, send, 'fs.pickDirectory.result', id, 'fs.pickDirectory', pickerRequirements('fs.pickDirectory'), (signal) => options.backend.pickDirectory(windowId, input.options as FsPickOptions | undefined, signal), 'result');
          return;
        case 'fs.pickSaveFile':
          result(windowId, generation, send, 'fs.pickSaveFile.result', id, 'fs.pickSaveFile', pickerRequirements('fs.pickSaveFile'), (signal) => options.backend.pickSaveFile(windowId, input.options as FsPickOptions | undefined, signal), 'result');
          return;
        case 'fs.stat':
          exact(input.path, 'fs.stat', (signal) => options.backend.stat(windowId, input.path as string, signal), 'fs.stat.result', 'metadata');
          return;
        case 'fs.list':
          directory(input.path, 'fs.list', (signal) => options.backend.list(windowId, input.path as string, signal), 'fs.list.result', 'entries');
          return;
        case 'fs.read':
          exact(input.path, 'fs.read', (signal) => options.backend.read(windowId, input.path as string, input.options as FsReadOptions | undefined, signal), 'fs.read.result', 'result');
          return;
        case 'fs.write':
          exact(input.path, 'fs.write', (signal) => options.backend.write(windowId, input.path as string, input.data as string, input.options as FsWriteOptions | undefined, signal), 'fs.write.result', 'result');
          return;
        case 'fs.mkdir':
          directory(input.path, 'fs.mkdir', (signal) => options.backend.mkdir(windowId, input.path as string, input.options as FsMkdirOptions | undefined, signal), 'fs.mkdir.result');
          return;
        case 'fs.remove':
          exact(input.path, 'fs.remove', (signal) => options.backend.remove(windowId, input.path as string, input.recursive as boolean | undefined, signal), 'fs.remove.result');
          return;
        case 'fs.move': {
          const from = pathScope(input.fromPath);
          const to = pathScope(input.toPath);
          if (!from || !to) { send({ type: 'fs.move.result', id, error: 'invalid-path' } as NappletMessage); return; }
          const parent = to.value === '/' ? to : { kind: 'directory' as const, value: to.value.slice(0, to.value.lastIndexOf('/')) || '/' };
          result(windowId, generation, send, 'fs.move.result', id, 'fs.move', fsRequirements('fs.move', [from, parent]), (signal) => options.backend.move(windowId, input.fromPath as string, input.toPath as string, signal));
          return;
        }
        case 'fs.watch': {
          const scope = pathScope(input.path, true);
          if (!scope) { send({ type: 'fs.watch.result', id, error: 'invalid-path' } as NappletMessage); return; }
          const watchId = `fs-watch-${++watchCounter}`;
          const requirements = fsRequirements('fs.watch', [scope]);
          result(windowId, generation, send, 'fs.watch.result', id, 'fs.watch', requirements, async (signal) => {
            const owned: OwnedWatch = { windowId, requirements };
            ownWatch(watchId, owned);
            const handle = await options.backend.watch(
              windowId,
              input.path as string,
              input.options as FsWatchOptions | undefined,
              (change) => {
                if (watches.get(watchId) !== owned || owned.handle === undefined) return;
                send({ type: 'fs.changed', change: { ...change, watchId } } as NappletMessage);
              },
              signal,
            );
            if (watches.get(watchId) !== owned) {
              await Promise.resolve(handle.close()).catch(() => undefined);
              throw new FsServiceError('cancelled');
            }
            owned.handle = handle;
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
          result(windowId, generation, send, 'fs.unwatch.result', id, 'fs.unwatch', fsRequirements('fs.unwatch', [{ kind: 'exact', value: `watch:${watchId}` }]), () => forgotten?.handle?.close());
          return;
        }
        default:
          return;
      }
    },

    onWindowDestroyed(windowId): void {
      generations.delete(windowId);
      closeWindowWatches(windowId);
      options.backend.onWindowDestroyed?.(windowId);
    },

    onPermissionRevoked(windowId): void {
      closeWindowWatches(windowId);
      options.backend.onPermissionRevoked?.(windowId);
    },

    dispose(): void {
      for (const windowId of watchesByWindow.keys()) closeWindowWatches(windowId);
      generations.clear();
      options.backend.close?.();
    },
  };
}
