// @kehto/runtime — Browser-agnostic protocol engine for the napplet protocol.

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
  FirewallPersistence,
  FirewallEvent,
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
  NappletClass,
} from './types.js';

export { createEnforceGate, createNubEnforceGate, resolveCapabilitiesNub, formatDenialReason } from './enforce.js';
export type { EnforceResult, EnforceConfig, NubEnforceConfig, IdentityResolver, AclChecker, NubMessage } from './enforce.js';

export { createSessionRegistry, createNappKeyRegistry } from './session-registry.js';
export type { SessionRegistry, NappKeyRegistry } from './session-registry.js';

export { createAclState } from './acl-state.js';
export type { AclStateContainer } from './acl-state.js';

export { createFirewallState } from './firewall-state.js';
export type { FirewallStateContainer } from './firewall-state.js';

export { createManifestCache } from './manifest-cache.js';
export type { ManifestCache } from './manifest-cache.js';

export { createReplayDetector } from './replay.js';
export type { ReplayDetector } from './replay.js';

export { createEventBuffer, matchesFilter, matchesAnyFilter, RING_BUFFER_SIZE } from './event-buffer.js';
export type { EventBuffer, SubscriptionEntry } from './event-buffer.js';

export { createRuntime } from './runtime.js';
export type { Runtime } from './runtime.js';

export { handleStorageNub, cleanupNappState } from './state-handler.js';

export { routeServiceMessage, notifyServiceWindowDestroyed } from './service-dispatch.js';

export type { Capability } from '@kehto/acl/capabilities';
export { ALL_CAPABILITIES } from '@kehto/acl/capabilities';
export type { ServiceDescriptor } from './types.js';
