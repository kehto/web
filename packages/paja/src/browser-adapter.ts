import { originRegistry } from '@kehto/shell';
import type { NostrEvent } from '@napplet/core';
import type {
  SessionEntry,
  ServiceHandler,
  ShellAdapter,
} from '@kehto/shell';
import type { Signer } from '@kehto/runtime';
import {
  browserGamepadOptions,
  createGamepadService,
  createBleService,
  createCommonService,
  createConfigService,
  createCountService,
  createCvmService,
  createFsService,
  createLlmService,
  createIdentityService,
  createKeysService,
  createLinkService,
  createListsService,
  createMediaService,
  createBrowserMediaPlayback,
  createBrowserMediaStreamFetch,
  mountMediaPlayer,
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
  type ConfigServiceOptions,
  type DmService,
  type NotifyServiceOptions,
} from '@kehto/services';
import {
  createNostrCvmTransport,
} from '@kehto/services/cvm-nostr-transport';
import type { Theme, ThemeChangedMessage } from '@napplet/nap/theme/types';
import { verifyEvent } from 'nostr-tools/pure';

import {
  createBrowserBleController,
  createBrowserSerialController,
  type PajaUserActivationHandler,
} from './browser-device-services.js';
import { createPajaCatalogIntentService, type PajaIntentHost } from './browser-catalog-intent-service.js';
import type { PajaHostConfig } from './options.js';
import type { PajaSignerMethod } from './browser-signers.js';
import type { PajaSimulation } from './simulation.js';
import { createPajaUploadRuntime, type PajaUploadRuntime } from './browser-upload.js';
import { createPajaBlossomEventResolver } from './browser-blossom-events.js';
import { createPajaSocialCache } from './browser-social-cache.js';
import { createPajaCommonBackend } from './browser-common.js';
import { createPajaListsBackend } from './browser-lists.js';
import { createPajaResourceFetch, pajaResourceInfo } from './browser-resource.js';
import { createPajaWebrtcController } from './browser-webrtc.js';
import { createPajaBrowserFsBackend } from './browser-fs.js';
import {
  createPajaDevDmService,
} from './browser-dev-runtime.js';
import type { PajaLlmHost } from './browser-llm-connections.js';
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
  type PajaRelayBackend,
} from './browser-relay-runtime.js';
import { createPajaWorkerRelay } from './browser-worker-relay.js';
import type {
  PajaSignerRequestContext,
  PajaSignerSource,
} from './browser-signer-consent.js';
import { createPajaCvmRelayPool, createRuntimeSigner, getRuntimePubkey, createPajaWindowScope, pajaDevelopmentConsentScope, scopePajaService } from './browser-operation-scope.js';

/** Confirmation request emitted before Paja signs, publishes, or uploads. */
export type PajaConfirmationRequest = (
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
      /** NAP-LLM disclosure consent before one generation is submitted. */
      readonly action: 'llm';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly connection: string;
      readonly model: string;
      readonly route: string;
      readonly messages: number;
      readonly characters: number;
      readonly images: number;
      readonly format: 'text' | 'json';
      readonly warning: string;
    }
  | {
      /** A napplet asked for a model while no compatible connection is configured. */
      readonly action: 'llm-configure';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly requirements: string;
      readonly configured: number;
    }
  | {
      readonly action: 'fs';
      readonly windowId: string;
      readonly kind: 'file' | 'files' | 'directory' | 'save-file';
      readonly description: string;
    }) & { readonly isCurrent?: () => boolean };

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
) => Pick<SessionEntry, 'dTag' | 'aggregateHash'> & {
  readonly consentScope?: string;
  readonly isCurrent?: () => boolean;
};

/** Paja shell adapter with private verified-pointer resource context wiring. */
export interface PajaShellAdapter extends ShellAdapter {
  /** Startup promise for asynchronous host probes. */
  readonly ready: Promise<void>;
  /** Bind verified runtime-pointer Blossom hints to one authenticated window. */
  setWindowBlossomServers(windowId: string, servers: readonly string[]): void;
  /** Recompute intent availability after a host-owned default-handler update. */
  notifyIntentChanged(archetype: string): void;
}

export { PAJA_DEV_SIGNER_PUBKEY } from './browser-dev-runtime.js';

function createOutboxRouter(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  relayConfig: PajaRelayConfigRuntime,
  confirmRequest: PajaConfirmationHandler,
  signerProvider?: PajaSignerProvider,
  source?: PajaSignerSource,
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
      const signer = createRuntimeSigner(getSimulation, confirmRequest, signerProvider, source);
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

interface PajaServiceBundle {
  readonly services: Record<string, ServiceHandler>;
  refreshAvailability(): boolean;
  setWindowBlossomServers(windowId: string, servers: readonly string[]): void;
}

function createDevServices(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  relayConfig: PajaRelayConfigRuntime,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
  onThemeBroadcast: (envelope: ThemeChangedMessage) => void,
  confirmRequest: PajaConfirmationHandler,
  getConfiguredBlossomServers: () => readonly string[],
  uploadRuntime?: PajaUploadRuntime,
  signerProvider?: PajaSignerProvider,
  getIdentity?: PajaIdentityProvider,
  userActivation?: PajaUserActivationHandler,
  notifyOptions?: NotifyServiceOptions,
  configOptions?: ConfigServiceOptions,
  getSignerSource?: (windowId: string) => PajaSignerSource,
): PajaServiceBundle {
  const scopeFor = (windowId: string, isCurrent: () => boolean) => createPajaWindowScope({
    backend,
    source: getSignerSource?.(windowId) ?? {
      windowId, napplet: getIdentity?.(windowId) ?? { dTag: 'dev-target', aggregateHash: 'paja' },
      runtimeScope: `window:${windowId}`,
    },
    isCurrent,
    getPubkey: () => getRuntimePubkey(getSimulation, signerProvider),
    getSigner: (source) => createRuntimeSigner(getSimulation, confirmRequest, signerProvider, source),
  });
  const scopeKey = (windowId: string) => JSON.stringify([
    getSignerSource?.(windowId).runtimeScope,
    getIdentity?.(windowId).aggregateHash,
    getRuntimePubkey(getSimulation, signerProvider),
  ]);
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
  const blossomEventResolver = createPajaBlossomEventResolver({
    baseRouter: baseOutboxRouter,
    getDefaultAuthors: () => [getRuntimePubkey(getSimulation, signerProvider)],
    getConfiguredServers: getConfiguredBlossomServers,
  });
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
  const resourceService = createResourceService({
    stream: createBrowserMediaStreamFetch(),
    fetch: createPajaResourceFetch({
      getBlossomServers: ({ url, windowId }) => blossomEventResolver.getServers(url, windowId),
    }),
    resourceInfo: () => pajaResourceInfo(),
  });
  const services: Record<string, ServiceHandler> = {
    resource: {
      ...resourceService,
      onWindowDestroyed(windowId) {
        resourceService.onWindowDestroyed?.(windowId);
        blossomEventResolver.clearWindow(windowId);
      },
    },
  };
  if (getSimulation().capabilities.domains.gamepad) {
    services.gamepad = createGamepadService(browserGamepadOptions(typeof window === 'undefined' ? undefined : window, (target) => originRegistry.getWindowId(target)));
  }
  if (getSimulation().capabilities.domains.keys && typeof document !== 'undefined') {
    services.keys = createKeysService({ listenerTarget: document });
  }

  if (getSimulation().relay.mode === 'live') {
    const relayOptions = {
      subscribe: (filters, callback, relayUrls, fromHint) => backend.subscription(
        (relayUrls ?? getReadRelays()).filter((url) => isPajaRelayAllowed(url, getAllRelays)),
        filters, { reason: fromHint ? 'hint' : 'host' },
      ).subscribe((item) => {
        if (item === 'EOSE' || (typeof item === 'object' && item !== null)) {
          callback(
            item as NostrEvent | 'EOSE',
            item === 'EOSE' ? undefined : backend.observedRelayUrls((item as NostrEvent).id),
          );
        }
      }),
      selectRelayTier: getReadRelays,
      isAvailable: () => backend.isAvailable(),
    } satisfies Omit<Parameters<typeof createRelayPoolService>[0], 'publish'>;
    services.relay = scopePajaService(createRelayPoolService({ ...relayOptions, publish: (event) => backend.publish(getWriteRelays(), event) }),
      ['relay.publish', 'relay.publishEncrypted'], (windowId, isCurrent) => {
        const scope = scopeFor(windowId, isCurrent);
        return createRelayPoolService({ ...relayOptions, publish: (event) => scope.backend.publish(getWriteRelays(), event) });
      }, scopeKey);
    const outboxOptions = {
      router: baseOutboxRouter,
      getReadRouter: (windowId) => blossomEventResolver.decorate(baseOutboxRouter, windowId),
      getQueryRouter: (windowId, context) => blossomEventResolver.decorate(
        socialCache.decorate(
          baseOutboxRouter,
          () => context?.hasCapability(windowId, 'identity:read') ?? false,
        ),
        windowId,
      ),
    } satisfies Parameters<typeof createOutboxService>[0];
    services.outbox = scopePajaService(createOutboxService(outboxOptions), ['outbox.publish'], (windowId, isCurrent) => {
      const scope = scopeFor(windowId, isCurrent);
      return createOutboxService({ ...outboxOptions,
        router: createOutboxRouter(scope.backend, getSimulation, relayConfig, confirmRequest, signerProvider, scope.source),
      });
    }, scopeKey);
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
  if (getSimulation().media.enabled && typeof document !== 'undefined' && document.body) {
    const media = createMediaService({ playback: createBrowserMediaPlayback({ resource: resourceService, stream: resourceService.openStream }) });
    const unmount = mountMediaPlayer(media);
    services.media = { ...media, onUnregistered() { unmount(); media.destroy(); } };
  }
  if (getSimulation().capabilities.domains.theme) services.theme = theme.handler;
  if (getSimulation().capabilities.domains.config && config) services.config = config.handler;
  if (getSimulation().cvm.enabled && getSimulation().relay.mode === 'live' && backend.isAvailable()) {
    const cvm = (relay: PajaRelayBackend) => {
      const service = createCvmService({
        transport: createNostrCvmTransport({
          defaultRelays: relayConfig.allRelays, pool: createPajaCvmRelayPool(relay),
          clientInfo: { name: '@kehto/paja', version: '0.11.0' },
        }),
      });
      return { ...service, onUnregistered: () => service.dispose() };
    };
    services.cvm = scopePajaService(cvm(backend), ['cvm.request', 'cvm.close'], (windowId, isCurrent) => cvm(scopeFor(windowId, isCurrent).backend), scopeKey);
  }
  if (uploadRuntime) {
    services.upload = createUploadService({
      uploader: uploadRuntime.uploader,
      uploadInfo: uploadRuntime.uploadInfo as UploadInfoProvider,
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
        const request: PajaConfirmationRequest = {
          action: 'link',
          windowId,
          napplet,
          url: url.href,
          ...(options?.label ? { label: options.label } : {}),
          isCurrent: () => (!('isCurrent' in napplet) || typeof napplet.isCurrent !== 'function' || napplet.isCurrent())
            && (getIdentity?.(windowId).aggregateHash ?? napplet.aggregateHash) === napplet.aggregateHash,
        };
        const open = () => request.isCurrent?.() !== false && openPajaExternalLink(url);
        try {
          const opened = userActivation
            ? await userActivation.run(request, open)
            : await confirmRequest(request) && open();
          return { status: opened ? 'opened' : 'denied' };
        } catch { return { status: 'denied' }; }
      },
    });
  }
  if (getSimulation().capabilities.domains.common && getSimulation().relay.mode === 'live') {
    services.common = scopePajaService(createCommonService({
      getProfile: (target) => commonBackend.getProfile(target),
      follows: () => commonBackend.follows(),
      follow: (pubkeys) => commonBackend.follow(pubkeys),
      unfollow: (pubkeys) => commonBackend.unfollow(pubkeys),
      react: (targetEventId, reaction, customEmojiHref) => commonBackend.react(targetEventId, reaction, customEmojiHref),
      report: (target, reason, text) => commonBackend.report(target, reason, text),
    }), ['common.follow', 'common.unfollow', 'common.react', 'common.report'], (windowId, isCurrent) => {
      const scope = scopeFor(windowId, isCurrent);
      return createCommonService(createPajaCommonBackend({ relay: scope.backend, getRelays: getAllRelays, getSigner: scope.getSigner }));
    }, scopeKey);
  }
  if (getSimulation().capabilities.domains.lists && getSimulation().relay.mode === 'live') {
    services.lists = scopePajaService(createListsService({
      supported: () => listsBackend.supported(),
      add: (list, items, options) => listsBackend.add(list, items, options),
      remove: (list, items, options) => listsBackend.remove(list, items, options),
    }), ['lists.add', 'lists.remove'], (windowId, isCurrent) => {
      const scope = scopeFor(windowId, isCurrent);
      return createListsService(createPajaListsBackend({ relay: scope.backend, getRelays: getAllRelays, getSigner: scope.getSigner }));
    }, scopeKey);
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
      getSigner: (windowId) => createRuntimeSigner(getSimulation, confirmRequest, signerProvider, windowId ? getSignerSource?.(windowId) : undefined),
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

  return {
    services,
    refreshAvailability,
    setWindowBlossomServers: blossomEventResolver.setWindowServers,
  };
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
 * @param getExtraResourceServers - Host-owned live extra Blossom lookup origins, appended after defaults; does not select upload destinations.
 * @param llmHost - NAP-LLM connection, consent and provider host; the `llm` domain is advertised only when supplied.
 * @returns Shell adapter plus a startup promise for asynchronous host probes.
 * @example
 * const adapter = createPajaAdapter(config, getSimulation, onThemeService, onThemeBroadcast, confirmRequest);
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
  getExtraResourceServers: () => readonly string[] = () => [],
  llmHost?: PajaLlmHost,
): PajaShellAdapter {
  const resolveIdentity = (windowId?: string) => getIdentity?.(windowId) ?? {
    dTag: config.window.dTag,
    aggregateHash: config.window.aggregateHash,
  };
  const signerSource = (windowId: string): PajaSignerSource => {
    const napplet = resolveIdentity(windowId);
    const account = getRuntimePubkey(getSimulation, signerProvider);
    const runtimeScope = 'consentScope' in napplet && typeof napplet.consentScope === 'string'
      ? napplet.consentScope
      : config.target?.mode === 'iframe-url'
        ? pajaDevelopmentConsentScope(config.target.url, windowId)
        : `artifact:${napplet.aggregateHash}`;
    return {
      windowId,
      napplet,
      runtimeScope,
      isCurrent: () => {
        const current = resolveIdentity(windowId);
        return (!('isCurrent' in napplet) || typeof napplet.isCurrent !== 'function' || napplet.isCurrent())
          && account === getRuntimePubkey(getSimulation, signerProvider)
          && current.dTag === napplet.dTag && current.aggregateHash === napplet.aggregateHash
          && (!('consentScope' in napplet) || ('consentScope' in current && current.consentScope === napplet.consentScope));
      },
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
  const getConfiguredBlossomServers = () => [
    ...(config.target?.pointer?.blossomServers ?? []),
    ...(uploadRuntime?.getServers() ?? getSimulation().upload.servers),
    ...getExtraResourceServers(),
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
    getConfiguredBlossomServers,
    uploadRuntime,
    signerProvider,
    resolveIdentity,
    userActivation,
    notifyOptions,
    configOptions,
    signerSource,
  );
  const services = serviceBundle.services;
  // NAP-LLM is advertised whenever the host wiring exists; configuration state is
  // reported separately through `llm.isConfigured()` so the panel can show it.
  if (llmHost && getSimulation().capabilities.domains.llm) services.llm = createLlmService({ host: llmHost });
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
  const adapter: PajaShellAdapter = {
    ready,
    notifyIntentChanged: () => {},
    setWindowBlossomServers: serviceBundle.setWindowBlossomServers,
    relayPool: createPajaRelayHooks(relayBackend, getSimulation, relayConfig, (windowId) => createPajaWindowScope({
      backend: relayBackend, source: signerSource(windowId), isCurrent: () => true,
      getPubkey: () => getRuntimePubkey(getSimulation, signerProvider),
      getSigner: (source) => createRuntimeSigner(getSimulation, confirmRequest, signerProvider, source),
    }).backend),
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
    llm: { isAvailable: () => Object.hasOwn(services, 'llm'), isConfigured: () => llmHost?.isConfigured() ?? false },
    crypto: {
      verifyEvent: async (event) => verifyEvent(event as Parameters<typeof verifyEvent>[0]),
    },
  };
  if (getSimulation().intent.enabled && intentHost) {
    const intent = createPajaCatalogIntentService(adapter, intentHost);
    services.intent = intent.service;
    adapter.notifyIntentChanged = intent.notifyChanged;
  }
  return adapter;
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
