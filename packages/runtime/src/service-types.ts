/**
 * service-types.ts — service attachment contracts for the runtime.
 *
 * Split from types.ts; re-exported from there and from the package index.
 */

import type { NappletMessage } from '@napplet/core';
import type { Capability } from '@kehto/acl/capabilities';
import type { ExtensionCapability } from '@kehto/acl';
import type { ServiceDescriptor } from './types.js';

/**
 * Narrow runtime-owned access granted to a registered service.
 *
 * The context exposes current immutable identity values and policy-aware target
 * delivery without exposing the mutable session registry, ACL state, adapter
 * hooks, or raw transport.
 */
export interface ServiceRuntimeContext {
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
  hasCapability(windowId: string, capability: Capability | ExtensionCapability): boolean;
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
  /** Metadata describing this service. */
  descriptor: ServiceDescriptor;
  /**
   * Explicit inbound types for a domain outside the built-in dispatcher.
   * Each own key is an exact `domain.action` type; its value is an existing
   * ACL capability, an `x-<domain>:<action>` extension capability owned by the
   * same `x-` domain, or explicit `null` for no additional capability requirement.
   * `x-` domains accept only their own capabilities or `null`. Their reply is
   * exactly one `<type>.result` (carry errors inside it); `.error` envelopes and
   * repeated sends are dropped, so use `pushCapabilities` for anything else.
   * Omission keeps non-built-in services attachment-only. Built-in NAP routes
   * ignore this map and retain their canonical capability mapping.
   *
   * Extension dispatch also requires a live, unblocked source, an explicit
   * `RuntimeAdapter.isDomainAllowed` grant, and firewall admission. This map
   * neither injects a namespace binding nor grants any capability. The handler
   * owns payload validation and its extension's response contract.
   */
  messageCapabilities?: Readonly<Record<string, Capability | ExtensionCapability | null>>;
  /**
   * Explicit outbound host-initiated (push) types for an experimental `x-`
   * domain. Each own key is an exact `domain.event` type in this handler's own
   * domain; its value is an own-domain `x-<domain>:<action>` capability the
   * recipient must currently hold, or explicit `null`.
   *
   * Declared pushes are delivered only through this handler's
   * `ServiceRuntimeContext.sendToEligibleNapplet`, after the live-session,
   * domain-grant, block and ACL checks used for requests. Firewall admission
   * for pushes is the napplet's hard policy (`deny`/`ask` drop silently); pushes
   * do not consume its request rate budget or run content matchers. Undeclared
   * types, other domains, and built-in domains are never pushed through it.
   */
  pushCapabilities?: Readonly<Record<string, Capability | ExtensionCapability | null>>;
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
  /** Revoke live output when this endpoint loses a capability or is blocked. */
  onCapabilityRevoked?(windowId: string, capability: Capability | ExtensionCapability | null): void;
}

/**
 * Registry of services available to napplets.
 * Keys select exact wire domains for direct routing (e.g., 'notify').
 * Metadata/attachment alone does not expose a domain. Custom domains require
 * ServiceHandler.messageCapabilities and explicit host domain authorization.
 *
 * @example
 * ```ts
 * const services: ServiceRegistry = {
 *   notify: notificationHandler,
 * };
 * ```
 */
export type ServiceRegistry = Record<string, ServiceHandler>;
