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

export type {
  AudioSource,
  AudioServiceOptions,
  Notification,
  NotificationServiceOptions,
} from './types.js';

export { createAudioService } from './audio-service.js';

export { createNotificationService } from './notification-service.js';

export { createIdentityService } from './identity-service.js';
export type {
  GiftWrapDecryptResult,
  HostDecryptBridge,
  IdentityDecryptErrorCode,
  IdentityDecryptErrorMessage,
  IdentityDecryptMessage,
  IdentityDecryptResultMessage,
  IdentityServiceOptions,
  Rumor,
  VerifyEvent,
} from './identity-service.js';

export { createRelayPoolService } from './relay-pool-service.js';
export type { RelayPoolServiceOptions } from './relay-pool-service.js';

export { createCacheService } from './cache-service.js';
export type { CacheServiceOptions, HostCacheBridge } from './cache-service.js';

export { createCoordinatedRelay } from './coordinated-relay.js';
export type { CoordinatedRelayOptions } from './coordinated-relay.js';

export { createKeysService } from './keys-service.js';
export type {
  KeysServiceOptions,
  HostKeysBridge,
  HostKeyEvent,
} from './keys-service.js';

export { createMediaService, createBrowserMediaBridge } from './media-service.js';
export type {
  MediaServiceOptions,
  HostMediaBridge,
  MediaSessionTarget,
  MediaMetadataLike,
  MediaPlaybackOwner,
  MediaSourceRef,
  MediaSessionCreateOptions,
} from './media-service.js';
// Convenience re-export: host apps implementing HostMediaBridge need the
// MediaAction literal for their onAction callback typing. Re-exported here
// so host-app code can depend only on @kehto/services, mirroring the Phase 26
// HostKeyEvent pattern.
export type { MediaAction } from '@napplet/nub/media/types';

export { createNotifyService } from './notify-service.js';
export type { NotifyServiceOptions } from './notify-service.js';

export { createThemeService } from './theme-service.js';
export type { ThemeServiceOptions, ThemeService } from './theme-service.js';

export { createConfigService } from './config-service.js';
export type {
  ConfigServiceOptions,
  ConfigService,
  ConfigSchemaValidation,
} from './config-service.js';

export { createResourceService } from './resource-service.js';
export type {
  ResourceServiceOptions,
  ResourceService,
} from './resource-service.js';

export { createOutboxService } from './outbox-service.js';
export type {
  OutboxServiceOptions,
  OutboxRouter,
  OutboxResult,
  OutboxPublishResult,
  OutboxRelayPlan,
  OutboxQueryOptions,
  OutboxSubscribeOptions,
  OutboxPublishOptions,
  OutboxTarget,
  OutboxStrategy,
  OutboxSubscriptionSink,
  OutboxRouterSubscription,
} from './outbox-service.js';

export { createRelayPoolOutboxRouter } from './relay-pool-outbox-router.js';
export type {
  RelayPoolOutboxRouterOptions,
  OutboxRelayPool,
  RelayListEntry,
} from './relay-pool-outbox-router.js';

export { createCvmService } from './cvm-service.js';
export type {
  CvmService,
  CvmServiceOptions,
  CvmTransport,
} from './cvm-service.js';
export type {
  McpMessage,
  McpTool,
  McpContentBlock,
  McpToolResult,
  CvmServer,
  CvmServerRef,
  CvmDiscoverQuery,
  CvmRequestOptions,
  CvmDiscoverMessage,
  CvmDiscoverResultMessage,
  CvmRequestMessage,
  CvmRequestResultMessage,
  CvmCloseMessage,
  CvmCloseResultMessage,
  CvmEventMessage,
  CvmInboundMessage,
  CvmOutboundMessage,
  CvmTransportError,
} from './cvm-types.js';
