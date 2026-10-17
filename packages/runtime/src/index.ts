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
  ServiceRuntimeContext,
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

export { createEnforceGate, createNapEnforceGate, resolveCapabilitiesNap, formatDenialReason } from './enforce.js';
export type { EnforceResult, EnforceConfig, NapEnforceConfig, IdentityResolver, AclChecker, NapMessage } from './enforce.js';

export { createSessionRegistry, createNappKeyRegistry } from './session-registry.js';
export type { SessionRegistry, NappKeyRegistry } from './session-registry.js';

export { createAclState } from './acl-state.js';
export type { AclMutation, AclMutationObserver, AclStateContainer } from './acl-state.js';

export { createFirewallState } from './firewall-state.js';
export type { FirewallStateContainer } from './firewall-state.js';
export type { PermissionAdapter, PermissionRateEvent, RuntimePermissions, PermissionAdmission, PermissionAdmissionRequest } from './permission-runtime.js';
export type { PermissionPersistence, PermissionStorageFailure } from './permission-state.js';
export type { ApprovalAnswer, ApprovalPrompt, ApprovalSignal, ApprovalCancellation, ApprovalOutcome, ApprovalFailure } from './approval-coordinator.js';
export type { PermissionPrincipal, PermissionRequirement, PermissionScope, PermissionGrant } from '@kehto/firewall';

export { defaultRateLimitConfig, defaultPromptRateLimitConfig, createRateLimitState, evaluateRateLimit, retireRateLimitLifecycle } from './rate-limit.js';
export type { RateLimitAction, RateLimitConfig, RateLimitObservation, RateBucket, RateBurst, RateLimitState, RateLimitResult } from './rate-limit.js';

export { createManifestCache } from './manifest-cache.js';
export type { ManifestCache } from './manifest-cache.js';

export { createReplayDetector } from './replay.js';
export type { ReplayDetector } from './replay.js';

export { createEventBuffer, matchesFilter, matchesAnyFilter, RING_BUFFER_SIZE } from './event-buffer.js';
export type { EventBuffer, SubscriptionEntry } from './event-buffer.js';

export {
  createRelayEventResult,
  createRelayEventResultWithHints,
  relayEventResultFromCarrier,
} from './relay-result.js';
export type { RelayEventCarrier, RelayEventResult, RelayEventSidecar } from './relay-result.js';

export { createRuntime } from './runtime.js';
export type { Runtime } from './runtime.js';

export { handleStorageNap, cleanupNappState } from './state-handler.js';

export { routeServiceMessage, notifyServiceWindowDestroyed } from './service-dispatch.js';

export type { Capability } from '@kehto/acl/capabilities';
export { ALL_CAPABILITIES } from '@kehto/acl/capabilities';
export type { ServiceDescriptor } from './types.js';
