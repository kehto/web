import type { NostrEvent, NostrFilter } from '@napplet/core';
import type {
  SessionEntry,
  ServiceHandler,
  ShellAdapter,
} from '@kehto/shell';
import type { Signer } from '@kehto/runtime';
import {
  createBleService,
  createCommonService,
  createConfigService,
  createCatalogIntentResolver,
  createCountService,
  createCvmService,
  createFsService,
  createIdentityService,
  createIntentService,
  createKeysService,
  createLinkService,
  createListsService,
  createMediaService,
  createNotifyService,
  createOutboxService,
  createRelayPoolOutboxRouter,
  createRelayPoolService,
  createResourceService,
  createSerialService,
  createThemeService,
  type UploadInfoProvider,
  createUploadService,
  createWebrtcService,
  type IntentCandidate,
  type IntentRequest,
  type ConfigServiceOptions,
  type DmService,
  type NotifyServiceOptions,
} from '@kehto/services';
import {
  createNostrCvmTransport,
  type CvmRelayPool,
  type NostrEventLike,
  type NostrFilterLike,
} from '@kehto/services/cvm-nostr-transport';
import type { Theme, ThemeChangedMessage } from '@napplet/nap/theme/types';
import { verifyEvent } from 'nostr-tools/pure';

import {
  createBrowserBleController,
  createBrowserSerialController,
  type PajaUserActivationHandler,
} from './browser-device-services.js';
import type { PajaHostConfig } from './options.js';
import type { PajaSignerMethod } from './browser-signers.js';
import type { PajaSimulation } from './simulation.js';
import { BrowserIntentController } from './browser-intent-controller.js';
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';
import { createPajaUploadRuntime, type PajaUploadRuntime } from './browser-upload.js';
import { createPajaSocialCache } from './browser-social-cache.js';
import { createPajaCommonBackend } from './browser-common.js';
import { createPajaListsBackend } from './browser-lists.js';
import { createPajaResourceFetch, pajaResourceInfo } from './browser-resource.js';
import { createPajaWebrtcController } from './browser-webrtc.js';
import { createPajaBrowserFsBackend } from './browser-fs.js';
import {
  PAJA_DEV_SIGNER_PUBKEY,
  createPajaDevDmService,
  createPajaDevSigner,
} from './browser-dev-runtime.js';
import {
  createPajaRelayConfig,
  createPajaRelayHooks,
  hasWritableLocalStorage,
  isPajaRelayAllowed,
  type PajaRelayConfigRuntime,
} from './browser-relay-policy.js';
import {
  PAJA_LIVE_QUERY_WAIT_MS,
  createPajaContactListLoader,
  createPajaOutboxRelayPool,
  createPajaRelayBackend,
  createPajaRelayListLoader,
  getPajaRelayUrls,
  type PajaRelayBackend,
} from './browser-relay-runtime.js';
import { createPajaWorkerRelay } from './browser-worker-relay.js';
import type {
  PajaSignerRequestContext,
  PajaSignerSource,
} from './browser-signer-consent.js';

/** Confirmation request emitted before Paja signs, publishes, or uploads. */
export type PajaConfirmationRequest =
  | {
      readonly action: 'sign' | 'publish';
      readonly event: NostrEvent | Partial<NostrEvent>;
      readonly signerContext?: PajaSignerRequestContext;
    }
  | {
      readonly action: 'upload';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly filename?: string;
      readonly size: number;
      readonly mimeType?: string;
      readonly server: string;
      readonly warning: string;
    }
  | {
      readonly action: 'link';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly url: string;
      readonly label?: string;
    }
  | {
      readonly action: 'serial' | 'ble';
      readonly windowId: string;
      readonly label?: string;
      readonly details: string;
    }
  | {
      readonly action: 'notify';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly channel?: string;
    }
  | {
      readonly action: 'webrtc';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly scope: string;
      readonly warning: string;
    }
  | {
      readonly action: 'dm';
      readonly recipients: readonly string[];
      readonly content: string;
      readonly warning: string;
    }
  | {
      readonly action: 'fs';
      readonly windowId: string;
      readonly kind: 'file' | 'files' | 'directory' | 'save-file';
      readonly description: string;
    };

/** Async-capable host policy callback for user-visible Paja operations. */
export type PajaConfirmationHandler = (
  request: PajaConfirmationRequest,
) => boolean | Promise<boolean>;

/** Paja runtime signer provider. */
export interface PajaSignerProvider {
  /** Active signer, if connected. */
  getSigner(source?: PajaSignerSource): Signer | null;
  /** Selected signer backend. */
  getMethod(): PajaSignerMethod;
  /** Active signer pubkey, if connected. */
  getPubkey(): string | null;
  /** Observe signer identity lifecycle changes. */
  subscribe?(listener: () => void): () => void;
}

/** Identity provider for Paja's simulated target identity. */
export type PajaIdentityProvider = (
  windowId?: string,
) => Pick<SessionEntry, 'dTag' | 'aggregateHash'>;

export { PAJA_DEV_SIGNER_PUBKEY } from './browser-dev-runtime.js';

interface PajaIntentHost {
  readonly catalog: InstalledNappletCatalog;
  readonly controller: BrowserIntentController;
  getDefaultHandler?(archetype: string): string | undefined;
  chooseHandler?(
    archetype: string,
    candidates: IntentCandidate[],
    sender: string,
  ): string | undefined | Promise<string | undefined>;
  authorizeExplicitHandler?(
    sender: string,
    handler: string,
    request: IntentRequest,
    candidate: IntentCandidate,
  ): boolean | Promise<boolean>;
}

function createPajaCvmRelayPool(backend: PajaRelayBackend): CvmRelayPool {
  return {
    subscribe(relays: string[], filter: NostrFilterLike, params) {
      const subscription = backend.subscription(relays, [filter as NostrFilter]).subscribe((item) => {
        if (item === 'EOSE') params.oneose?.();
        else if (typeof item === 'object' && item !== null) params.onevent?.(item as NostrEventLike);
      });
      return {
        close() {
          subscription.unsubscribe();
        },
      };
    },
    async publish(relays: string[], event: NostrEventLike) {
      const outcomes = await backend.publishToRelays(relays, event as NostrEvent);
      if (!Object.values(outcomes).some(Boolean)) throw new Error('publish failed');
    },
  };
}

function createOutboxRouter(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  relayConfig: PajaRelayConfigRuntime,
  confirmRequest: PajaConfirmationHandler,
  signerProvider?: PajaSignerProvider,
) {
  return createRelayPoolOutboxRouter({
    relayPool: createPajaOutboxRelayPool(backend),
    loadRelayLists: createPajaRelayListLoader(
      backend,
      getSimulation,
      signerProvider,
      () => relayConfig.getRelayUrls(['discovery', 'super']),
    ),
    fallbackRelays: relayConfig.outboxRelays,
    signEvent: async (template) => {
      const signer = createRuntimeSigner(getSimulation, confirmRequest, signerProvider);
      if (!signer?.signEvent) throw new Error('no signer configured');
      const event = { ...template };
      event.created_at ??= Math.floor(Date.now() / 1000);
      event.kind ??= 1;
      event.tags ??= [];
      event.content ??= '';
      return signer.signEvent(event);
    },
    verifyEvent: (event) => verifyEvent(event as Parameters<typeof verifyEvent>[0]),
    isRelayAllowed: (url) => isPajaRelayAllowed(url, () => relayConfig.getRelayUrls()),
    defaultTimeoutMs: PAJA_LIVE_QUERY_WAIT_MS,
  });
}

/**
 * Create a theme object from Paja simulation settings.
 *
 * @param mode - Theme mode.
 * @param values - Extra theme values.
 * @returns Theme object exposed to the simulated runtime.
 */
export function createDevTheme(mode: PajaSimulation['theme']['mode'], values: PajaSimulation['theme']['values']): Theme {
  const defaultColors = mode === 'light'
    ? { background: '#f7f5ed', text: '#1d211d', primary: '#6a5a12' }
    : { background: '#101211', text: '#f4f0df', primary: '#d8c36a' };
  return {
    ...values,
    colors: {
      ...defaultColors,
      ...((typeof values.colors === 'object' && values.colors !== null && !Array.isArray(values.colors)) ? values.colors : {}),
    },
  } as Theme;
}

function getRuntimePubkey(
  getSimulation: () => PajaSimulation,
  signerProvider?: PajaSignerProvider,
): string {
  return signerProvider?.getPubkey()
    || (signerProvider?.getMethod() === 'dev' ? PAJA_DEV_SIGNER_PUBKEY : '')
    || getSimulation().identity.pubkey;
}

function createRuntimeSigner(
  getSimulation: () => PajaSimulation,
  confirmRequest: PajaConfirmationHandler,
  signerProvider?: PajaSignerProvider,
  source?: PajaSignerSource,
): Signer | null {
  const signer = signerProvider?.getSigner(source);
  if (!signer) {
    if (signerProvider?.getMethod() === 'dev') {
      return createPajaDevSigner(getSimulation, confirmRequest, source);
    }
    const fixedPubkey = getSimulation().identity.pubkey;
    if (fixedPubkey) {
      return {
        getPublicKey: () => fixedPubkey,
        getRelays: () => Object.fromEntries(getPajaRelayUrls(getSimulation()).map((relay) => [relay, { read: true, write: true }])),
      };
    }
    return null;
  }
  return signer;
}

interface PajaServiceBundle {
  readonly services: Record<string, ServiceHandler>;
  refreshAvailability(): boolean;
}

function createDevServices(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  relayConfig: PajaRelayConfigRuntime,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
  onThemeBroadcast: (envelope: ThemeChangedMessage) => void,
  confirmRequest: PajaConfirmationHandler,
  getBlossomServers: () => readonly string[],
  uploadRuntime?: PajaUploadRuntime,
  signerProvider?: PajaSignerProvider,
  intentHost?: PajaIntentHost,
  getIdentity?: PajaIdentityProvider,
  userActivation?: PajaUserActivationHandler,
  notifyOptions?: NotifyServiceOptions,
  configOptions?: ConfigServiceOptions,
): PajaServiceBundle {
  const theme = createThemeService({
    initialTheme: createDevTheme(getSimulation().theme.mode, getSimulation().theme.values),
    onBroadcast: onThemeBroadcast,
  });
  onThemeService(theme);
  const config = configOptions ? createConfigService(configOptions) : null;
  const getReadRelays = () => relayConfig.getRelayUrls(['discovery', 'super']);
  const getWriteRelays = () => relayConfig.getRelayUrls(['outbox']);
  const getAllRelays = () => relayConfig.getRelayUrls();
  const baseOutboxRouter = createOutboxRouter(backend, getSimulation, relayConfig, confirmRequest, signerProvider);
  const socialCache = createPajaSocialCache({
    baseRouter: baseOutboxRouter,
    loadContactList: createPajaContactListLoader(backend, getSimulation, signerProvider, getReadRelays),
    verifyEvent: (event) => verifyEvent(event as Parameters<typeof verifyEvent>[0]),
    getActivePubkey: () => getRuntimePubkey(getSimulation, signerProvider),
    subscribeSignerChange: signerProvider?.subscribe?.bind(signerProvider),
  });
  const commonBackend = createPajaCommonBackend({
    relay: backend,
    getRelays: getAllRelays,
    getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
  });
  const listsBackend = createPajaListsBackend({
    relay: backend,
    getRelays: getAllRelays,
    getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
  });
  void socialCache.refreshActiveIdentity();
  const services: Record<string, ServiceHandler> = {
    resource: createResourceService({
      fetch: createPajaResourceFetch({ getBlossomServers }),
      isOriginGranted: (origin, grants) => grants.includes(origin),
      getConnectGrants: () => ['null'],
      resolveIdentity: (windowId) => getIdentity?.(windowId) ?? null,
      resourceInfo: () => pajaResourceInfo(getBlossomServers()),
    }),
  };
  if (getSimulation().capabilities.domains.keys && typeof document !== 'undefined') {
    services.keys = createKeysService({ listenerTarget: document });
  }

  if (getSimulation().relay.mode === 'live') {
    services.relay = createRelayPoolService({
      subscribe: (filters, callback, relayUrls) => backend.subscription(
        (relayUrls ?? getReadRelays()).filter((url) => isPajaRelayAllowed(url, getAllRelays)),
        filters,
      ).subscribe((item) => {
        if (item === 'EOSE' || (typeof item === 'object' && item !== null)) {
          callback(
            item as NostrEvent | 'EOSE',
            item === 'EOSE' ? undefined : backend.observedRelayUrls((item as NostrEvent).id),
          );
        }
      }),
      publish: (event) => backend.publish(getWriteRelays(), event),
      selectRelayTier: getReadRelays,
      isAvailable: () => backend.isAvailable(),
    });
    services.outbox = createOutboxService({
      router: baseOutboxRouter,
      getQueryRouter: (windowId, context) => socialCache.decorate(
        baseOutboxRouter,
        () => context?.hasCapability(windowId, 'identity:read') ?? false,
      ),
    });
  }
  if (getSimulation().capabilities.domains.count && getSimulation().relay.mode === 'live') {
    services.count = createCountService({
      count: async ({ filters }) => {
        const relays = getReadRelays();
        const result = await backend.countWithRelay(relays, filters);
        return {
          ok: true,
          count: result.count,
          approximate: false,
          relays: [result.relay],
        };
      },
      isFilterSupported: (filter) => {
        if (Object.keys(filter).length === 0) {
          return 'broad empty filters are too expensive for the Paja count backend';
        }
        return true;
      },
    });
  }

  if (getSimulation().capabilities.domains.identity) {
    services.identity = createIdentityService({
      getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
      getFollows: socialCache.getFollows,
    });
  }
  if (getSimulation().notifications.enabled && notifyOptions) {
    services.notify = createNotifyService(notifyOptions);
  }
  if (
    getSimulation().media.enabled
    && typeof navigator !== 'undefined'
    && 'mediaSession' in navigator
    && typeof document !== 'undefined'
  ) services.media = createMediaService({ mediaSessionTarget: navigator.mediaSession, documentTarget: document });
  if (getSimulation().capabilities.domains.theme) services.theme = theme.handler;
  if (getSimulation().capabilities.domains.config && config) services.config = config.handler;
  if (getSimulation().cvm.enabled && getSimulation().relay.mode === 'live' && backend.isAvailable()) {
    services.cvm = createCvmService({
      transport: createNostrCvmTransport({
        defaultRelays: relayConfig.allRelays,
        pool: createPajaCvmRelayPool(backend),
        clientInfo: { name: '@kehto/paja', version: '0.11.0' },
      }),
    });
  }
  if (uploadRuntime) {
    services.upload = createUploadService({
      uploader: uploadRuntime.uploader,
      uploadInfo: uploadRuntime.uploadInfo as UploadInfoProvider,
    });
  }
  if (getSimulation().intent.enabled && intentHost) {
    const resolver = createCatalogIntentResolver({
      loadCatalog: () => intentHost.catalog.intentCatalog(),
      targets: intentHost.controller,
      getDefaultHandler: intentHost.getDefaultHandler,
      chooseHandler: intentHost.chooseHandler,
      authorizeExplicitHandler: intentHost.authorizeExplicitHandler,
    });
    services.intent = createIntentService({
      resolver,
    });
  }
  if (
    getSimulation().capabilities.domains.link
    && typeof window !== 'undefined'
    && typeof window.open === 'function'
  ) {
    services.link = createLinkService({
      open: async ({ windowId, url, options }) => {
        const napplet = getIdentity?.(windowId) ?? { dTag: 'dev-target', aggregateHash: 'paja' };
        const allowed = await confirmRequest({
          action: 'link',
          windowId,
          napplet,
          url: url.href,
          ...(options?.label ? { label: options.label } : {}),
        });
        return { status: allowed && openPajaExternalLink(url) ? 'opened' : 'denied' };
      },
    });
  }
  if (getSimulation().capabilities.domains.common && getSimulation().relay.mode === 'live') {
    services.common = createCommonService({
      getProfile: (target) => commonBackend.getProfile(target),
      follows: () => commonBackend.follows(),
      follow: (pubkeys) => commonBackend.follow(pubkeys),
      unfollow: (pubkeys) => commonBackend.unfollow(pubkeys),
      react: (targetEventId, reaction, customEmojiHref) => commonBackend.react(targetEventId, reaction, customEmojiHref),
      report: (target, reason, text) => commonBackend.report(target, reason, text),
    });
  }
  if (getSimulation().capabilities.domains.lists && getSimulation().relay.mode === 'live') {
    services.lists = createListsService({
      supported: () => listsBackend.supported(),
      add: (list, items, options) => listsBackend.add(list, items, options),
      remove: (list, items, options) => listsBackend.remove(list, items, options),
    });
  }
  if (getSimulation().capabilities.domains.serial) {
    const controller = userActivation ? createBrowserSerialController(userActivation) : null;
    if (controller) services.serial = createSerialService(controller);
  }
  if (getSimulation().capabilities.domains.ble) {
    const controller = userActivation ? createBrowserBleController(userActivation) : null;
    if (controller) services.ble = createBleService(controller);
  }
  const webrtcController = getSimulation().relay.mode === 'live' && backend.isAvailable()
    ? createPajaWebrtcController({
      relay: {
        subscribe(filters, onEvent) {
          const subscription = backend.subscription(getAllRelays(), filters).subscribe((item) => {
            if (typeof item === 'object' && item !== null) onEvent(item as NostrEvent);
          });
          return { close: () => subscription.unsubscribe() };
        },
        publish: (event) => backend.publishWebrtcSignal(getAllRelays(), event),
      },
      getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
      getPubkey: () => getRuntimePubkey(getSimulation, signerProvider),
      getIdentity: getIdentity ?? (() => ({ dTag: 'dev-target', aggregateHash: 'paja' })),
      confirm: confirmRequest,
    })
    : null;
  const webrtcService = webrtcController ? createWebrtcService(webrtcController.serviceOptions) : null;
  let dmService: DmService | null = null;

  function setDmAvailability(enabled: boolean): boolean {
    const wasEnabled = Object.hasOwn(services, 'dm');
    if (enabled && !dmService) {
      dmService = createPajaDevDmService(backend, getAllRelays, confirmRequest);
      services.dm = dmService;
    } else if (!enabled && dmService) {
      dmService.dispose();
      dmService = null;
      delete services.dm;
    }
    return wasEnabled !== enabled;
  }

  function refreshAvailability(): boolean {
    const wasWebrtcEnabled = Object.hasOwn(services, 'webrtc');
    const webrtcEnabled = getSimulation().capabilities.domains.webrtc
      && getSimulation().relay.mode === 'live'
      && backend.isAvailable()
      && webrtcController?.refreshAvailability() === true;
    if (webrtcEnabled && webrtcService) services.webrtc = webrtcService;
    else delete services.webrtc;
    const dmChanged = setDmAvailability(
      getSimulation().capabilities.domains.dm
      && getSimulation().relay.mode === 'live'
      && backend.isAvailable()
      && signerProvider?.getMethod() === 'dev',
    );
    return wasWebrtcEnabled !== webrtcEnabled || dmChanged;
  }
  refreshAvailability();

  return { services, refreshAvailability };
}

/**
 * Create the shell adapter backing the Paja browser runtime.
 *
 * @param config - Host-page config.
 * @param getSimulation - Current simulation model getter.
 * @param onThemeService - Callback receiving the created theme service.
 * @param onThemeBroadcast - Callback forwarding the service's single theme update.
 * @param confirmRequest - Sign/publish confirmation callback.
 * @param signerProvider - Optional external signer provider.
 * @param getIdentity - Optional simulated target identity provider.
 * @param onEnvironmentChanged - Invoked when asynchronous host wiring changes.
 * @param intentHost - Installed catalog, target controller, and user policy.
 * @param userActivation - Host-click broker for device chooser APIs.
 * @param notifyOptions - Host-backed notification presentation hooks.
 * @param configOptions - Host-backed scoped persistence and settings UI hooks.
 * @returns Shell adapter plus a startup promise for asynchronous host probes.
 */
export function createPajaAdapter(
  config: PajaHostConfig,
  getSimulation: () => PajaSimulation,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
  onThemeBroadcast: (envelope: ThemeChangedMessage) => void,
  confirmRequest: PajaConfirmationHandler,
  signerProvider?: PajaSignerProvider,
  getIdentity?: PajaIdentityProvider,
  onEnvironmentChanged?: () => void,
  intentHost?: PajaIntentHost,
  userActivation?: PajaUserActivationHandler,
  notifyOptions?: NotifyServiceOptions,
  configOptions?: ConfigServiceOptions,
): ShellAdapter & { readonly ready: Promise<void> } {
  const resolveIdentity = (windowId?: string) => getIdentity?.(windowId) ?? {
    dTag: config.window.dTag,
    aggregateHash: config.window.aggregateHash,
  };
  const signerSource = (windowId: string): PajaSignerSource => {
    const napplet = resolveIdentity(windowId);
    return {
      windowId,
      napplet,
      runtimeScope: config.target?.mode === 'iframe-url'
        ? `target-url:${config.target.url}`
        : `artifact:${napplet.aggregateHash}`,
    };
  };
  const relayBackend = createPajaRelayBackend(getSimulation, confirmRequest);
  const relayConfig = createPajaRelayConfig(getSimulation);
  const uploadRuntime = getSimulation().upload.mode === 'blossom'
    ? createPajaUploadRuntime({
        getSimulation,
        getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
        getProviderPubkey: () => signerProvider?.getPubkey() ?? null,
        queryDiscovery: (relayUrls, filters) => relayBackend.query(relayUrls, filters),
        getRelayUrls: () => relayConfig.getRelayUrls(['discovery', 'super']),
        confirmRequest,
        getNappletIdentity: resolveIdentity,
        subscribeSignerChange: signerProvider?.subscribe?.bind(signerProvider),
      })
    : undefined;
  const getBlossomServers = () => [
    ...(config.target?.pointer?.blossomServers ?? []),
    ...(uploadRuntime?.getServers() ?? getSimulation().upload.servers),
  ];
  void uploadRuntime?.refreshIdentity();
  const workerRelayEvents: NostrEvent[] = [];
  const serviceBundle = createDevServices(
    relayBackend,
    getSimulation,
    relayConfig,
    onThemeService,
    onThemeBroadcast,
    confirmRequest,
    getBlossomServers,
    uploadRuntime,
    signerProvider,
    intentHost,
    resolveIdentity,
    userActivation,
    notifyOptions,
    configOptions,
  );
  const services = serviceBundle.services;
  const ready = createPajaBrowserFsBackend({
    getIdentity: resolveIdentity,
    userActivation,
  }).then((fsBackend) => {
    if (!fsBackend) return;
    services.fs = createFsService({ backend: fsBackend });
    if (getSimulation().capabilities.domains.fs) queueMicrotask(() => onEnvironmentChanged?.());
  });
  signerProvider?.subscribe?.(() => {
    const availabilityChanged = serviceBundle.refreshAvailability();
    if (uploadRuntime) {
      void uploadRuntime.refreshIdentity().finally(() => onEnvironmentChanged?.());
    } else if (availabilityChanged) {
      onEnvironmentChanged?.();
    }
  });
  return {
    ready,
    relayPool: createPajaRelayHooks(relayBackend, getSimulation, relayConfig),
    relayConfig,
    windowManager: { createWindow: () => null },
    auth: {
      getUserPubkey: () => getRuntimePubkey(getSimulation, signerProvider),
      getSigner: (windowId) => createRuntimeSigner(
        getSimulation,
        confirmRequest,
        signerProvider,
        windowId ? signerSource(windowId) : undefined,
      ),
    },
    services,
    get capabilities() {
      const disabled = new Set(getSimulation().capabilities.disabledDomains);
      if (
        getSimulation().relay.mode !== 'live'
        || !relayBackend.isAvailable()
        || !Object.hasOwn(services, 'relay')
      ) disabled.add('relay');
      if (getSimulation().storage.mode !== 'local' || !hasWritableLocalStorage()) disabled.add('storage');
      for (const domain of ['identity', 'theme', 'keys', 'media', 'notify'] as const) {
        if (!Object.hasOwn(services, domain)) disabled.add(domain);
      }
      return { disabledDomains: [...disabled] };
    },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: forwardPajaHotkey },
    workerRelay: { getWorkerRelay: () => createPajaWorkerRelay(workerRelayEvents) },
    upload: uploadRuntime ? { getUploader: uploadRuntime.getBackend } : undefined,
    intent: { isAvailable: () => Object.hasOwn(services, 'intent') },
    link: { isAvailable: () => Object.hasOwn(services, 'link') },
    common: { isAvailable: () => Object.hasOwn(services, 'common') },
    lists: { isAvailable: () => Object.hasOwn(services, 'lists') },
    serial: { isAvailable: () => Object.hasOwn(services, 'serial') },
    ble: { isAvailable: () => Object.hasOwn(services, 'ble') },
    webrtc: { isAvailable: () => Object.hasOwn(services, 'webrtc') },
    crypto: {
      verifyEvent: async (event) => verifyEvent(event as Parameters<typeof verifyEvent>[0]),
    },
  };
}

/**
 * Hand an allowed external web URL to the browser without exposing an opener.
 *
 * @param url - Absolute URL already validated by the NAP-LINK service.
 * @returns Whether the browser accepted the navigation handoff.
 */
export function openPajaExternalLink(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  try {
    window.open(url.href, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

/**
 * Replay a NAP-KEYS forwarded keystroke in Paja's host context.
 *
 * @param event - Normalized keyboard fields received from the napplet.
 */
export function forwardPajaHotkey(event: {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', {
    ...event,
    bubbles: true,
    cancelable: true,
  }));
}
