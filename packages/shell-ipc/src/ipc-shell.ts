import { createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import type { NappletMessage } from '@napplet/core';
import { createEndpointRegistry } from './endpoint-registry.js';
import { createJsonSequenceDecoder, encodeJsonSequence, type JsonSequenceEnvelope } from './json-sequence.js';
import { createOutboundQueue, type OutboundQueue } from './outbound-queue.js';
import { createSocketDirectory } from './socket-directory.js';
import { IpcTransportError, type IpcEndpoint, type IpcEndpointRegistration, type IpcTransport, type IpcTransportErrorCode, type IpcTransportLimits, type IpcTransportOptions } from './types.js';

/** Experimental default resource bounds for the Node/POSIX-only IPC carrier. */
export const DEFAULT_IPC_LIMITS = Object.freeze({
  maxPathBytes: 90,
  maxFrameBytes: 1_048_576,
  maxBufferedInputBytes: 2_097_152,
  maxOutboundQueueFrames: 64,
  maxOutboundQueueBytes: 1_048_576,
});

/**
 * Create an experimental Node >=20/POSIX-only carrier for canonical envelopes.
 * Its private pathname is host-held connection information, not cryptographic peer authentication.
 *
 * @param options - Optional private-directory, carrier-limit, and diagnostic hooks.
 * @returns A transport that owns only endpoints registered through it.
 * @example
 * ```ts
 * const transport = await createIpcTransport();
 * ```
 */
export async function createIpcTransport(options: IpcTransportOptions = {}): Promise<IpcTransport> {
  const limits = validateTransportLimits(options.limits);
  const endpoints = createEndpointRegistry();
  let transportClosed = false;
  const diagnostic = (code: IpcTransportErrorCode, registration: IpcEndpointRegistration): void => {
    options.onDiagnostic?.({
      code,
      registration: { windowId: registration.windowId, dTag: registration.dTag, aggregateHash: registration.aggregateHash },
    });
  };
  const unregisterEndpoint = async (windowId: string): Promise<void> => {
    const record = endpoints.get(windowId);
    if (!record) return;
    if (record.endpoint) {
      await record.endpoint.close();
      return;
    }
    endpoints.rollbackRegistration(record.windowId, record.generation);
  };

  return {
    async registerEndpoint(input, hooks) {
      if (transportClosed) throw new IpcTransportError('TRANSPORT_CLOSED', 'IPC transport is closed.');
      const registration = cloneAndFreezeRegistration(input);
      const reservation = endpoints.reserveRegistration(registration);
      let directory: Awaited<ReturnType<typeof createSocketDirectory>> | undefined;
      let server: Server | undefined;
      try {
        directory = await createSocketDirectory(options.baseDirectory ?? tmpdir(), limits.maxPathBytes, reservation.generation);
        const activeDirectory = directory;
        const peers = new Map<Socket, OutboundQueue>();
        server = createServer((socket) => {
          const queue = createOutboundQueue(socket, {
            maxOutboundQueueFrames: limits.maxOutboundQueueFrames,
            maxOutboundQueueBytes: limits.maxOutboundQueueBytes,
            onTerminal(error) { diagnostic(error.code, registration); },
          });
          peers.set(socket, queue);
          socket.on('error', () => undefined);
          socket.on('close', () => { queue.close(); peers.delete(socket); });
          const rejectPeer = (code: IpcTransportErrorCode, message: string): void => {
            diagnostic(code, registration);
            socket.destroy(new IpcTransportError(code, message));
          };
          const decoder = createJsonSequenceDecoder({
            maxFrameBytes: limits.maxFrameBytes,
            maxBufferedInputBytes: limits.maxBufferedInputBytes,
            onEnvelope(envelope) {
              if (!assertNoPeerBindingClaims(envelope)) {
                throw new IpcTransportError('PEER_IDENTITY_CLAIM', 'IPC peer attempted to claim host-bound endpoint identity.');
              }
              hooks.onEnvelope(envelope as unknown as NappletMessage, registration);
            },
          });
          socket.on('data', (chunk: Buffer) => {
            try { decoder.push(chunk); } catch (error) {
              const failure = error instanceof IpcTransportError ? error : new IpcTransportError('INVALID_ENVELOPE', error instanceof Error ? error.message : 'Invalid IPC envelope.');
              rejectPeer(failure.code, failure.message);
            }
          });
          socket.on('end', () => {
            try { decoder.end(); } catch (error) {
              const failure = error instanceof IpcTransportError ? error : new IpcTransportError('TRUNCATED_FRAME', error instanceof Error ? error.message : 'Truncated IPC envelope.');
              rejectPeer(failure.code, failure.message);
            }
          });
        });
        let closePromise: Promise<void> | undefined;
        const closeEndpoint = (): Promise<void> => {
          closePromise ??= (async () => {
            const current = endpoints.beginClosing(reservation.windowId, reservation.generation);
            if (!current) return;
          for (const [peer, queue] of peers) {
            queue.close();
            peer.destroy();
          }
          peers.clear();
            await closeServer(server);
          await activeDirectory.close();
            endpoints.removeIfCurrentGeneration(reservation.windowId, reservation.generation);
          })();
          return closePromise;
        };
        const endpoint: IpcEndpoint = {
          path: activeDirectory.path,
          registration,
          send(envelope) {
            const frame = encodeJsonSequence(envelope);
            let failure: unknown;
            for (const queue of peers.values()) {
              try {
                queue.enqueue(frame);
              } catch (error) {
                failure ??= error;
              }
            }
            if (failure) throw failure;
          },
          close: closeEndpoint,
        };
        endpoints.activateRegistration(reservation, { directory: activeDirectory, server, endpoint, peers });
        if (transportClosed) throw new IpcTransportError('TRANSPORT_CLOSED', 'IPC transport is closed.');
        await activeDirectory.listen(server);
        return endpoint;
      } catch (error) {
        endpoints.rollbackRegistration(reservation.windowId, reservation.generation);
        await closeServer(server);
        await directory?.close();
        throw error;
      }
    },
    unregisterEndpoint,
    async close() {
      if (transportClosed) return;
      transportClosed = true;
      await Promise.all(endpoints.values().map((record) => unregisterEndpoint(record.windowId)));
    },
  };
}

function cloneAndFreezeRegistration(registration: IpcEndpointRegistration): IpcEndpointRegistration {
  validateEndpointRegistration(registration);
  try {
    return recursivelyFreeze(structuredClone(registration));
  } catch (error) {
    throw invalidRegistration(error instanceof Error ? error.message : 'could not be cloned.');
  }
}

function validateEndpointRegistration(registration: IpcEndpointRegistration): void {
  try {
    const record = assertPlainObject(registration, 'must be a plain object.');
    const fields = ['windowId', 'dTag', 'aggregateHash', 'environment'] as const;
    const propertyNames = Object.getOwnPropertyNames(record);
    if (Object.getOwnPropertySymbols(record).length > 0
      || propertyNames.length !== fields.length
      || !fields.every((field) => Object.hasOwn(record, field))) {
      throw invalidRegistration('must contain only windowId, dTag, aggregateHash, and environment.');
    }
    for (const field of ['windowId', 'dTag', 'aggregateHash'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(record, field);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') {
        throw invalidRegistration(`${field} must be an enumerable string property.`);
      }
    }
    const environment = Object.getOwnPropertyDescriptor(record, 'environment');
    if (!environment?.enumerable || !Object.hasOwn(environment, 'value')) {
      throw invalidRegistration('environment must be an enumerable property.');
    }
    assertPlainObject(environment.value, 'environment must be a plain object.');
    assertJsonValue(environment.value, new Set<object>());
  } catch (error) {
    if (error instanceof IpcTransportError) throw error;
    throw invalidRegistration(error instanceof Error ? error.message : 'is invalid.');
  }
}

function assertJsonValue(value: unknown, ancestors: Set<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw invalidRegistration('environment contains a non-finite number.');
  }
  if (typeof value !== 'object') throw invalidRegistration('environment contains a non-JSON value.');
  if (ancestors.has(value)) throw invalidRegistration('environment contains a cycle.');

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      assertJsonArray(value, ancestors);
      return;
    }
    const record = assertPlainObject(value, 'environment contains a non-plain object.');
    assertJsonObject(record, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

function assertJsonArray(value: unknown[], ancestors: Set<object>): void {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw invalidRegistration('environment contains a non-plain array.');
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw invalidRegistration('environment contains symbol properties.');
  }
  const propertyNames = Object.getOwnPropertyNames(value);
  if (propertyNames.length !== value.length + 1) {
    throw invalidRegistration('environment contains a sparse array or custom array properties.');
  }
  for (const name of propertyNames) {
    if (name === 'length') continue;
    if (!isArrayIndex(name, value.length)) {
      throw invalidRegistration('environment contains custom array properties.');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw invalidRegistration('environment contains an accessor or non-enumerable property.');
    }
    assertJsonValue(descriptor.value, ancestors);
  }
}

function assertJsonObject(value: Record<string, unknown>, ancestors: Set<object>): void {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw invalidRegistration('environment contains symbol properties.');
  }
  for (const name of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw invalidRegistration('environment contains an accessor or non-enumerable property.');
    }
    assertJsonValue(descriptor.value, ancestors);
  }
}

function assertPlainObject(value: unknown, reason: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object') throw invalidRegistration(reason);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw invalidRegistration(reason);
  return value as Record<string, unknown>;
}

function isArrayIndex(value: string, length: number): boolean {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === value;
}

function invalidRegistration(reason: string): IpcTransportError {
  return new IpcTransportError('INVALID_REGISTRATION', `IPC endpoint registration ${reason}`);
}

function assertNoPeerBindingClaims(envelope: JsonSequenceEnvelope): boolean {
  return !['windowId', 'dTag', 'aggregateHash', 'environment'].some((key) => Object.hasOwn(envelope, key));
}

function validateTransportLimits(overrides: Partial<IpcTransportLimits> | undefined): IpcTransportLimits {
  const limits: IpcTransportLimits = { ...DEFAULT_IPC_LIMITS, ...overrides };
  const positiveLimits = {
    maxPathBytes: limits.maxPathBytes,
    maxFrameBytes: limits.maxFrameBytes,
    maxBufferedInputBytes: limits.maxBufferedInputBytes,
  };
  const nonNegativeLimits = {
    maxOutboundQueueFrames: limits.maxOutboundQueueFrames,
    maxOutboundQueueBytes: limits.maxOutboundQueueBytes,
  };
  for (const [name, value] of Object.entries(positiveLimits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new IpcTransportError('INVALID_LIMIT', `${name} must be a positive safe integer.`);
    }
  }
  for (const [name, value] of Object.entries(nonNegativeLimits)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new IpcTransportError('INVALID_LIMIT', `${name} must be a non-negative safe integer.`);
    }
  }
  return limits;
}

function recursivelyFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) recursivelyFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function closeServer(server: Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve, reject) => server.close((error) => {
    if (!error || (error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
      resolve();
      return;
    }
    reject(error);
  }));
}
