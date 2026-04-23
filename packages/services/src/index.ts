/**
 * @kehto/services — Reference service implementations for the napplet protocol.
 *
 * Provides factory functions for creating ServiceHandler implementations:
 * - createAudioService() — Audio source registry
 * - createNotificationService() — Notification state management
 *
 * These are reference implementations. Shell hosts wire them into the
 * runtime via registerService(). The services are browser-agnostic —
 * shell adapters provide browser-specific callbacks.
 *
 * @example
 * ```ts
 * import { createAudioService, createNotificationService } from '@kehto/services';
 * import type { AudioSource, Notification } from '@kehto/services';
 *
 * const audio = createAudioService({ onChange: (sources) => updateUI(sources) });
 * const notifications = createNotificationService({ onChange: (list) => updateBadge(list) });
 *
 * runtime.registerService('audio', audio);
 * runtime.registerService('notifications', notifications);
 * ```
 *
 * @packageDocumentation
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type {
  AudioSource,
  AudioServiceOptions,
  Notification,
  NotificationServiceOptions,
} from './types.js';

// ─── Audio Service ─────────────────────────────────────────────────────────

export { createAudioService } from './audio-service.js';

// ─── Notification Service ──────────────────────────────────────────────────

export { createNotificationService } from './notification-service.js';

// ─── Identity Service (NIP-5D identity NUB) ───────────────────────────────
export { createIdentityService } from './identity-service.js';
export type { IdentityServiceOptions } from './identity-service.js';

// ─── Relay Pool Service ───────────────────────────────────────────────────
export { createRelayPoolService } from './relay-pool-service.js';
export type { RelayPoolServiceOptions } from './relay-pool-service.js';

// ─── Cache Service ────────────────────────────────────────────────────────
export { createCacheService } from './cache-service.js';
export type { CacheServiceOptions } from './cache-service.js';

// ─── Coordinated Relay (composite service) ────────────────────────────────
export { createCoordinatedRelay } from './coordinated-relay.js';
export type { CoordinatedRelayOptions } from './coordinated-relay.js';

// ─── Keys Service (NIP-5D keys NUB — document-level chord listener) ──────
// Public surface: factory + options + host-bridge contract. Host apps wire
// OS-level hotkey backends by implementing HostKeysBridge and passing it
// through createKeysService({ hostBridge }).
export { createKeysService } from './keys-service.js';
export type {
  KeysServiceOptions,
  HostKeysBridge,
  HostKeyEvent,
} from './keys-service.js';

// ─── Media Service (NIP-5D media NUB — navigator.mediaSession mirror) ─────
// Public surface: factory + options + host-bridge contract + browser bridge
// factory. Host apps wire OS-level native media backends by implementing
// HostMediaBridge and passing it through createMediaService({ hostBridge }).
export { createMediaService, createBrowserMediaBridge } from './media-service.js';
export type {
  MediaServiceOptions,
  HostMediaBridge,
} from './media-service.js';
// Convenience re-export: host apps implementing HostMediaBridge need the
// MediaAction literal for their onAction callback typing. Re-exported here
// so host-app code can depend only on @kehto/services, mirroring the Phase 26
// HostKeyEvent pattern.
export type { MediaAction } from '@napplet/nub/media/types';

// ─── Notify Service (NIP-5D notify NUB — stub) ────────────────────────────
// Coexists with createNotificationService above (legacy ifc-emit path).
// See notify-service.ts JSDoc for the coexistence contract.
export { createNotifyService } from './notify-service.js';
export type { NotifyServiceOptions } from './notify-service.js';

// ─── Theme Service (NIP-5D theme NUB) ─────────────────────────────────────
export { createThemeService } from './theme-service.js';
export type { ThemeServiceOptions, ThemeService } from './theme-service.js';
