import { originRegistry } from '@kehto/shell';
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
import { createPajaCatalogIntentService, type PajaIntentHost } from './browser-catalog-intent-service.js';
import type { PajaHostConfig } from './options.js';
import type { PajaSimulation } from './simulation.js';
import {
  createDevTheme,
  createOutboxRouter,
  type PajaConfirmationHandler,
  type PajaIdentityProvider,
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
import {
  PAJA_DEV_SIGNER_PUBKEY,
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
  createPajaRelayBackend,
  type PajaRelayBackend,
} from './browser-relay-runtime.js';
import { createPajaWorkerRelay } from './browser-worker-relay.js';
import type { PajaSignerSource } from './browser-signer-consent.js';
import { createPajaCvmRelayPool, createRuntimeSigner, getRuntimePubkey, createPajaWindowScope, pajaDevelopmentConsentScope, scopePajaService } from './browser-operation-scope.js';

const HEX_PUBKEY = /^[0-9a-f]{64}$/i;

/**
 * Pubkey of the account Paja may act as right now, or `null` when there is none.
 *
 * Only a connected signer counts: NIP-07/NIP-46 expose the pubkey they
 * authorized, and the Dev signer is its own ephemeral account. A fixed
 * simulation identity is deliberately excluded because it is a read-only
 * stand-in — treating it as a signed-in account would let a signer-less session
 * start author-routed relay reads (social warming) that nobody asked for.
 *
 * @param signerProvider - Host signer controller, when one is wired.
 * @returns Lowercase hex pubkey of the connected account, or `null`.
 */
function getConnectedAccountPubkey(signerProvider?: PajaSignerProvider): string | null {
  const pubkey = signerProvider?.getPubkey();
  if (typeof pubkey === 'string' && HEX_PUBKEY.test(pubkey)) return pubkey.toLowerCase();
  if (signerProvider?.getMethod() === 'dev') return PAJA_DEV_SIGNER_PUBKEY;
  return null;
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
      getReadRelays(),
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
    loadContactList: createPajaContactListLoader(backend, getSimulation, getReadRelays),
    verifyEvent: (event) => verifyEvent(event as Parameters<typeof verifyEvent>[0]),
    // Background warming is speculative relay traffic, so it only runs for a
    // signer account. `getFollows` still answers on demand for any requested
    // pubkey, including the fixed simulation identity.
    getActivePubkey: () => getConnectedAccountPubkey(signerProvider),
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
  const commonServiceOptions = (common: typeof commonBackend) => ({
    planRelays: (operation, target) => common.planRelays(operation, target),
    getProfile: (target, context) => common.getProfile(target, context.relays, context.signal),
    follows: (context) => common.follows(context.relays, context.signal),
    follow: (pubkeys, context) => common.follow(pubkeys, context.relays, context.signal),
    unfollow: (pubkeys, context) => common.unfollow(pubkeys, context.relays, context.signal),
    react: (targetEventId, reaction, customEmojiHref, context) => common.react(targetEventId, reaction, customEmojiHref, context.relays, context.signal),
    report: (target, reason, text, context) => common.report(target, reason, text, context.relays, context.signal),
  } satisfies Parameters<typeof createCommonService>[0]);
  const listsServiceOptions = (lists: typeof listsBackend) => ({
    supported: () => lists.supported(),
    planMutation: (list, items, options) => lists.planMutation(list, items, options),
    add: (list, items, options, context) => lists.add(list, items, options, context.relays, context.signal),
    remove: (list, items, options, context) => lists.remove(list, items, options, context.relays, context.signal),
  } satisfies Parameters<typeof createListsService>[0]);
  const resourceService = createResourceService({
    stream: createBrowserMediaStreamFetch(),
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
      selectPublishRelayTier: getWriteRelays,
      isAvailable: () => backend.isAvailable(),
    } satisfies Omit<Parameters<typeof createRelayPoolService>[0], 'publish' | 'publishToRelays'>;
    const relayPublishers = (relay: PajaRelayBackend) => ({
      publish: (event: NostrEvent) => relay.publish(getWriteRelays(), event),
      publishToRelays: (relayUrls: readonly string[], event: NostrEvent) => relay.publish([...relayUrls].filter((url) => isPajaRelayAllowed(url, getAllRelays)), event),
    });
    services.relay = scopePajaService(createRelayPoolService({ ...relayOptions, ...relayPublishers(backend) }),
      ['relay.publish', 'relay.publishEncrypted'], (windowId, isCurrent) => createRelayPoolService({
        ...relayOptions, ...relayPublishers(scopeFor(windowId, isCurrent).backend),
      }), scopeKey);
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
    let identitySigner: Signer | null = null;
    let identitySignerKey = '';
    services.identity = createIdentityService({
      getSigner: () => {
        const connectedSigner = signerProvider?.getSigner();
        const simulation = getSimulation();
        const key = [
          signerProvider?.getMethod() ?? 'none',
          signerProvider?.getPubkey() ?? '',
          connectedSigner ? 'connected' : 'simulated',
          simulation.identity.mode,
          simulation.identity.pubkey,
        ].join(':');
        if (!identitySigner || key !== identitySignerKey) {
          // The identity service suppresses an async result after its signer
          // instance changes. Paja's NIP-07 and simulated adapters may create
          // a fresh wrapper on each lookup, so bind one read-only facade to
          // the current account while resolving the live provider per read.
          identitySigner = connectedSigner && signerProvider
            ? {
                getPublicKey: () => signerProvider.getSigner()?.getPublicKey?.() ?? '',
                // NAP-IDENTITY permits empty unsupported metadata results.
                // Host bootstrap URLs are not the user's NIP-65 preferences.
                getRelays: () => ({}),
              }
            : createRuntimeSigner(getSimulation, confirmRequest, signerProvider);
          identitySignerKey = key;
        }
        return identitySigner;
      },
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
      open: (context) => confirmPajaExternalLink(context, confirmRequest, getIdentity, openPajaExternalLink, userActivation),
    });
  }
  if (getSimulation().capabilities.domains.common && getSimulation().relay.mode === 'live') {
    services.common = scopePajaService(createCommonService(commonServiceOptions(commonBackend)),
      ['common.follow', 'common.unfollow', 'common.react', 'common.report'], (windowId, isCurrent) => {
        const scope = scopeFor(windowId, isCurrent);
        return createCommonService(commonServiceOptions(createPajaCommonBackend({ relay: scope.backend, getRelays: getAllRelays, getSigner: scope.getSigner })));
      }, scopeKey);
  }
  if (getSimulation().capabilities.domains.lists && getSimulation().relay.mode === 'live') {
    services.lists = scopePajaService(createListsService(listsServiceOptions(listsBackend)),
      ['lists.add', 'lists.remove'], (windowId, isCurrent) => {
        const scope = scopeFor(windowId, isCurrent);
        return createListsService(listsServiceOptions(createPajaListsBackend({ relay: scope.backend, getRelays: getAllRelays, getSigner: scope.getSigner })));
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
        subscribe(relayUrls, filters, onEvent) {
          const subscription = backend.subscription([...relayUrls], filters).subscribe((item) => {
            if (typeof item === 'object' && item !== null) onEvent(item as NostrEvent);
          });
          return { close: () => subscription.unsubscribe() };
        },
        publish: (relayUrls, event) => backend.publishWebrtcSignal([...relayUrls], event),
      },
      getSigner: (windowId) => createRuntimeSigner(getSimulation, confirmRequest, signerProvider, windowId ? getSignerSource?.(windowId) : undefined),
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
