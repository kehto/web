import { originRegistry, resolveShellEnvironment } from '@kehto/shell';
import type { NostrEvent, NostrFilter } from '@napplet/core';
import type { ServiceHandler } from '@kehto/shell';
import type { Signer } from '@kehto/runtime';
import { createNip65Registry, selectWriteRelays } from '@kehto/nip/65';
import {
  browserGamepadOptions,
  createGamepadService,
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
  type AuthorizeNetwork,
} from '@kehto/services';
import { createNostrCvmTransport } from '@kehto/services/cvm-nostr-transport';
import type { ThemeChangedMessage } from '@napplet/nap/theme/types';
import { verifyEvent } from 'nostr-tools/pure';

import {
  createBrowserBleController,
  createBrowserSerialController,
  type PajaUserActivationHandler,
} from './browser-device-services.js';
import type { PajaHostConfig } from './options.js';
import type { PajaSimulation } from './simulation.js';
import {
  createDevTheme,
  createOutboxRouter,
  createPajaCvmRelayPool,
  createRuntimeSigner,
  getRuntimePubkey,
  type PajaConfirmationHandler,
  type PajaIdentityProvider,
  type PajaIntentHost,
  type PajaShellAdapter,
  type PajaSignerProvider,
} from './browser-adapter-support.js';
export { createDevTheme } from './browser-adapter-support.js';
export type { PajaConfirmationRequest, PajaConfirmationHandler, PajaIdentityProvider, PajaShellAdapter, PajaSignerProvider } from './browser-adapter-support.js';
export { PAJA_DEV_SIGNER_PUBKEY } from './browser-dev-runtime.js';
import { createPajaUploadRuntime, type PajaUploadRuntime } from './browser-upload.js';
import { BLOSSOM_SERVER_LIST_KIND, createPajaBlossomEventResolver } from './browser-blossom-events.js';
import { createPajaSocialCache } from './browser-social-cache.js';
import { createPajaCommonBackend } from './browser-common.js';
import { createPajaListsBackend } from './browser-lists.js';
import { createPajaResourceFetch, pajaResourceInfo } from './browser-resource.js';
import { createPajaWebrtcController } from './browser-webrtc.js';
import { confirmPajaExternalLink } from './browser-link.js';
import { createPajaBrowserFsBackend } from './browser-fs.js';
import { createPajaDevDmService } from './browser-dev-runtime.js';
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
  createPajaRelayBackend,
  getPajaBootstrapRelayUrls,
  type PajaRelayBackend,
} from './browser-relay-runtime.js';
import { createPajaWorkerRelay } from './browser-worker-relay.js';
import type { PajaSignerSource } from './browser-signer-consent.js';

interface PajaServiceBundle {
  readonly services: Record<string, ServiceHandler>;
  refreshAvailability(): boolean;
  refreshSignerBootstrapRelays(): void;
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
  const signerBootstrapRelays: string[] = [];
  let signerBootstrapGeneration = 0;
  const refreshSignerBootstrapRelays = (): void => {
    const generation = ++signerBootstrapGeneration;
    signerBootstrapRelays.splice(0);
    const signer = signerProvider?.getSigner();
    if (!signer?.getRelays) return;
    // This runs from host initialization and signer lifecycle changes, never a
    // resource request. A signer extension may implement getRelays using an
    // opaque bridge, so discovery can only consume the cached URL strings.
    void Promise.resolve().then(() => signer.getRelays!()).then((relays) => {
      if (generation !== signerBootstrapGeneration || !relays || typeof relays !== 'object') return;
      for (const [url, permissions] of Object.entries(relays)) {
        if (permissions?.read && typeof url === 'string') signerBootstrapRelays.push(url);
      }
    }).catch(() => {
      // Host relay configuration remains the safe bootstrap fallback.
    });
  };
  refreshSignerBootstrapRelays();
  const baseOutboxRouter = createOutboxRouter(backend, getSimulation, relayConfig, confirmRequest, signerProvider);
  const queryApprovedResourceRelays = async (
    relayUrls: readonly string[],
    filters: NostrFilter[],
    context: { readonly signal: AbortSignal; readonly authorizeNetwork: AuthorizeNetwork },
  ): Promise<NostrEvent[]> => {
    const unique = [...new Set(relayUrls.filter((relay) =>
      isPajaRelayAllowed(relay, () => relayConfig.getRelayUrls())))];
    const batches = await Promise.all(unique.map((relay) => context.authorizeNetwork(relay, (signal) =>
      backend.query([relay], filters, PAJA_LIVE_QUERY_WAIT_MS, { reason: 'host' }, signal),
    )));
    const events = new Map<string, NostrEvent>();
    for (const batch of batches) {
      for (const event of batch) events.set(event.id, event);
    }
    return [...events.values()];
  };
  const discoverBlossomServerList = async (
    pubkey: string,
    context: { readonly signal: AbortSignal; readonly authorizeNetwork: AuthorizeNetwork },
  ) => {
    const relayListEvents = await queryApprovedResourceRelays(
      // Resource requests never call an external signer's getRelays hook. The
      // host refreshes signerBootstrapRelays on lifecycle changes, so each URL
      // below is already concrete and can be approved before opening a socket.
      await getPajaBootstrapRelayUrls(
        getSimulation,
        undefined,
        () => [...getReadRelays(), ...signerBootstrapRelays],
      ),
      [{ kinds: [10_002], authors: [pubkey], limit: 2 }],
      context,
    );
    const newestRelayList = relayListEvents
      .filter((event) => event.kind === 10_002
        && event.pubkey.toLowerCase() === pubkey.toLowerCase()
        && verifyEvent(event as Parameters<typeof verifyEvent>[0]))
      .sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id))[0];
    const registry = createNip65Registry();
    if (newestRelayList) registry.ingest(newestRelayList);
    const routed = selectWriteRelays(registry.getRelayList(pubkey) ?? []);
    const resourceEvents = await queryApprovedResourceRelays(
      [...relayConfig.outboxRelays, ...routed],
      [{ kinds: [BLOSSOM_SERVER_LIST_KIND], authors: [pubkey], limit: 1 }],
      context,
    );
    return {
      events: resourceEvents
        .filter((event) => verifyEvent(event as Parameters<typeof verifyEvent>[0]))
        .map((event) => ({ event })),
      ...(resourceEvents.length === 0 ? { incomplete: true, error: 'relay list unavailable' } : {}),
    };
  };
  const blossomEventResolver = createPajaBlossomEventResolver({
    baseRouter: baseOutboxRouter,
    getDefaultAuthors: () => [getRuntimePubkey(getSimulation, signerProvider)],
    getConfiguredServers: getConfiguredBlossomServers,
    discoverServerList: discoverBlossomServerList,
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
    fetch: createPajaResourceFetch({
      getBlossomServers: ({ url, windowId, signal, authorizeNetwork }) => blossomEventResolver.getServers(
        url, windowId, { signal, authorizeNetwork },
      ),
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
    services.relay = createRelayPoolService({
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
      publish: (event) => backend.publish(getWriteRelays(), event),
      publishToRelays: (relayUrls, event) => backend.publish([...relayUrls].filter((url) => isPajaRelayAllowed(url, getAllRelays)), event),
      selectRelayTier: getReadRelays,
      selectPublishRelayTier: getWriteRelays,
      isAvailable: () => backend.isAvailable(),
    });
    services.outbox = createOutboxService({
      router: baseOutboxRouter,
      getReadRouter: (windowId) => blossomEventResolver.decorate(baseOutboxRouter, windowId),
      getQueryRouter: (windowId, context) => blossomEventResolver.decorate(
        socialCache.decorate(
          baseOutboxRouter,
          () => context?.hasCapability(windowId, 'identity:read') ?? false,
        ),
        windowId,
      ),
    });
  }
  if (getSimulation().capabilities.domains.count && getSimulation().relay.mode === 'live') {
    services.count = createCountService({
      planCount: () => ({ relays: getReadRelays() }),
      count: async ({ filters, relays, signal }) => {
        if (!relays?.length || signal?.aborted) return { ok: false, error: 'count-unavailable' };
        const result = await backend.countWithRelay([...relays], filters, signal);
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
    let syntheticSigner: Signer | null = null;
    let syntheticSignerKey = '';
    services.identity = createIdentityService({
      getSigner: () => {
        const connectedSigner = signerProvider?.getSigner();
        if (connectedSigner) return connectedSigner;
        // The identity service rejects an async result if its signer instance
        // changes. Keep Paja's simulated signer stable for one account.
        const simulation = getSimulation();
        const key = `${signerProvider?.getMethod() ?? 'none'}:${simulation.identity.mode}:${simulation.identity.pubkey}`;
        if (!syntheticSigner || key !== syntheticSignerKey) {
          syntheticSigner = createRuntimeSigner(getSimulation, confirmRequest, signerProvider);
          syntheticSignerKey = key;
        }
        return syntheticSigner;
      },
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
  if (
    getSimulation().capabilities.domains.link
    && typeof window !== 'undefined'
    && typeof window.open === 'function'
  ) {
    services.link = createLinkService({
      open: (context) => confirmPajaExternalLink(context, confirmRequest, getIdentity, openPajaExternalLink),
    });
  }
  if (getSimulation().capabilities.domains.common && getSimulation().relay.mode === 'live') {
    services.common = createCommonService({
      planRelays: (operation, target) => commonBackend.planRelays(operation, target),
      getProfile: (target, context) => commonBackend.getProfile(target, context.relays, context.signal),
      follows: (context) => commonBackend.follows(context.relays, context.signal),
      follow: (pubkeys, context) => commonBackend.follow(pubkeys, context.relays, context.signal),
      unfollow: (pubkeys, context) => commonBackend.unfollow(pubkeys, context.relays, context.signal),
      react: (targetEventId, reaction, customEmojiHref, context) => commonBackend.react(targetEventId, reaction, customEmojiHref, context.relays, context.signal),
      report: (target, reason, text, context) => commonBackend.report(target, reason, text, context.relays, context.signal),
    });
  }
  if (getSimulation().capabilities.domains.lists && getSimulation().relay.mode === 'live') {
    services.lists = createListsService({
      supported: () => listsBackend.supported(),
      planMutation: (list, items, options) => listsBackend.planMutation(list, items, options),
      add: (list, items, options, context) => listsBackend.add(list, items, options, context.relays, context.signal),
      remove: (list, items, options, context) => listsBackend.remove(list, items, options, context.relays, context.signal),
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
        subscribe(relayUrls, filters, onEvent) {
          const subscription = backend.subscription([...relayUrls], filters).subscribe((item) => {
            if (typeof item === 'object' && item !== null) onEvent(item as NostrEvent);
          });
          return { close: () => subscription.unsubscribe() };
        },
        publish: (relayUrls, event) => backend.publishWebrtcSignal([...relayUrls], event),
      },
      getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
      getPubkey: () => getRuntimePubkey(getSimulation, signerProvider),
      getIdentity: getIdentity ?? (() => ({ dTag: 'dev-target', aggregateHash: 'paja' })),
      confirm: confirmRequest,
      signalingRelayUrls: () => [...getAllRelays()],
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
    refreshSignerBootstrapRelays,
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
): PajaShellAdapter {
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
    serviceBundle.refreshSignerBootstrapRelays();
    const availabilityChanged = serviceBundle.refreshAvailability();
    if (uploadRuntime) {
      void uploadRuntime.refreshIdentity().finally(() => onEnvironmentChanged?.());
    } else if (availabilityChanged) {
      onEnvironmentChanged?.();
    }
  });
  const adapter: PajaShellAdapter = {
    ready,
    setWindowBlossomServers: serviceBundle.setWindowBlossomServers,
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
  if (getSimulation().intent.enabled && intentHost) {
    const resolver = createCatalogIntentResolver({
      loadCatalog: () => intentHost.catalog.intentCatalog((record) =>
        resolveShellEnvironment(adapter, record).capabilities.domains.includes('intent'),
      ),
      targets: intentHost.controller,
      getDefaultHandler: intentHost.getDefaultHandler,
      chooseHandler: intentHost.chooseHandler,
      authorizeExplicitHandler: intentHost.authorizeExplicitHandler,
      resolveHandlerHint: intentHost.resolveHandlerHint,
    });
    services.intent = createIntentService({
      resolver,
      resolveSender: intentHost.resolveSender,
    });
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
