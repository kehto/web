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
export { createEnforceGate, createNubEnforceGate, resolveCapabilities, resolveCapabilitiesNub, formatDenialReason } from './enforce.js';
export type { CapabilityResolution, EnforceResult, EnforceConfig, NubEnforceConfig, IdentityResolver, AclChecker, NubMessage } from './enforce.js';

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
export { handleStateRequest, handleStorageNub, cleanupNappState } from './state-handler.js';

// ─── Service Dispatch ─────────────────────────────────────────────────────
export { routeServiceMessage, notifyServiceWindowDestroyed } from './service-dispatch.js';

// ─── Service Discovery ────────────────────────────────────────────────────────
export { createServiceDiscoveryEvent, handleDiscoveryReq, isDiscoveryReq } from './service-discovery.js';
export type { DiscoverySubscription } from './service-discovery.js';

// ─── @napplet/core v1.1 compatibility shims ────────────────────────────────
// DRIFT-CORE-06 — Phase 11-deviation: re-export legacy types/constants that were
// dropped from @napplet/core v0.2.0+ (napplet phases 81 + 87). Consumers still
// import these symbols through @kehto/runtime; Phase 12/14 will delete both
// the shim and its consumers.
export type { Capability, BusKindValue, ServiceDescriptor } from './core-compat.js';
export {
  ALL_CAPABILITIES,
  DESTRUCTIVE_KINDS,
  REPLAY_WINDOW_SECONDS,
  BusKind,
  AUTH_KIND,
  SHELL_BRIDGE_URI,
  PROTOCOL_VERSION,
} from './core-compat.js';
