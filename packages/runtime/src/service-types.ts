import type { NappletMessage } from '@napplet/core';
import type { Capability } from '@kehto/acl/capabilities';
import type { PermissionRequirement } from '@kehto/firewall';
import type { ApprovalFailure, ApprovalOutcome, ApprovalSignal } from './approval-coordinator.js';
import type { ServiceDescriptor } from './types.js';

/** Immutable relay destination decision. */
export interface RelayOperationPlan {
  /** Canonical top-level operation that owns this decision. */
  readonly operation: 'subscribe' | 'query' | 'publish' | 'publishEncrypted';
  /** Normalized, deduplicated relay origins; never serialized on the NAP wire. */
  readonly relayUrls: readonly string[];
  /** True when execution only reads host-local data and opens no relay transport. */
  readonly localOnly: boolean;
}

/**
 * Relay service contract used by the runtime's plan/approve/execute boundary.
 * Planning must have no cache, socket, signer, or callback side effect.
 */
export interface RelayPlanningServiceHandler extends ServiceHandler {
  planRelayOperation(windowId: string, message: NappletMessage): RelayOperationPlan;
  executeRelayOperation(
    windowId: string,
    message: NappletMessage,
    plan: RelayOperationPlan,
    signal: ApprovalSignal,
    send: (message: NappletMessage) => void,
  ): void;
}

/** Narrow runtime check for the explicit relay planning contract. */
export function isRelayPlanningServiceHandler(value: ServiceHandler | undefined): value is RelayPlanningServiceHandler {
  return !!value
    && typeof (value as Partial<RelayPlanningServiceHandler>).planRelayOperation === 'function'
    && typeof (value as Partial<RelayPlanningServiceHandler>).executeRelayOperation === 'function';
}

/**
 * Narrow runtime-owned access granted to a registered service.
 *
 * The context exposes current immutable identity values and policy-aware target
 * delivery without exposing the mutable session registry, ACL state, adapter
 * hooks, or raw transport.
 */
export interface ServiceRuntimeContext {
  /**
   * Execute a validated operation under composed interface/resource/network grants.
   * The callback must capture immutable payloads and observe cancellation before
   * any later asynchronous side effect. Absent on hosts awaiting migration.
   * An optional request signal cancels this operation's prompt, queue wait, and
   * active callback without cancelling siblings. A late answer cannot grant access.
   */
  authorizeOperation?<T>(windowId: string, operation: string, requirements: readonly PermissionRequirement[],
    execute: (signal: ApprovalSignal) => T | Promise<T>, signal?: ApprovalSignal): Promise<ApprovalOutcome<T>>;
  /**
   * Resolve a currently registered window to its authenticated napplet dTag.
   *
   * @param windowId - Internal live window identifier.
   * @returns The authenticated dTag, or `undefined` when no live session exists.
   */
  resolveDTag(windowId: string): string | undefined;
  /**
   * List current registered window identifiers.
   *
   * @returns A fresh frozen snapshot of live window identifiers.
   */
  listWindowIds(): readonly string[];
  /**
   * Check a capability against the current source-bound ACL grant.
   *
   * @param windowId - Requesting live window.
   * @param capability - Capability to check for that source.
   * @returns `true` when the live source currently holds the grant.
   */
  hasCapability(windowId: string, capability: Capability): boolean;
  /**
   * Send a runtime-originated message after current recipient policy checks.
   *
   * The target must be a live source-bound session whose immutable environment
   * exposes the domain. Mapped recipient capabilities also require their current
   * ACL grant. GAMEPAD state has no invented recipient capability mapping.
   *
   * @param windowId - Intended live recipient window.
   * @param message - Runtime-originated NIP-5D envelope.
   * @returns `true` only when the message was delivered to the adapter.
   */
  sendToEligibleNapplet(windowId: string, message: NappletMessage): boolean;
}

/**
 * Handler for service-specific messages from napplets.
 * Services receive NIP-5D NappletMessage envelopes and respond via the `send` callback.
 * The same interface is used for all services regardless of what NAP domain they handle.
 *
 * @example
 * ```ts
 * const exampleHandler: ServiceHandler = {
 *   descriptor: { name: 'example', version: '1.0.0' },
 *   messageCapabilities: { 'example.ping': null },
 *   handleMessage(_windowId, message, send) {
 *     if (message.type === 'example.ping') {
 *       send({ type: 'example.pong' });
 *     }
 *   },
 * };
 * ```
 */
export interface ServiceHandler {
  /**
   * Project a denied registered extension request onto its host-owned contract.
   * Only exact declared requests reach this callback. Omission stays silent;
   * runtime never invents extension error envelopes. Retired sources get no reply.
   */
  onPermissionDenied?(windowId: string, message: NappletMessage, reason: ApprovalFailure,
    send: (message: NappletMessage) => void): void;
  /**
   * Cancel operations whose permissions changed while the source remains live.
   * Preserve replay history and send protocol-required terminal denials where
   * applicable. Older handlers fall back to onWindowDestroyed for cleanup.
   */
  onPermissionRevoked?(windowId: string): void;
  /** Metadata describing this service. */
  descriptor: ServiceDescriptor;
  /**
   * Explicit inbound types for a domain outside the built-in dispatcher.
   * Each own key is an exact `domain.action` type; its value is an existing
   * ACL capability or explicit `null` for no additional capability requirement.
   * Omission keeps non-built-in services attachment-only. Built-in NAP routes
   * ignore this map and retain their canonical capability mapping.
   *
   * Extension dispatch also requires a live, unblocked source, an explicit
   * `RuntimeAdapter.isDomainAllowed` grant, and firewall admission. This map
   * neither injects a namespace binding nor grants any capability. The handler
   * owns payload validation and its extension's response contract.
   */
  messageCapabilities?: Readonly<Record<string, Capability | null>>;
  /**
   * Attach this handler to one runtime instance.
   *
   * @param context - Narrow runtime-owned identity and recipient-send access.
   */
  onRegistered?(context: ServiceRuntimeContext): void;
  /** Release runtime attachment state when replaced, unregistered, or destroyed. */
  onUnregistered?(): void;
  /**
   * Handle a NIP-5D envelope from a napplet.
   *
   * @param windowId - The requesting napplet's window identifier
   * @param message - NappletMessage JSON envelope (e.g., { type: 'signer.signEvent', id, event })
   * @param send - Callback to send NappletMessage responses back to the napplet
   */
  handleMessage(
    windowId: string,
    message: NappletMessage,
    send: (msg: NappletMessage) => void,
  ): void;
  /**
   * Called when a napplet window is destroyed. Services should clean up
   * any state associated with the window.
   *
   * @param windowId - The destroyed napplet's window identifier
   */
  onWindowDestroyed?(windowId: string): void;
}

