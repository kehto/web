/**
 * types.ts — Runtime adapter interfaces and supporting types.
 *
 * RuntimeAdapter is the abstract contract any environment must implement
 * to host napplets. No DOM types, no browser APIs.
 */

import type { EventTemplate, NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';
import type { Capability } from '@kehto/acl/capabilities';
// Persistence + cache data types live in a sibling module (file-size budget);
// imported here for internal use by RuntimeAdapter and re-exported below.
import type { AclPersistence, FirewallPersistence, FirewallEvent, ManifestPersistence, ShellSecretPersistence, GuidPersistence, StatePersistence } from './persistence-types.js';

/**
 * A napplet class identifier. `null` is the permissive default (no class).
 * provisional — mirrors packages/shell/src/types/internal-class.ts::NappletClass;
 * converges on @napplet/nub/class@^0.3.0 publish. Runtime MUST NOT import
 * from shell (module-boundary), so this duplicate lives here.
 */
export type NappletClass = string | null;

/**
 * Event emitted on every ACL enforcement check.
 *
 * @param identity - The napplet identity being checked
 * @param capability - The capability being checked
 * @param decision - Whether the check passed or failed
 *
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
  message?: unknown[] | NappletMessage;
  /**
   * Why the decision was reached (v1.7 CLASS-03 / D7). Optional for
   * backwards compatibility with pre-v1.7 audit consumers.
   *   'allowed'             -> decision === 'allow'
   *   'capability-missing'  -> decision === 'deny' (capability lookup failed)
   *   'class-forbidden'     -> decision === 'deny' (class pre-filter refused)
   */
  reason?: 'allowed' | 'capability-missing' | 'class-forbidden';
}

/**
 * Abstract message sender — the runtime calls this to send messages
 * back to a specific napplet. The transport layer (postMessage, WebSocket,
 * host bridge channel, etc.) is the implementor's concern.
 *
 * Accepts both NIP-01 array format (legacy) and NIP-5D NappletMessage envelope format.
 *
 * @param windowId - Target napplet's identifier
 * @param msg - NIP-01 message array (e.g., ['EVENT', subId, event]) or NIP-5D envelope
 */
export type SendToNapplet = (windowId: string, msg: unknown[] | NappletMessage) => void;

/** Handle returned by relay pool subscriptions. */
export interface RelaySubscriptionHandle {
  unsubscribe(): void;
}

/**
 * Abstract relay pool — runtime uses this to subscribe to and publish
 * events on real Nostr relays. Implementor wraps their relay library.
 */
export interface RelayPoolAdapter {
  /**
   * Subscribe to events from relays matching the given filters.
   * The callback receives either 'EOSE' (end of stored events) or a NostrEvent.
   * Returns a handle that can cancel the subscription.
   */
  subscribe(
    filters: NostrFilter[],
    callback: (item: NostrEvent | 'EOSE') => void,
    relayUrls?: string[],
  ): RelaySubscriptionHandle;

  /** Publish an event to relays. */
  publish(event: NostrEvent): void;

  /** Select relay URLs appropriate for the given filters. */
  selectRelayTier(filters: NostrFilter[]): string[];

  /** Track a subscription key for lifecycle management. */
  trackSubscription(subKey: string, cleanup: () => void): void;

  /** Untrack and clean up a subscription. */
  untrackSubscription(subKey: string): void;

  /** Open a scoped relay connection (NIP-29 groups). */
  openScopedRelay(windowId: string, relayUrl: string, subId: string, filters: NostrFilter[], sendToNapplet: SendToNapplet): void;

  /** Close a scoped relay connection. */
  closeScopedRelay(windowId: string): void;

  /** Publish to a scoped relay. Returns false if no active scoped relay. */
  publishToScopedRelay(windowId: string, event: NostrEvent): boolean;

  /** Whether a relay pool is available. */
  isAvailable(): boolean;
}

/** Abstract local cache — query and store events. */
export interface CacheAdapter {
  /** Query cached events. Returns matching events. */
  query(filters: NostrFilter[]): Promise<NostrEvent[]>;

  /** Store an event in cache. Best-effort, may silently fail. */
  store(event: NostrEvent): void;

  /** Whether cache is available. */
  isAvailable(): boolean;
}

/** NIP-07 compatible signer interface — minimal methods the runtime needs. */
export interface Signer {
  getPublicKey?(): string | Promise<string>;
  signEvent?(event: NostrEvent | EventTemplate): Promise<NostrEvent>;
  getRelays?(): Record<string, { read: boolean; write: boolean }> | Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

/** Auth adapter — user identity and signing. */
export interface AuthAdapter {
  /** Get the current user's pubkey, or null if not logged in. */
  getUserPubkey(): string | null;

  /** Get the signer, or null if unavailable. */
  getSigner(): Signer | null;
}

/** Config adapter — runtime behavior settings. */
export interface ConfigAdapter {
  /** Get the napp update behavior policy. */
  getNappUpdateBehavior(): 'auto-grant' | 'banner' | 'silent-reprompt';
}

/** Hotkey adapter — keyboard shortcut forwarding. */
export interface HotkeyAdapter {
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

export type * from './persistence-types.js';

/** Crypto adapter — event verification. */
export interface CryptoAdapter {
  /** Verify a nostr event's Schnorr signature. */
  verifyEvent(event: NostrEvent): Promise<boolean>;

  /** Generate a random UUID string (replaces crypto.randomUUID). */
  randomUUID(): string;

  /** Generate cryptographically secure random bytes. */
  randomBytes(length: number): Uint8Array;
}

/**
 * Hash verification adapter — runtime calls this to verify a napplet's
 * declared aggregate hash against its actual file contents.
 * Optional: if not provided, hash verification is skipped (dev mode).
 */
export interface HashVerifierAdapter {
  /**
   * Compute aggregate hash from the napplet's served files.
   * Returns the computed hash, or null if files cannot be fetched.
   *
   * @param nappletUrl - Base URL of the napplet (iframe src)
   * @param manifestFiles - File paths and hashes from the manifest
   * @returns Computed aggregate hash, or null on failure
   */
  computeHash(
    nappletUrl: string,
    manifestFiles: Array<{ path: string; hash: string }>,
  ): Promise<string | null>;
}

/** Window management — create new napplet windows. */
export interface WindowManagerAdapter {
  createWindow(options: { title: string; class: string; iframeSrc?: string }): string | null;
}

/** Relay configuration — manage relay tiers. */
export interface RelayConfigAdapter {
  addRelay(tier: string, url: string): void;
  removeRelay(tier: string, url: string): void;
  getRelayConfig(): { discovery: string[]; super: string[]; outbox: string[] };
  getNip66Suggestions(): unknown;
}

/** DM adapter — send direct messages (NIP-17 gift-wrap). */
export interface DmAdapter {
  sendDm(recipientPubkey: string, message: string): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
  }>;
}

/**
 * A pending consent request — for a destructive signing kind, undeclared
 * service usage, or a firewall policy prompt.
 *
 * When type is 'destructive-signing' (or omitted for backwards compat):
 *   Raised when a signer request arrives for kinds 0, 3, 5, 10002.
 *
 * When type is 'undeclared-service':
 *   Raised when a napplet uses a service it did not declare in its manifest.
 *   The serviceName field identifies which service was used without declaration.
 *
 * When type is 'firewall-policy':
 *   Raised when the firewall evaluation returns a 'prompt' decision (ask policy).
 *   No Nostr event is associated — `event` is omitted. The `napplet` field
 *   carries the dTag the user's allow/deny choice will be remembered against.
 *   The triggering message is rejected now; if the user allows, subsequent
 *   messages from this napplet will pass without re-prompting (choice persisted
 *   as a per-napplet policy via setPolicy). Phase 82 changeset note: `event`
 *   was relaxed from required to optional to accommodate this variant (A3).
 *
 * @example
 * ```ts
 * // Destructive signing consent (existing behavior)
 * const signingConsent: ConsentRequest = {
 *   type: 'destructive-signing',
 *   windowId: 'win-1', pubkey: 'abc...', event: signingEvent,
 *   resolve: (allowed) => { ... },
 * };
 *
 * // Undeclared service consent
 * const serviceConsent: ConsentRequest = {
 *   type: 'undeclared-service',
 *   windowId: 'win-1', pubkey: 'abc...', event: serviceEvent,
 *   serviceName: 'audio',
 *   resolve: (allowed) => { ... },
 * };
 *
 * // Firewall policy prompt (no Nostr event)
 * const firewallConsent: ConsentRequest = {
 *   type: 'firewall-policy',
 *   windowId: 'win-1', pubkey: 'abc...', napplet: 'chat',
 *   resolve: (allowed) => { ... },
 * };
 * ```
 */
export interface ConsentRequest {
  /** Consent type discriminator. Defaults to 'destructive-signing' if omitted. */
  type?: 'destructive-signing' | 'undeclared-service' | 'firewall-policy';
  windowId: string;
  pubkey: string;
  /**
   * The Nostr event associated with this consent request.
   * Optional for 'firewall-policy' consent — a firewall prompt has no real Nostr event.
   * Present for 'destructive-signing' and 'undeclared-service' requests.
   */
  event?: NostrEvent;
  resolve: (allowed: boolean) => void;
  /** Service name for undeclared-service consent. Only present when type is 'undeclared-service'. */
  serviceName?: string;
  /**
   * The napplet dTag the firewall policy choice is remembered against.
   * Only present when type is 'firewall-policy'.
   */
  napplet?: string;
}

/** Consent handler callback type. */
export type ConsentHandler = (request: ConsentRequest) => void;

/**
 * Metadata describing a service handler. Referenced by ServiceHandler.descriptor
 * and the runtime's internal service registry.
 *
 * Relocated from the former @napplet/core compatibility shim (DRIFT-CORE-06
 * deleted in Phase 24). Content unchanged from the v1.1-era definition; this
 * is the canonical location going forward.
 *
 * @example
 * ```ts
 * const descriptor: ServiceDescriptor = {
 *   name: 'audio',
 *   version: '1.0.0',
 *   description: 'Audio playback and mute control',
 * };
 * ```
 */
export interface ServiceDescriptor {
  /** Service identifier (e.g., 'audio', 'notifications'). */
  name: string;
  /** Semver version of the service. */
  version: string;
  /** Optional human-readable description. */
  description?: string;
}

/**
 * Information about an available service, as reported in discovery responses.
 * Mirrors the ServiceDescriptor shape from @napplet/core.
 *
 * @example
 * ```ts
 * const info: ServiceInfo = {
 *   name: 'audio',
 *   version: '1.0.0',
 *   description: 'Audio playback and mute control',
 * };
 * ```
 */
export interface ServiceInfo {
  /** Service identifier (e.g., 'audio', 'notifications'). */
  name: string;
  /** Semver version of the service. */
  version: string;
  /** Optional human-readable description. */
  description?: string;
}

/**
 * Result of checking a napplet's declared service requirements against
 * the runtime's registered services.
 *
 * Surfaced via RuntimeAdapter.onCompatibilityIssue when compatible is false.
 * In strict mode, the runtime blocks loading. In permissive mode (default),
 * the runtime loads the napplet and the shell host decides UX.
 *
 * @example
 * ```ts
 * const report: CompatibilityReport = {
 *   available: [{ name: 'audio', version: '1.0.0' }],
 *   missing: ['notifications'],
 *   compatible: false,
 * };
 * ```
 */
export interface CompatibilityReport {
  /** Services that the shell provides (full list from service registry). */
  available: ServiceInfo[];
  /** Service names declared in manifest requires but not registered in the runtime. */
  missing: string[];
  /** True if all required services are available (missing.length === 0). */
  compatible: boolean;
}

/**
 * Registry entry mapping a napplet's windowId to its runtime metadata.
 * Created after a successful identity establishment (AUTH handshake or NIP-5D origin registration).
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
  /**
   * Runtime-resolved per-instance storage capability (kehto/web#35).
   *
   * When `true`, the runtime has elected to run this napplet as an instanceable
   * napplet and NAP-STORAGE is transparently scoped per window — two windows of
   * the same napplet (distinct `windowId`) get isolated, independently-persisted
   * storage. The napplet's code is unaware: it calls `storage.get/set/remove/keys`
   * exactly as before — no `scope` argument, no reserved prefix, no `windowId`.
   *
   * When `false`/absent (the default), storage is shared per napplet identity
   * `(dTag, aggregateHash)` — byte-identical to the historical behavior. The
   * runtime sets this only when the napplet declares the capability AND the
   * runtime chooses to instance it (a single-window host or a resource/policy
   * limit may decline, gracefully degrading to shared storage).
   *
   * The source of the declaration (manifest / NIP-5A / NAP-CLASS) is resolved
   * when this entry is constructed; placement is tracked upstream in napplet/naps.
   */
  instanceable?: boolean;
}

/** @deprecated Use SessionEntry. Will be removed in v0.9.0. */
export type NappKeyEntry = SessionEntry;

/**
 * A pending napplet update — raised when a napplet reconnects with a different aggregateHash.
 */
export interface PendingUpdate {
  windowId: string;
  pubkey: string;
  dTag: string;
  oldHash: string;
  newHash: string;
  resolve: (action: 'accept' | 'block') => void;
}

/** Callback invoked when a pending update is set or cleared. */
export type PendingUpdateNotifier = (windowId: string) => void;

/** External ACL entry — used in shell commands (shell:acl-get etc.). */
export interface AclEntryExternal {
  pubkey: string;
  capabilities: Capability[];
  blocked: boolean;
  stateQuota?: number;
}

/**
 * Handler for service-specific messages from napplets.
 * Services receive NIP-5D NappletMessage envelopes and respond via the `send` callback.
 * The same interface is used for all services regardless of what NUB domain they handle.
 *
 * @example
 * ```ts
 * const audioHandler: ServiceHandler = {
 *   descriptor: { name: 'audio', version: '1.0.0' },
 *   handleMessage(windowId, message, send) {
 *     if (message.type === 'ifc.emit') {
 *       // process audio ifc event...
 *       send({ type: 'ifc.emit.result', id: (message as any).id });
 *     }
 *   },
 * };
 * ```
 */
export interface ServiceHandler {
  /** Metadata describing this service. */
  descriptor: ServiceDescriptor;
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

/**
 * Registry of services available to napplets.
 * Each key is a service name (e.g., 'audio', 'notifications').
 * Napplets discover available services via kind 29010 service discovery events.
 *
 * @example
 * ```ts
 * const services: ServiceRegistry = {
 *   audio: audioHandler,
 *   notifications: notificationHandler,
 * };
 * ```
 */
export type ServiceRegistry = Record<string, ServiceHandler>;

/**
 * Optional runtime configuration overrides. When provided via
 * RuntimeAdapter.getConfigOverrides(), the runtime reads these
 * instead of the module-level defaults. All fields are optional —
 * unset fields use the built-in defaults.
 *
 * Intended for demo/debug use only.
 *
 * @example
 * ```ts
 * const overrides: RuntimeConfigOverrides = {
 *   replayWindowSeconds: 60,
 *   ringBufferSize: 500,
 * };
 * ```
 */
export interface RuntimeConfigOverrides {
  /** Override REPLAY_WINDOW_SECONDS (default: 30). */
  replayWindowSeconds?: number;
  /** Override RING_BUFFER_SIZE (default: 100). */
  ringBufferSize?: number;
}

/**
 * All adapters that the runtime requires from the host environment.
 *
 * This is the primary integration point. A browser shell implements these
 * by wrapping postMessage, localStorage, and relay pool libraries.
 * A CLI or server shell could implement them with host bridge channels, file
 * storage, and direct WebSocket connections.
 *
 * @example
 * ```ts
 * import { createRuntime, type RuntimeAdapter } from '@kehto/runtime';
 *
 * const hooks: RuntimeAdapter = {
 *   sendToNapplet: (wid, msg) => iframeWindows.get(wid)?.postMessage(msg, '*'),
 *   relayPool: myRelayPoolAdapter,
 *   cache: myCacheAdapter,
 *   auth: myAuthAdapter,
 *   config: myConfigAdapter,
 *   hotkeys: myHotkeyAdapter,
 *   crypto: myCryptoAdapter,
 *   aclPersistence: myAclPersistenceAdapter,
 *   manifestPersistence: myManifestPersistenceAdapter,
 *   statePersistence: myStatePersistenceAdapter,
 *   windowManager: myWindowManagerAdapter,
 *   relayConfig: myRelayConfigAdapter,
 * };
 *
 * const runtime = createRuntime(hooks);
 * ```
 */
export interface RuntimeAdapter {
  /** Send a NIP-01 message to a napplet by windowId. */
  sendToNapplet: SendToNapplet;

  /**
   * Relay pool operations.
   * Optional when a 'relay' or 'relay-pool' service is registered via
   * RuntimeAdapter.services or runtime.registerService(). If neither adapter
   * nor service are provided, relay functionality is unavailable.
   */
  relayPool?: RelayPoolAdapter;

  /**
   * Local event cache (worker relay).
   * Optional when a 'cache' or 'relay' (coordinated) service is registered.
   * If neither adapter nor service are provided, cache functionality is unavailable.
   */
  cache?: CacheAdapter;

  /**
   * Auth state and signing.
   *
   * NIP-5D path: getUserPubkey() provides the shell user's identity (not napplet's).
   * getSigner() is the primary concern — used for proxied signing operations from napplets.
   */
  auth: AuthAdapter;

  /** Runtime configuration. */
  config: ConfigAdapter;

  /** Hotkey dispatch. */
  hotkeys: HotkeyAdapter;

  /** Crypto operations (signature verification, random UUID). */
  crypto: CryptoAdapter;

  /** ACL persistence (save/load ACL state). */
  aclPersistence: AclPersistence;

  /** Manifest cache persistence. */
  manifestPersistence: ManifestPersistence;

  /** Napplet state storage. */
  statePersistence: StatePersistence;

  /** Window management. */
  windowManager: WindowManagerAdapter;

  /** Relay configuration. */
  relayConfig: RelayConfigAdapter;

  /** DM sending (optional). */
  dm?: DmAdapter;

  /**
   * Shell secret persistence (for deterministic keypair derivation).
   * @deprecated NIP-5D: Shell secrets are no longer needed when using the NIP-5D origin-based
   * identity path. Kept for backward compatibility with legacy AUTH sessions.
   */
  shellSecretPersistence?: ShellSecretPersistence;

  /** Hash verification (optional — if absent, hash verification is skipped). */
  hashVerifier?: HashVerifierAdapter;

  /** GUID persistence for iframe instance tracking (optional — if absent, GUIDs are in-memory only). */
  guidPersistence?: GuidPersistence;

  /**
   * Called when aggregate hash verification fails (computed != declared).
   * Host app should display a user-visible warning.
   */
  onHashMismatch?: (dTag: string, claimed: string, computed: string) => void;

  /** Called on every ACL enforcement check (audit). */
  onAclCheck?: (event: AclCheckEvent) => void;

  /**
   * Firewall config persistence (save/load firewall config).
   * When absent, firewall config is in-memory only and resets on reload.
   * Only the config is persisted; ephemeral counters are never stored.
   */
  firewallPersistence?: FirewallPersistence;

  /**
   * Called on every firewall evaluation that results in an audit-level decision
   * (flag, block, or prompt). When absent, firewall decisions are not audited.
   */
  onFirewallEvent?: (event: FirewallEvent) => void;

  /**
   * Returns the current focus state for a napplet window.
   * When absent, defaults to `{ focused: true }` — a host without a window
   * manager treats everything as focused, so focus never tightens rate budgets.
   * Focus alone never hard-blocks; it only scales token refill rates.
   *
   * @param windowId - The napplet window to query focus state for.
   * @returns Current focus state and optional milliseconds since last focus gain.
   */
  getFocusContext?: (windowId: string) => { focused: boolean; msSinceFocusGain?: number };

  /** Called when a pending napp update is set or cleared. */
  onPendingUpdate?: PendingUpdateNotifier;

  /**
   * Called when a napplet's required services are not fully available.
   * Receives a CompatibilityReport with available/missing services.
   * In strict mode, the runtime blocks the napplet from loading.
   * In permissive mode (default), the napplet loads and the host decides UX.
   */
  onCompatibilityIssue?: (report: CompatibilityReport) => void;

  /**
   * When true, missing required services block napplet loading.
   * When false or omitted (default), napplets load with a warning.
   */
  strictMode?: boolean;

  /**
   * Optional service extensions. Shell/host registers service handlers here
   * for static initialization. Services can also be added dynamically via
   * runtime.registerService(). Each key is a service name (e.g., 'audio').
   *
   * @example
   * ```ts
   * const hooks: RuntimeAdapter = {
   *   // ... required adapters ...
   *   services: {
   *     audio: myAudioServiceHandler,
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

/** Re-export NappletMessage from @napplet/core for consumer convenience. */
export type { NappletMessage };
