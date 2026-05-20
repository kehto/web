// @kehto/shell — Browser adapter over @kehto/runtime.
// Delegates all protocol logic to the runtime engine. Provides browser-specific
// concerns: Window/postMessage bridging, localStorage persistence, audio manager.

// ─── Public API ─────────────────────────────────────────────────────────────

// Factory function — main entry point
export { createShellBridge } from './shell-bridge.js';
export type { ShellBridge } from './shell-bridge.js';

// Hooks adapter — for advanced integrators who need to customize the adapter
export { adaptHooks } from './hooks-adapter.js';
export type { BrowserDeps } from './hooks-adapter.js';

// Protocol types (re-exported from @napplet/core + @kehto/runtime).
// Phase 24 DRIFT-01: former @napplet/core compatibility shim deleted; legacy
// NIP-01 constants no longer re-exported. Shell consumers import Capability +
// ALL_CAPABILITIES from @kehto/runtime (sourced from @kehto/acl/capabilities).
export type { NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';
export type { Capability } from '@kehto/runtime';
export { ALL_CAPABILITIES } from '@kehto/runtime';

// v1.7 Phase 38: NUB-CLASS provisional type — consumed by apps/playground and by
// downstream host apps implementing onNip5dIframeCreate. Only NappletClass is
// re-exported (ClassAssignmentPayload stays staging-only for now).
export type { NappletClass } from './types/provisional-class.js';

// Types for host app integration (shell-specific)
export type {
  ShellAdapter,
  ShellCapabilities,
  RelayPoolHooks,
  RelayPoolLike,
  RelayConfigHooks,
  WindowManagerHooks,
  AuthHooks,
  ConfigHooks,
  HotkeyHooks,
  WorkerRelayHooks,
  WorkerRelayLike,
  CryptoHooks,
  DmHooks,
  SessionEntry,
  NappKeyEntry,  // @deprecated — use SessionEntry
  AclEntry,
  AclCheckEvent,
  ServiceDescriptor,
  ServiceHandler,
  ServiceRegistry,
} from './types.js';

// Shell initialization — capability construction for shell.ready / shell.init handshake
export { buildShellCapabilities } from './shell-init.js';

// Session registry
export { sessionRegistry, nappKeyRegistry } from './session-registry.js';
export type { PendingUpdate } from './session-registry.js';

// Standalone utilities (usable without full shell)
export { originRegistry } from './origin-registry.js';
export { audioManager } from './audio-manager.js';
export type { AudioSource } from './audio-manager.js';
export { manifestCache } from './manifest-cache.js';
export type { ManifestCacheEntry } from './manifest-cache.js';

// Enforcement gate (re-exported from @kehto/runtime for backwards compatibility)
export { createEnforceGate, createNubEnforceGate, formatDenialReason } from '@kehto/runtime';
export type { EnforceResult, EnforceConfig, NubEnforceConfig, IdentityResolver, AclChecker, NubMessage } from '@kehto/runtime';
// ConsentRequest canonical definition re-exported from @kehto/runtime
export type { ConsentRequest } from '@kehto/runtime';

// Topic constants for shell command routing
export { TOPICS } from './topics.js';
export type { TopicKey, TopicValue } from './topics.js';

// ─── Per-domain proxies (Plan 12-11) ────────────────────────────────────────
// Canonical shell-side composition seams for the five non-storage NUB
// domains. createShellBridge() does NOT wire these by default — the runtime
// already owns 8-domain dispatch. Host apps may compose these proxies to
// intercept or augment napplet↔shell traffic per domain.
export { createIdentityProxy } from './identity-proxy.js';
export type { IdentityProxy, IdentityProxyDeps, ProxyOriginRegistry } from './identity-proxy.js';
export { createThemeProxy } from './theme-proxy.js';
export type { ThemeProxy, ThemeProxyDeps } from './theme-proxy.js';
export { createKeysProxy } from './keys-proxy.js';
export type { KeysProxy, KeysProxyDeps } from './keys-proxy.js';
export { createMediaProxy } from './media-proxy.js';
export type { MediaProxy, MediaProxyDeps } from './media-proxy.js';
export { createNotifyProxy } from './notify-proxy.js';
export type { NotifyProxy, NotifyProxyDeps } from './notify-proxy.js';

// ─── Keys-forwarder (Plan 12-11, NUB-05 shell-side) ─────────────────────────
// Host-keydown → keys.forward envelope pump. Auto-attached by
// createShellBridge(); also exported for host apps that want to manage
// their own forwarder instance.
export { createKeysForwarder } from './keys-forwarder.js';
export type {
  KeysForwarder,
  KeysForwarderDeps,
  KeysForwarderOriginRegistry,
  KeysForwarderSessionRegistry,
} from './keys-forwarder.js';

// ─── v1.7 Phase 39 NUB-CONNECT: connect-store singleton + wire types ─────────
// connect-store singleton with grant/revoke/check/getOrigins/getAllGrants/persist/load/clear.
// connectGrantKey: compose the canonical '<dTag>:<aggregateHash>' composite key.
// Wire types: ConnectGrant, ConnectGrantKey, ConnectConsentRequest, ConsentResult
// (provisional — swap to @napplet/nub/connect when upstream publishes at ^0.3.0).
export { connectStore, connectGrantKey } from './connect-store.js';
export type { ConnectStore } from './connect-store.js';
export type {
  ConnectGrant,
  ConnectGrantKey,
  ConnectConsentRequest,
  ConsentResult,
} from './types/provisional-connect.js';

// ─── v1.7 Phase 40: NUB-RESOURCE provisional wire types ─────────────���────────
// Consumed by demo napplets and external host apps that implement the `fetch`
// option for createResourceService. Exported here so consumers can import from
// @kehto/shell without reaching into the provisional/ subpath directly.
// Swap to `@napplet/nub/resource/types` when upstream publishes at ^0.2.2
// (single-atomic bump per v1.7 milestone close policy).
export type {
  ResourceBytesRequest,
  ResourceCancelRequest,
  ResourceBytesResult,
  ResourceBytesError,
  ResourceErrorCode,
  ResourceRequestId,
  ResourceInbound,
  ResourceOutbound,
} from './types/provisional-resource.js';
