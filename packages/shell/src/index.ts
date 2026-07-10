
// Factory function — main entry point
export { createShellBridge } from './shell-bridge.js';
export type { ShellBridge } from './shell-bridge.js';
export {
  injectNappletNamespacePrelude,
  renderNappletNamespacePrelude,
} from './napplet-namespace.js';
export type { NappletNamespacePreludeOptions } from './napplet-namespace.js';

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
  UploadHooks,
  UploadBackendLike,
  IntentHooks,
  LinkHooks,
  CommonHooks,
  ListsHooks,
  SerialHooks,
  BleHooks,
  WebrtcHooks,
  CapabilityHooks,
  SessionEntry,
  NappKeyEntry,  // @deprecated — use SessionEntry
  AclEntry,
  AclCheckEvent,
  UnroutedMessageInfo,
  ServiceDescriptor,
  ServiceHandler,
  ServiceRegistry,
} from './types.js';

// Shell initialization — capability construction for shell.ready / shell.init handshake
export { buildShellCapabilities } from './shell-init.js';

export { sessionRegistry, nappKeyRegistry } from './session-registry.js';
export type { PendingUpdate, SessionRegistry } from './session-registry.js';

// Standalone utilities (usable without full shell)
export { originRegistry } from './origin-registry.js';
export type { OriginIdentity, OriginRegistry } from './origin-registry.js';
export { audioManager } from './audio-manager.js';
export type { AudioManager, AudioSource } from './audio-manager.js';
export { manifestCache } from './manifest-cache.js';
export type { ManifestCache, ManifestCacheEntry } from './manifest-cache.js';
export type { AclStore } from './acl-store.js';

// Enforcement gate (re-exported from @kehto/runtime for backwards compatibility)
export { createEnforceGate, createNapEnforceGate, formatDenialReason } from '@kehto/runtime';
export type { EnforceResult, EnforceConfig, NapEnforceConfig, IdentityResolver, AclChecker, NapMessage } from '@kehto/runtime';
// ConsentRequest canonical definition re-exported from @kehto/runtime
export type { ConsentRequest } from '@kehto/runtime';

// Topic constants for shell command routing
export { TOPICS } from './topics.js';
export type { TopicKey, TopicValue } from './topics.js';

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

export type {
  ResourceBytesRequest,
  ResourceInfo,
  ResourceInfoError,
  ResourceInfoRequest,
  ResourceInfoResult,
  ResourceBytesManyRequest,
  ResourceBytesManyItem,
  ResourceCancelRequest,
  ResourceBytesResult,
  ResourceBytesManyResult,
  ResourceBytesError,
  ResourceBytesManyError,
  ResourceErrorCode,
  ResourceRequestId,
  ResourceInbound,
  ResourceOutbound,
} from './types/internal-resource.js';
