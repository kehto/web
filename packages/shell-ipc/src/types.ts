import type { NappletMessage } from '@napplet/core';

/**
 * Experimental Node >=20/POSIX-only IPC carrier limits, measured in encoded bytes.
 * This projection was checked against `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, which defines no IPC carrier.
 * Private-directory containment and host-held pathname distribution are not cryptographic peer authentication or protection from hostile same-UID processes.
 */
export interface IpcTransportLimits {
  readonly maxPathBytes: number;
  readonly maxFrameBytes: number;
  readonly maxBufferedInputBytes: number;
  readonly maxOutboundQueueFrames: number;
  readonly maxOutboundQueueBytes: number;
}

/** JSON-compatible host environment metadata bound before a peer can connect. */
export type IpcEnvironmentValue = string | number | boolean | null | readonly IpcEnvironmentValue[] | { readonly [key: string]: IpcEnvironmentValue };

/**
 * Host-owned endpoint identity, cloned and recursively frozen before listener allocation.
 * No member is accepted from a peer or represents peer-selected session state.
 */
export interface IpcEndpointRegistration {
  readonly windowId: string;
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly environment: { readonly [key: string]: IpcEnvironmentValue };
}

/** Machine-readable reasons an IPC endpoint or accepted peer cannot continue. */
export type IpcTransportErrorCode =
  | 'PEER_IDENTITY_CLAIM'
  | 'INVALID_FRAMING'
  | 'INVALID_UTF8'
  | 'MALFORMED_JSON'
  | 'INVALID_ENVELOPE'
  | 'TRUNCATED_FRAME'
  | 'FRAME_TOO_LARGE'
  | 'INPUT_BUFFER_OVERFLOW'
  | 'DECODER_CLOSED'
  | 'ENDPOINT_ALREADY_REGISTERED'
  | 'TRANSPORT_CLOSED'
  | 'INVALID_LIMIT'
  | 'OUTBOUND_QUEUE_OVERFLOW'
  | 'OUTBOUND_WRITE_FAILED'
  | 'OUTBOUND_QUEUE_CLOSED';

/** Typed terminal error for the experimental IPC carrier. */
export class IpcTransportError extends Error {
  constructor(readonly code: IpcTransportErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'IpcTransportError';
  }
}

/** A redacted terminal diagnostic associated only with host-held endpoint identity. */
export interface IpcDiagnostic {
  readonly code: IpcTransportErrorCode;
  readonly registration: Pick<IpcEndpointRegistration, 'windowId' | 'dTag' | 'aggregateHash'>;
}

/** Options for an experimental Node >=20/POSIX-only transport. */
export interface IpcTransportOptions {
  readonly baseDirectory?: string;
  readonly limits?: Partial<IpcTransportLimits>;
  readonly onDiagnostic?: (diagnostic: IpcDiagnostic) => void;
}

/** Host callback invoked only after a canonical envelope clears carrier validation. */
export interface IpcEndpointHooks {
  readonly onEnvelope: (envelope: NappletMessage, registration: IpcEndpointRegistration) => void;
}

/** A host-owned private endpoint; no client helper or peer identity input is exposed. */
export interface IpcEndpoint {
  readonly path: string;
  readonly registration: IpcEndpointRegistration;
  /**
   * Queue one canonical envelope for every connected peer in FIFO order.
   *
   * @param envelope - Canonical envelope encoded as one experimental RFC 7464 frame.
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

/** Experimental Node >=20/POSIX-only host transport API. */
export interface IpcTransport {
  /**
   * Create one endpoint using immutable host metadata captured before listening.
   *
   * @param registration - Host-owned identity and environment metadata.
   * @param hooks - Synchronous canonical-envelope receiver.
   * @returns A host-only endpoint handle.
   * @example
   * ```ts
   * const endpoint = await transport.registerEndpoint(registration, hooks);
   * ```
   */
  registerEndpoint(registration: IpcEndpointRegistration, hooks: IpcEndpointHooks): Promise<IpcEndpoint>;
  /**
   * Close one host-registered endpoint when it exists.
   *
   * @param windowId - Host-held registration identifier.
   * @returns A promise that resolves after matching owned resources are released.
   * @example
   * ```ts
   * await transport.unregisterEndpoint('window-1');
   * ```
   */
  unregisterEndpoint(windowId: string): Promise<void>;
  /**
   * Close all endpoints owned by this transport.
   *
   * @returns A promise that resolves after owned resources are released.
   * @example
   * ```ts
   * await transport.close();
   * ```
   */
  close(): Promise<void>;
}
