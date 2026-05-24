// @kehto/shell — Shell-specific types and hook interfaces.
// Protocol types (NostrEvent, NostrFilter, Capability, constants) are imported from @napplet/core.

// Protocol types and constants re-exported from @napplet/core and @kehto/runtime.
// Phase 24 DRIFT-01: the former @napplet/core compatibility shim has been
// deleted; legacy NIP-01 constants (BusKind, AUTH_KIND, DESTRUCTIVE_KINDS,
// SHELL_BRIDGE_URI, PROTOCOL_VERSION, REPLAY_WINDOW_SECONDS, legacy
// BusKind-value union) are no longer re-exported. Shell internals that need
// IFC_PEER=29000 inline the numeric locally.
export type { NostrEvent, NostrFilter } from '@napplet/core';
export type { Capability, ServiceDescriptor } from '@kehto/runtime';
export { ALL_CAPABILITIES } from '@kehto/runtime';
export type { NappletMessage } from '@napplet/core';

// Import Capability type locally for use in this file's shell-specific types
import type { NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';
import type { Capability, RuntimeConfigOverrides, ServiceHandler, ServiceRegistry } from '@kehto/runtime';
import type { NappletClass } from './types/internal-class.js';

// Re-export service types so shell consumers can still import from @kehto/shell
// (ServiceDescriptor already re-exported above from @kehto/runtime).
export type { ServiceHandler, ServiceRegistry };

/**
 * Registry entry mapping a napplet's session identity to runtime metadata.
 * Created after NIP-5D iframe-origin registration.
 * @example
 * ```ts
 * const entry: SessionEntry = {
 *   pubkey: 'abc123...', windowId: 'win-1', origin: '*',
 *   type: 'chat', dTag: '3chat', aggregateHash: 'deadbeef',
 *   registeredAt: Date.now(), instanceId: 'guid-123',
 *   provenance: 'legacy-auth',
 * };
 * ```
 */
export interface SessionEntry {
  /**
   * @deprecated NIP-5D: AUTH keypair no longer exists. Empty string for NIP-5D sessions.
   * Kept for backward compatibility during legacy support period.
   */
  pubkey: string;
  windowId: string;
  origin: string;
  type: string;
  dTag: string;
  aggregateHash: string;
  registeredAt: number;
  /** Persistent GUID for this iframe instance, assigned by the runtime. Survives page reloads. */
  instanceId: string;
  /**
   * How session identity was established (RENAME-01, v1.8 Phase 42).
   * 'nip-5d' = identity registered at iframe creation via originRegistry (canonical NIP-5D path).
   * 'legacy-auth' = legacy AUTH handshake (pubkey is the derived keypair pubkey).
   * Renamed from `identitySource: 'auth' | 'source'` in v1.8; see .changeset/v1-8-rename-01-session-provenance.md.
   */
  provenance: 'nip-5d' | 'legacy-auth';
  /**
   * Class posture resolved synchronously at iframe creation (CLASS-02).
   * `null` is the permissive default (D2). Class tokens like 'class-1' /
   * 'class-2' are NUB-defined. See packages/shell/src/types/internal-class.ts.
   */
  class: NappletClass;
}

/** @deprecated Use SessionEntry. Will be removed in v0.9.0. */
export type NappKeyEntry = SessionEntry;

/**
 * ACL entry controlling what a napplet pubkey is permitted to do.
 * @example
 * ```ts
 * const entry: AclEntry = {
 *   pubkey: 'abc123...', capabilities: ['relay:read', 'relay:write'],
 *   blocked: false, stateQuota: 524288,
 * };
 * ```
 */
export interface AclEntry {
  pubkey: string;
  capabilities: Capability[];
  blocked: boolean;
  stateQuota?: number;
}

/**
 * Hook for relay pool operations. Host app provides relay connectivity.
 * @example
 * ```ts
 * const relayPoolHooks: RelayPoolHooks = {
 *   getRelayPool: () => myPool,
 *   trackSubscription: (key, cleanup) => subscriptions.set(key, cleanup),
 *   // ...
 * };
 * ```
 */
export interface RelayPoolHooks {
  /** Get the relay pool instance — returns null if no pool available. */
  getRelayPool(): RelayPoolLike | null;
  /** Track a subscription for lifecycle management. */
  trackSubscription(subKey: string, cleanup: () => void): void;
  /** Untrack and clean up a subscription. */
  untrackSubscription(subKey: string): void;
  /** Open a scoped relay connection (NIP-29 groups). */
  openScopedRelay(windowId: string, relayUrl: string, subId: string, filters: NostrFilter[], sourceWindow: Window): void;
  /** Close a scoped relay connection. */
  closeScopedRelay(windowId: string): void;
  /** Publish to a scoped relay. Returns false if no active scoped relay. */
  publishToScopedRelay(windowId: string, event: NostrEvent): boolean;
  /** Select relay URLs for a given set of filters. */
  selectRelayTier(filters: NostrFilter[]): string[];
}

/** Minimal relay pool interface that the shell requires. */
export interface RelayPoolLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscription(relayUrls: string[], filters: any): { subscribe(observer: (item: unknown) => void): { unsubscribe(): void } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publish(relayUrls: string[], event: any): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request(relayUrls: string[], filters: any): { subscribe(observer: { next: (event: unknown) => void; complete: () => void; error: () => void }): { unsubscribe(): void } };
}

/** Hook for relay configuration. */
export interface RelayConfigHooks {
  /** Add a relay URL to a named tier. */
  addRelay(tier: string, url: string): void;
  /** Remove a relay URL from a named tier. */
  removeRelay(tier: string, url: string): void;
  /** Get the current relay configuration by tier. */
  getRelayConfig(): { discovery: string[]; super: string[]; outbox: string[] };
  /** Get NIP-66 relay suggestions. */
  getNip66Suggestions(): unknown;
}

/** Hook for window management. */
export interface WindowManagerHooks {
  /** Create a new window. Returns the window ID or null on failure. */
  createWindow(options: { title: string; class: string; iframeSrc?: string }): string | null;
}

/** Hook for auth state and signing. */
export interface AuthHooks {
  /** Get the current user's pubkey, or null if not logged in. */
  getUserPubkey(): string | null;
  /** Get the NIP-07 compatible signer, or null if unavailable. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSigner(): any | null;
}

/** Hook for config. */
export interface ConfigHooks {
  /** Get the napp update behavior policy. */
  getNappUpdateBehavior(): 'auto-grant' | 'banner' | 'silent-reprompt';
}

/** Hook for hotkey dispatch. */
export interface HotkeyHooks {
  /** Execute a forwarded hotkey from a napp. */
  executeHotkeyFromForward(event: {
    key: string;
    code: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
  }): void;
}

/** Hook for worker relay (local cache). */
export interface WorkerRelayHooks {
  /** Get the worker relay instance, or null if unavailable. */
  getWorkerRelay(): WorkerRelayLike | null;
}

/** Minimal worker relay interface. */
export interface WorkerRelayLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event(event: NostrEvent): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(req: any): Promise<NostrEvent[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count?(req: any): Promise<number>;
}

/** Hook for crypto verification. */
export interface CryptoHooks {
  /** Verify a nostr event's signature. */
  verifyEvent(event: NostrEvent): Promise<boolean>;
}

/** Hook for DM sending (NIP-17 gift-wrap). */
export interface DmHooks {
  /** Send a direct message to a recipient. */
  sendDm(recipientPubkey: string, message: string): Promise<{ success: boolean; eventId?: string; error?: string }>;
}

/**
 * Event emitted on every ACL enforcement check.
 * @example
 * ```ts
 * hooks.onAclCheck = (event: AclCheckEvent) => {
 *   console.log(`${event.decision}: ${event.capability} for ${event.identity.pubkey}`);
 * };
 * ```
 */
export interface AclCheckEvent {
  /** The identity being checked. */
  identity: { pubkey: string; dTag: string; hash: string };
  /** The capability being checked (e.g., 'relay:write', 'state:read'). */
  capability: string;
  /** The enforcement decision. */
  decision: 'allow' | 'deny';
  /** The triggering message, if available. Accepts NIP-01 arrays or NIP-5D NappletMessage envelopes. */
  message?: NappletMessage | unknown[];
}

/**
 * Static capability set sent to napplet iframes through the shell.ready /
 * shell.init handshake. Used by hosted `window.napplet.shell.supports()` for
 * synchronous capability queries after the shim consumes shell.init.
 *
 * Per canonical NIP-5D (specs/NIP-5D.md lines 81-94), supports() distinguishes
 * two namespaces:
 *
 *   - Bare names (or optional `nub:` prefix) for NUB-capability lookups,
 *     resolved against the `nubs` array — e.g. `supports('relay')`,
 *     `supports('identity')`.
 *   - The `perm:<permission>` prefix for sandbox-permission lookups, resolved
 *     against the `sandbox` array — e.g. `supports('perm:popups')`,
 *     `supports('perm:modals')`.
 *
 * The two namespaces do not cross: a bare-name lookup never matches a sandbox
 * entry and a `perm:`-prefixed lookup never matches a NUB entry.
 */
export interface ShellCapabilities {
  /**
   * NUB domain prefixes the shell handles. Kehto's hosted playground set is:
   * relay, identity, storage, ifc, theme, keys, media, notify, config,
   * resource, connect, class. `relay` is conditional on RelayPoolHooks.
   *
   * Entries are bare domain names — `'relay'`, `'identity'`, etc. They MUST NOT
   * carry the `perm:` prefix; that prefix is reserved for the `sandbox` array.
   * Napplets query NUB support via `supports('<domain>')` (or, equivalently,
   * `supports('nub:<domain>')`).
   */
  nubs: string[];
  /**
   * Sandbox permissions under the `perm:<permission>` namespace. Each entry
   * MUST begin with the literal prefix `'perm:'` — e.g. `'perm:popups'`,
   * `'perm:modals'`, `'perm:downloads'`. Napplets call
   * `shell.supports('perm:<permission>')` to check sandbox entitlements.
   *
   * The `perm:` prefix is what separates sandbox permissions from NUB
   * capabilities; bare-name entries here violate the NIP-5D contract and will
   * be unreachable through `supports()` (see specs/NIP-5D.md §6 and lines
   * 81-94). NUB-capability lookups (on `nubs`) retain the bare-name
   * convention and do NOT use the `perm:` prefix.
   */
  sandbox: string[];
}

/**
 * All adapters that the shell requires from the host application.
 * @example
 * ```ts
 * const hooks: ShellAdapter = {
 *   relayPool: myRelayPoolHooks,
 *   relayConfig: myRelayConfigHooks,
 *   windowManager: myWindowManagerHooks,
 *   auth: myAuthHooks,
 *   config: myConfigHooks,
 *   hotkeys: myHotkeyHooks,
 *   workerRelay: myWorkerRelayHooks,
 *   crypto: myCryptoHooks,
 * };
 * ```
 */
export interface ShellAdapter {
  relayPool: RelayPoolHooks;
  relayConfig: RelayConfigHooks;
  windowManager: WindowManagerHooks;
  auth: AuthHooks;
  config: ConfigHooks;
  hotkeys: HotkeyHooks;
  workerRelay: WorkerRelayHooks;
  crypto: CryptoHooks;
  dm?: DmHooks;
  /** Called on every ACL enforcement check. Both allows and denials are reported. */
  onAclCheck?: (event: AclCheckEvent) => void;
  /** Called when aggregate hash verification fails (computed != declared). */
  onHashMismatch?: (dTag: string, claimed: string, computed: string) => void;
  /**
   * Called at iframe creation for NIP-5D napplets.
   * Returns identity metadata for originRegistry.register(), INCLUDING the
   * class posture (CLASS-01, breaking v1.7). Returning `class: null` selects
   * the permissive default (D2). Returning null overall means "not NIP-5D /
   * skip registration" (unchanged semantics from v1.6).
   *
   * BREAKING v1.7: previously `{ dTag, aggregateHash } | null`; now requires
   * `class` in the non-null branch. See .changeset/class-01-breaking-hook.md.
   */
  onNip5dIframeCreate?: (windowId: string) => { dTag: string; aggregateHash: string; class: NappletClass } | null;
  /**
   * Optional service extensions. Each key is a service name (e.g., 'audio',
   * 'notifications'). Napplets discover available services via kind 29010
   * service discovery events.
   *
   * @example
   * ```ts
   * const hooks: ShellAdapter = {
   *   // ... required adapters ...
   *   services: {
   *     audio: myAudioServiceHandler,
   *     notifications: myNotificationServiceHandler,
   *   },
   * };
   * ```
   */
  services?: ServiceRegistry;
  /**
   * Optional runtime behavior overrides — demo/debug use only.
   * Called lazily on each relevant operation (replay check, buffer push),
   * so changes take effect immediately without runtime recreation.
   */
  getConfigOverrides?(): RuntimeConfigOverrides;
}
