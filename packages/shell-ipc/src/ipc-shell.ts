import { createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import type { NappletMessage } from '@napplet/core';
import { createJsonSequenceDecoder, encodeJsonSequence, type JsonSequenceEnvelope } from './json-sequence.js';
import { createOutboundQueue, type OutboundQueue } from './outbound-queue.js';
import { createSocketDirectory, type SocketDirectory } from './socket-directory.js';

/** Experimental default resource bounds for the Node/POSIX-only IPC carrier. */
export const DEFAULT_IPC_LIMITS = Object.freeze({
  maxPathBytes: 90,
  maxFrameBytes: 1_048_576,
  maxBufferedInputBytes: 2_097_152,
  maxOutboundQueueFrames: 64,
  maxOutboundQueueBytes: 1_048_576,
});

export type IpcTransportErrorCode = 'PEER_IDENTITY_CLAIM' | 'INVALID_ENVELOPE' | 'ENDPOINT_ALREADY_REGISTERED' | 'TRANSPORT_CLOSED';

/** Typed transport error for a terminal experimental IPC carrier condition. */
export class IpcTransportError extends Error {
  constructor(readonly code: IpcTransportErrorCode, message: string) {
    super(message);
    this.name = 'IpcTransportError';
  }
}

export interface IpcTransportLimits {
  readonly maxPathBytes: number;
  readonly maxFrameBytes: number;
  readonly maxBufferedInputBytes: number;
  readonly maxOutboundQueueFrames: number;
  readonly maxOutboundQueueBytes: number;
}

export type IpcEnvironmentValue = string | number | boolean | null | readonly IpcEnvironmentValue[] | { readonly [key: string]: IpcEnvironmentValue };

/** Host-owned metadata bound to an endpoint before any listener side effect. */
export interface IpcEndpointRegistration {
  readonly windowId: string;
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly environment: { readonly [key: string]: IpcEnvironmentValue };
}

export interface IpcDiagnostic {
  readonly code: IpcTransportErrorCode;
  readonly registration: Pick<IpcEndpointRegistration, 'windowId' | 'dTag' | 'aggregateHash'>;
}

export interface IpcTransportOptions {
  readonly baseDirectory?: string;
  readonly limits?: Partial<IpcTransportLimits>;
  readonly onDiagnostic?: (diagnostic: IpcDiagnostic) => void;
}

export interface IpcEndpointHooks {
  readonly onEnvelope: (envelope: NappletMessage, registration: IpcEndpointRegistration) => void;
}

export interface IpcEndpoint {
  readonly path: string;
  readonly registration: IpcEndpointRegistration;
  /**
   * Queue one canonical envelope for each connected peer in FIFO order.
   *
   * @param envelope - Canonical envelope to encode as one experimental RFC 7464 frame.
   * @returns Nothing.
   * @example
   * ```ts
   * endpoint.send({ type: 'shell.init' } as NappletMessage);
   * ```
   */
  send(envelope: NappletMessage): void;
  /**
   * Close the endpoint and its owned peers, listener, socket path, and directory.
   *
   * @returns A promise that resolves after owned resources are released.
   * @example
   * ```ts
   * await endpoint.close();
   * ```
   */
  close(): Promise<void>;
}

export interface IpcTransport {
  /**
   * Create one host-bound private socket endpoint.
   *
   * @param registration - Immutable host identity and environment metadata.
   * @param hooks - Synchronous canonical-envelope receiver.
   * @returns The host-only endpoint handle.
   * @example
   * ```ts
   * const endpoint = await transport.registerEndpoint(registration, hooks);
   * ```
   */
  registerEndpoint(registration: IpcEndpointRegistration, hooks: IpcEndpointHooks): Promise<IpcEndpoint>;
  /**
   * Remove one host-registered endpoint if it exists.
   *
   * @param windowId - Host-bound registration identity.
   * @returns A promise that resolves once any matching endpoint is closed.
   * @example
   * ```ts
   * await transport.unregisterEndpoint('window-1');
   * ```
   */
  unregisterEndpoint(windowId: string): Promise<void>;
  /**
   * Close every endpoint owned by this transport.
   *
   * @returns A promise that resolves after all owned resources are released.
   * @example
   * ```ts
   * await transport.close();
   * ```
   */
  close(): Promise<void>;
}

interface EndpointRecord {
  readonly server: Server;
  readonly directory: SocketDirectory;
  readonly endpoint: IpcEndpoint;
}

/**
 * Create an experimental Node >=20/POSIX-only carrier for canonical envelopes.
 * Its framing, lifecycle, limits, and trust boundary are projection policy—not normative NAP or NIP authority.
 * A private pathname is host-only connection information, not cryptographic peer authentication.
 *
 * @param options - Optional private-directory, carrier-limit, and diagnostic hooks.
 * @returns A transport that owns only the endpoints registered through it.
 * @example
 * ```ts
 * const transport = await createIpcTransport();
 * ```
 */
export async function createIpcTransport(options: IpcTransportOptions = {}): Promise<IpcTransport> {
  const limits: IpcTransportLimits = { ...DEFAULT_IPC_LIMITS, ...options.limits };
  const endpoints = new Map<string, EndpointRecord>();
  let transportClosed = false;

  const diagnostic = (code: IpcTransportErrorCode, registration: IpcEndpointRegistration): void => {
    options.onDiagnostic?.({
      code,
      registration: {
        windowId: registration.windowId,
        dTag: registration.dTag,
        aggregateHash: registration.aggregateHash,
      },
    });
  };

  const unregisterEndpoint = async (windowId: string): Promise<void> => {
    const record = endpoints.get(windowId);
    if (!record) return;
    await record.endpoint.close();
  };

  return {
    async registerEndpoint(input, hooks) {
      if (transportClosed) throw new IpcTransportError('TRANSPORT_CLOSED', 'IPC transport is closed.');
      if (endpoints.has(input.windowId)) {
        throw new IpcTransportError('ENDPOINT_ALREADY_REGISTERED', `IPC endpoint ${input.windowId} is already registered.`);
      }

      const registration = cloneAndFreezeRegistration(input);
      const directory = await createSocketDirectory(options.baseDirectory ?? tmpdir(), limits.maxPathBytes);
      const peers = new Map<Socket, OutboundQueue>();
      let endpointClosed = false;
      let server: Server;

      const closeEndpoint = async (): Promise<void> => {
        if (endpointClosed) return;
        endpointClosed = true;
        if (endpoints.get(registration.windowId)?.endpoint === endpoint) endpoints.delete(registration.windowId);
        for (const [peer, queue] of peers) {
          queue.close();
          peer.destroy();
        }
        peers.clear();
        await closeServer(server);
        await directory.close();
      };

      const endpoint: IpcEndpoint = {
        path: directory.path,
        registration,
        send(envelope) {
          const frame = encodeJsonSequence(envelope);
          for (const queue of peers.values()) queue.enqueue(frame);
        },
        close: closeEndpoint,
      };

      server = createServer((socket) => {
        const queue = createOutboundQueue(socket);
        peers.set(socket, queue);
        socket.on('error', () => undefined);
        socket.on('close', () => {
          queue.close();
          peers.delete(socket);
        });
        const rejectPeer = (code: IpcTransportErrorCode, message: string): void => {
          diagnostic(code, registration);
          socket.destroy(new IpcTransportError(code, message));
        };
        const decoder = createJsonSequenceDecoder({
          maxFrameBytes: limits.maxFrameBytes,
          maxBufferedInputBytes: limits.maxBufferedInputBytes,
          onEnvelope(envelope) {
            if (!assertNoPeerBindingClaims(envelope)) {
              rejectPeer('PEER_IDENTITY_CLAIM', 'IPC peer attempted to claim host-bound endpoint identity.');
              return;
            }
            hooks.onEnvelope(envelope as unknown as NappletMessage, registration);
          },
        });
        socket.on('data', (chunk: Buffer) => {
          try {
            decoder.push(chunk);
          } catch (error) {
            rejectPeer('INVALID_ENVELOPE', error instanceof Error ? error.message : 'Invalid IPC envelope.');
          }
        });
        socket.on('end', () => {
          try {
            decoder.end();
          } catch (error) {
            rejectPeer('INVALID_ENVELOPE', error instanceof Error ? error.message : 'Truncated IPC envelope.');
          }
        });
      });

      try {
        await listen(server, directory.path);
      } catch (error) {
        await directory.close();
        throw error;
      }
      endpoints.set(registration.windowId, { server, directory, endpoint });
      return endpoint;
    },
    unregisterEndpoint,
    async close() {
      if (transportClosed) return;
      transportClosed = true;
      await Promise.all([...endpoints.keys()].map(unregisterEndpoint));
    },
  };
}

/** Clone and recursively freeze host metadata before filesystem or listener allocation. */
export function cloneAndFreezeRegistration(registration: IpcEndpointRegistration): IpcEndpointRegistration {
  return recursivelyFreeze(structuredClone(registration));
}

/** Reject carrier-provided values that could replace host-bound endpoint identity. */
export function assertNoPeerBindingClaims(envelope: JsonSequenceEnvelope): boolean {
  return !['windowId', 'dTag', 'aggregateHash', 'environment'].some((key) => Object.hasOwn(envelope, key));
}

function recursivelyFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) recursivelyFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function listen(server: Server, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
