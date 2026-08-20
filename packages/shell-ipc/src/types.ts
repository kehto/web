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
 * Host-owned endpoint identity, validated as a finite acyclic JSON tree, then cloned and
 * recursively frozen before listener allocation.
 * No member is accepted from a peer or represents peer-selected session state.
 */
export interface IpcEndpointRegistration {
  readonly windowId: string;
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly environment: { readonly [key: string]: IpcEnvironmentValue };
}

/** Immutable NAP-SHELL environment bound by the host before an IPC peer connects. */
export interface IpcShellEnvironment {
  readonly [key: string]: IpcEnvironmentValue;
  readonly capabilities: IpcShellCapabilities;
  readonly services: readonly string[];
}

/** Immutable capability shape required by the IPC NAP-SHELL projection. */
export interface IpcShellCapabilities {
  readonly [key: string]: IpcEnvironmentValue;
  readonly domains: readonly string[];
}

/** IPC shell endpoint registration. */
export interface IpcShellEndpointRegistration extends Omit<IpcEndpointRegistration, 'environment'> {
  readonly environment: IpcShellEnvironment;
}

/** Machine-readable reasons an IPC endpoint or accepted peer cannot continue. */
export type IpcTransportErrorCode =
  | 'INVALID_REGISTRATION'
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
  | 'ENDPOINT_EXISTS'
  | 'TRANSPORT_CLOSED'
  | 'INVALID_LIMIT'
  | 'OUTBOUND_QUEUE_OVERFLOW'
  | 'OUTBOUND_WRITE_FAILED'
  | 'OUTBOUND_QUEUE_CLOSED'
  | 'PATH_TOO_LONG'
  | 'PATH_OWNERSHIP_MISMATCH'
  | 'PATH_SUBSTITUTED'
  | 'STALE_GENERATION'
  | 'CONCURRENT_PEER'
  | 'SHELL_READY_PAYLOAD_IGNORED';

/** Typed terminal error for the experimental IPC carrier. */
export class IpcTransportError extends Error {
  constructor(readonly code: IpcTransportErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'IpcTransportError';
  }
}

/** A redacted diagnostic associated only with host-held endpoint identity. */
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

/**
 * Opaque handle for one accepted IPC peer.
 *
 * It intentionally exposes only queue-bound canonical-envelope egress and terminal close;
 * peer identity, Socket ownership, connection tokens, and registration metadata remain host-private.
 */
export interface IpcPeerConnection {
  /**
   * Send one unchanged canonical envelope only to this accepted peer.
   *
   * @param envelope - A NIP-5D envelope to encode as one RFC 7464 frame.
   * @returns Nothing.
   */
  send(envelope: NappletMessage): void;
  /**
   * Idempotently close this peer's socket and queue.
   *
   * @returns Nothing.
   */
  close(): void;
}

/** Host callback invoked only after a canonical envelope clears carrier validation. */
export interface IpcEndpointHooks {
  /**
   * Decide whether an accepted peer may begin decoded ingress.
   *
   * @param peer - Opaque, queue-bound handle for the accepted peer.
   * @param registration - The frozen host registration for this endpoint.
   * @returns `false` to close the peer before decoded ingress; any other result admits it.
   */
  readonly onPeerConnected?: (peer: IpcPeerConnection, registration: IpcEndpointRegistration) => boolean | void;
  /**
   * Observe the exactly-once terminal lifecycle of an admitted peer.
   *
   * @param peer - Opaque handle for the terminal peer.
   * @param registration - The frozen host registration for this endpoint.
   * @returns Nothing.
   */
  readonly onPeerClosed?: (peer: IpcPeerConnection, registration: IpcEndpointRegistration) => void;
  /**
   * Receive a canonical envelope after carrier validation and peer admission.
   *
   * @param envelope - Unchanged canonical envelope decoded from the peer.
   * @param registration - The frozen host registration for this endpoint.
   * @param peer - Opaque handle for the source peer.
   * @returns Nothing.
   */
  readonly onEnvelope: (envelope: NappletMessage, registration: IpcEndpointRegistration, peer: IpcPeerConnection) => void;
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

/** Options shared by an experimental host-only IPC NAP-SHELL composition. */
export interface IpcShellCompositionOptions extends IpcTransportOptions {
  /** The host's public runtime adapter, composed with projection-local egress and domain gates. */
  readonly runtimeAdapter: import('@kehto/runtime').RuntimeAdapter;
}

/** Options for the backwards-compatible one-endpoint IPC NAP-SHELL convenience projection. */
export interface IpcShellProjectionOptions extends IpcShellCompositionOptions {
  /** Frozen host identity and NAP-SHELL environment; never peer-provided. */
  readonly registration: IpcShellEndpointRegistration;
}

/** A host-only endpoint registered through an IPC shell composition. */
export interface IpcShellEndpoint {
  /** Private host-held pathname for this endpoint. */
  readonly path: string;
  /** Immutable registration used to bind source identity and NAP-SHELL environment. */
  readonly registration: IpcShellEndpointRegistration;
  /**
   * Retire this endpoint's current session before closing its carrier resources.
   *
   * @returns A promise that resolves after the matching endpoint has been released.
   * @example
   * ```ts
   * await endpoint.close();
   * ```
   */
  close(): Promise<void>;
}

/** A shared Runtime with one dedicated host-owned IPC endpoint per registration. */
export interface IpcShellComposition {
  /** Public runtime instance shared by every endpoint in this composition. */
  readonly runtime: import('@kehto/runtime').Runtime;
  /**
   * Register one immutable host-bound endpoint on the shared runtime.
   *
   * @param registration - Host-owned identity and NAP-SHELL environment.
   * @returns A host-only endpoint lifecycle handle.
   * @example
   * ```ts
   * const endpoint = await composition.registerEndpoint(registration);
   * ```
   */
  registerEndpoint(registration: IpcShellEndpointRegistration): Promise<IpcShellEndpoint>;
  /**
   * Close the endpoint currently held for one host window identifier.
   *
   * @param windowId - A host-held registration identifier.
   * @returns A promise that resolves after matching lifecycle cleanup.
   */
  unregisterEndpoint(windowId: string): Promise<void>;
  /**
   * Close every current endpoint then destroy the shared runtime once.
   *
   * @returns A promise that resolves after all composition resources are released.
   */
  close(): Promise<void>;
}

/**
 * Host handle for one experimental Unix-socket NAP-SHELL projection.
 *
 * The IPC carrier topology is an explicit experimental spec gap checked against
 * `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`.
 */
export interface IpcShellProjection extends IpcShellEndpoint {
  /** Public runtime instance composed by this projection. */
  readonly runtime: import('@kehto/runtime').Runtime;
  /**
   * Close the projection's endpoint and owned transport resources.
   *
   * @returns A promise that resolves after carrier resources are released.
   * @example
   * ```ts
   * await projection.close();
   * ```
   */
  close(): Promise<void>;
}
