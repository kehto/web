// @kehto/runtime — Browser-agnostic protocol engine for the napplet protocol.

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  RuntimeAdapter,
  SendToNapplet,
  RelayPoolAdapter,
  RelaySubscriptionHandle,
  CacheAdapter,
  AuthAdapter,
  Signer,
  ConfigAdapter,
  HotkeyAdapter,
  AclPersistence,
  ManifestPersistence,
  StatePersistence,
  CryptoAdapter,
  WindowManagerAdapter,
  RelayConfigAdapter,
  DmAdapter,
  ConsentRequest,
  ConsentHandler,
  SessionEntry,
  NappKeyEntry,  // @deprecated — use SessionEntry
  PendingUpdate,
  PendingUpdateNotifier,
  ManifestCacheEntry,
  AclEntryExternal,
  AclCheckEvent,
  ServiceHandler,
  ServiceRegistry,
  CompatibilityReport,
  ServiceInfo,
  ShellSecretPersistence,
  GuidPersistence,
  HashVerifierAdapter,
  VerificationCacheEntry,
  RuntimeConfigOverrides,
  NappletMessage,
} from './types.js';

// ─── Enforcement Gate ──────────────────────────────────────────────────────
export { createEnforceGate, createNubEnforceGate, resolveCapabilitiesNub, formatDenialReason } from './enforce.js';
export type { EnforceResult, EnforceConfig, NubEnforceConfig, IdentityResolver, AclChecker, NubMessage } from './enforce.js';

// ─── SessionRegistry ──────────────────────────────────────────────────────
export { createSessionRegistry, createNappKeyRegistry } from './session-registry.js';
export type { SessionRegistry, NappKeyRegistry } from './session-registry.js';

// ─── ACL State Container ──────────────────────────────────────────────────
export { createAclState } from './acl-state.js';
export type { AclStateContainer } from './acl-state.js';

// ─── Manifest Cache ────────────────────────────────────────────────────────
export { createManifestCache } from './manifest-cache.js';
export type { ManifestCache } from './manifest-cache.js';

// ─── Replay Detection ──────────────────────────────────────────────────────
export { createReplayDetector } from './replay.js';
export type { ReplayDetector } from './replay.js';

// ─── Event Buffer ──────────────────────────────────────────────────────────
export { createEventBuffer, matchesFilter, matchesAnyFilter, RING_BUFFER_SIZE } from './event-buffer.js';
export type { EventBuffer, SubscriptionEntry } from './event-buffer.js';

// ─── Runtime Factory (primary entry point) ─────────────────────────────────
export { createRuntime } from './runtime.js';
export type { Runtime } from './runtime.js';

// ─── State Handler ─────────────────────────────────────────────────────────
export { handleStorageNub, cleanupNappState } from './state-handler.js';

// ─── Service Dispatch ─────────────────────────────────────────────────────
export { routeServiceMessage, notifyServiceWindowDestroyed } from './service-dispatch.js';

// ─── Re-exports from canonical homes (Phase 24 DRIFT-01) ───────────────────
// The former @napplet/core compatibility shim was deleted in Phase 24 after
// @napplet/core @0.2.0 stabilized on npm. Live types are now re-exported from
// their rightful homes:
//   - Capability       → @kehto/acl/capabilities  (canonical string union + ALL_CAPABILITIES)
//   - ServiceDescriptor → ./types.js              (runtime-internal service metadata)
// The legacy bus-kind value-union type and the NIP-01 kind + topic + auth +
// destructive-kind constants are no longer exported — all dead after the
// v1.2 NIP-5D migration (Phase 24 DRIFT-02 deleted the remaining callers).
export type { Capability } from '@kehto/acl/capabilities';
export { ALL_CAPABILITIES } from '@kehto/acl/capabilities';
export type { ServiceDescriptor } from './types.js';
