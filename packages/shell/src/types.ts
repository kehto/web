// @kehto/shell — Shell-specific types and hook interfaces.
// Protocol types (NostrEvent, NostrFilter, Capability, constants) are imported from @napplet/core.

// Protocol types and constants re-exported from @napplet/core and @kehto/runtime.
// Phase 24 DRIFT-01: the former @napplet/core compatibility shim has been
// deleted; legacy NIP-01 constants (BusKind, AUTH_KIND, DESTRUCTIVE_KINDS,
// SHELL_BRIDGE_URI, PROTOCOL_VERSION, REPLAY_WINDOW_SECONDS, legacy
// BusKind-value union) are no longer re-exported. Shell internals that need
// INC_PEER=29000 inline the numeric locally.
export type { NostrEvent, NostrFilter } from '@napplet/core';
export type { Capability, ServiceDescriptor } from '@kehto/runtime';
export { ALL_CAPABILITIES } from '@kehto/runtime';
export type { NappletMessage } from '@napplet/core';
export type { SessionEntry, NappKeyEntry } from '@kehto/runtime';

// Import Capability type locally for use in this file's shell-specific types
import type { NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';
import type { Capability, RuntimeConfigOverrides, ServiceHandler, ServiceRegistry } from '@kehto/runtime';

// Re-export service types so shell consumers can still import from @kehto/shell
// (ServiceDescriptor already re-exported above from @kehto/runtime).
export type { ServiceHandler, ServiceRegistry };

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
 * Minimal upload backend the shell advertises (NAP-UPLOAD). The host wires the
 * concrete upload service into the runtime via `registerService('upload', …)`;
 * this hook is the presence/capability signal `buildShellCapabilities` reads to
 * decide whether to advertise `upload` to napplets.
 */
export interface UploadBackendLike {
  /** Storage rails this backend can serve, e.g. `['nip96', 'blossom']`. */
  readonly rails: readonly string[];
}

/** Hook exposing a shell-mediated upload backend (NAP-UPLOAD). */
export interface UploadHooks {
  /** Get the configured upload backend — returns null when none is available. */
  getUploader(): UploadBackendLike | null;
}

/**
 * Minimal intent backend the shell advertises (NAP-INTENT). The host wires the
 * concrete intent service into the runtime via `registerService('intent', …)`;
 * this hook is the presence/capability signal `buildShellCapabilities` reads to
 * decide whether to advertise `intent` to napplets. NAP-INTENT is only
 * meaningful when the host can resolve archetypes to installed napplets and
 * create/focus their windows.
 */
export interface IntentHooks {
  /** True when the host has an intent resolver wired and ready to dispatch. */
  isAvailable(): boolean;
}

/** Minimal link backend the shell advertises (NAP-LINK). */
export interface LinkHooks {
  /** True when the host has shell-mediated link opening wired. */
  isAvailable(): boolean;
}

/** Minimal common backend the shell advertises (NAP-COMMON). */
export interface CommonHooks {
  /** True when the host has shell-mediated common social helpers wired. */
  isAvailable(): boolean;
}

/** Minimal lists backend the shell advertises (NAP-LISTS). */
export interface ListsHooks {
  /** True when the host has shell-mediated NIP-51 list mutation helpers wired. */
  isAvailable(): boolean;
}

/** Minimal serial backend the shell advertises (NAP-SERIAL). */
export interface SerialHooks {
  /** True when the host has shell-mediated serial sessions wired. */
  isAvailable(): boolean;
}

/** Minimal BLE backend the shell advertises (NAP-BLE). */
export interface BleHooks {
  /** True when the host has shell-mediated BLE sessions wired. */
  isAvailable(): boolean;
}

/**
 * Optional host override for the static shell.init capability handshake.
 *
 * Hosts normally advertise the default Kehto NAP surface. Development hosts may
 * temporarily suppress domains to simulate smaller or policy-constrained shell
 * environments while still using the production shell-ready path.
 */
export interface CapabilityHooks {
  /** Bare capability domains to remove from domains, naps, and protocols. */
  readonly disabledDomains?: readonly string[];
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
 * Diagnostic payload reported when {@link ShellAdapter.onUnroutedMessage} fires —
 * i.e. when `ShellBridge.handleMessage` drops an incoming postMessage because it
 * cannot be routed to a registered napplet window.
 *
 * @example
 * ```ts
 * hooks.onUnroutedMessage = (info: UnroutedMessageInfo) => {
 *   console.warn(`[shell] dropped ${info.type ?? '<unknown>'} from ${info.origin}: ${info.reason}`);
 * };
 * ```
 */
export interface UnroutedMessageInfo {
  /**
   * The dropped message's `type` field when `event.data` is an object with a
   * string `type`; `undefined` for malformed/non-envelope payloads.
   */
  type?: string;
  /** The `MessageEvent.origin` of the dropped message. */
  origin: string;
  /**
   * Why the message was dropped:
   * - `no-source-window` — the `MessageEvent` had no `source` window to identify the sender.
   * - `unregistered-window` — the source `Window` is not in `originRegistry` (the
   *   sending iframe was never registered, or a `srcdoc` reload swapped its
   *   `contentWindow` to a new object that no longer matches the registry key).
   */
  reason: 'no-source-window' | 'unregistered-window';
}

/**
 * Static capability set sent to napplet iframes through the shell.ready /
 * shell.init handshake. Used by hosted `window.napplet.shell.supports()` for
 * synchronous capability queries after the shim consumes shell.init.
 *
 * Per canonical NIP-5D (https://github.com/nostr-protocol/nips/pull/2303/),
 * supports() distinguishes two namespaces:
 *
 *   - Bare names for NAP-capability lookups, resolved against the `naps`
 *     array — e.g. `supports('relay')`, `supports('identity')`.
 *   - The `perm:<permission>` prefix for sandbox-permission lookups, resolved
 *     against the `sandbox` array — e.g. `supports('perm:popups')`,
 *     `supports('perm:modals')`.
 *
 * The two namespaces do not cross: a bare-name lookup never matches a sandbox
 * entry and a `perm:`-prefixed lookup never matches a NAP entry.
 *
 * ## Conformant NAP-SHELL shape (TERM-03 — @napplet/core@0.12 / @napplet/shim@0.13)
 *
 * The released 0.13 shim no longer reads the flat `naps` array. On `shell.init`
 * it calls `@napplet/nap@0.12`'s `createShellEnvironment(msg)` +
 * `makeSupports(env)`, which read the STRUCTURED
 * `capabilities.{ domains: string[], protocols: Record<string, string[]> }`:
 *
 *   - `supports('relay')`       → true iff `'relay' ∈ capabilities.domains`
 *   - `supports('inc','NAP-01')`→ true iff `capabilities.protocols['inc']`
 *                                  includes `'NAP-01'`
 *
 * `domains` and `protocols` are emitted as a SUPERSET ALONGSIDE the
 * `naps`/`sandbox` fields (TERM-05 back-compat). The 0.13 shim has NO
 * special `perm:` logic — `supports('perm:popups')` is an ordinary bare-domain
 * membership check, so kehto's `perm:`-prefixed sandbox entries are folded into
 * `domains` (empty by default, preserving the default-empty sandbox behavior).
 */
export interface ShellCapabilities {
  /**
   * Conformant NAP-SHELL domain list (PRIMARY for `@napplet/shim >=0.13`).
   * Bare NAP domain names the shell offers — `'identity'`, `'storage'`,
   * `'inc'`, `'theme'`, etc. — with the same conditional entries as `naps`
   * (`relay`/`outbox` when a relay pool is wired, `upload`/`intent` under their
   * hooks). Carries NO `inc:NAP-NN` protocol strings (those live in
   * `protocols`). Any `perm:<x>` sandbox entries are appended here too, since
   * the 0.13 shim resolves `supports('perm:<x>')` against this list.
   *
   * Read by `createShellEnvironment(msg).capabilities.domains` →
   * `makeSupports` for `supports('<domain>')` queries.
   */
  domains: string[];
  /**
   * Conformant NAP-SHELL per-domain numbered protocols (PRIMARY for
   * `@napplet/shim >=0.13`). Maps a domain to the NAP-NN protocol IDs it
   * speaks — `{ inc: ['NAP-01','NAP-02','NAP-03','NAP-04','NAP-05','NAP-06'] }`
   * (derived from `NAP_INC_PROTOCOLS` by stripping the `inc:` prefix).
   *
   * Read by `createShellEnvironment(msg).capabilities.protocols` →
   * `makeSupports` for `supports('<domain>','NAP-NN')` queries.
   */
  protocols: Record<string, string[]>;
  /**
   * NAP-vocabulary domain entries the shell handles (PRIMARY — consumed by
   * `@napplet/shim >=0.9.0`). Bare domain `inc` (the NAP rename of `inc`)
   * plus protocol IDs `inc:NAP-01..inc:NAP-06`. Conditional entries:
   * `relay`, `outbox` prepended when a relay pool is wired; `upload` appended
   * when an upload backend is wired; `intent` appended when an intent
   * dispatcher is available.
   *
   * Contains NO `NAP-NN` protocol strings (those live in `protocols`).
   */
  naps: string[];
  /**
   * Sandbox permissions under the `perm:<permission>` namespace. Each entry
   * MUST begin with the literal prefix `'perm:'` — e.g. `'perm:popups'`,
   * `'perm:modals'`, `'perm:downloads'`. Napplets call
   * `shell.supports('perm:<permission>')` to check sandbox entitlements.
   *
   * The `perm:` prefix is what separates sandbox permissions from NAP
   * capabilities; bare-name entries here violate the NIP-5D contract and will
   * be unreachable through `supports()` (see the living NIP-5D at
   * https://github.com/nostr-protocol/nips/pull/2303/). NAP-capability lookups (on `naps`) retain the bare-name
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
  /**
   * Optional shell-mediated upload backend (NAP-UPLOAD). When present, the shell
   * advertises the `upload` domain so napplets can call `window.napplet.upload`.
   * The host still registers the concrete service via `registerService('upload')`.
   */
  upload?: UploadHooks;
  /**
   * Optional archetype intent dispatcher (NAP-INTENT). When present and
   * `isAvailable()` is true, the shell advertises the `intent` domain so
   * napplets can call `window.napplet.intent`. The host still registers the
   * concrete service via `registerService('intent')`.
   */
  intent?: IntentHooks;
  /**
   * Optional shell-mediated link backend (NAP-LINK). When present and
   * `isAvailable()` is true, the shell advertises `link`. The host still
   * registers the concrete service via `registerService('link')`.
   */
  link?: LinkHooks;
  /**
   * Optional shell-mediated common social backend (NAP-COMMON). When present
   * and `isAvailable()` is true, the shell advertises `common`. The host still
   * registers the concrete service via `registerService('common')`.
   */
  common?: CommonHooks;
  /**
   * Optional shell-mediated NIP-51 list backend (NAP-LISTS). When present and
   * `isAvailable()` is true, the shell advertises `lists`. The host still
   * registers the concrete service via `registerService('lists')`.
   */
  lists?: ListsHooks;
  /**
   * Optional shell-mediated serial backend (NAP-SERIAL). When present and
   * `isAvailable()` is true, the shell advertises `serial`. The host still
   * registers the concrete service via `registerService('serial')`.
   */
  serial?: SerialHooks;
  /**
   * Optional shell-mediated BLE backend (NAP-BLE). When present and
   * `isAvailable()` is true, the shell advertises `ble`. The host still
   * registers the concrete service via `registerService('ble')`.
   */
  ble?: BleHooks;
  /**
   * Optional capability advertisement override. Omitted by production hosts.
   */
  capabilities?: CapabilityHooks;
  /** Called on every ACL enforcement check. Both allows and denials are reported. */
  onAclCheck?: (event: AclCheckEvent) => void;
  /**
   * Called when `ShellBridge.handleMessage` drops an incoming postMessage because
   * it cannot be routed to a registered napplet window (no source window, or the
   * source `Window` is not in `originRegistry`). Observe-only — the message is
   * still dropped; this hook exists so otherwise-silent drops are diagnosable
   * (the FEED-02 / hyprgate#21 class of "a napplet's messages vanish" bug).
   */
  onUnroutedMessage?: (info: UnroutedMessageInfo) => void;
  /** Called when aggregate hash verification fails (computed != declared). */
  onHashMismatch?: (dTag: string, claimed: string, computed: string) => void;
  /**
   * Called at iframe creation for NIP-5D napplets.
   * Returns identity metadata for originRegistry.register(). Returning null
   * means "not NIP-5D / skip registration".
   */
  onNip5dIframeCreate?: (windowId: string) => { dTag: string; aggregateHash: string } | null;
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
