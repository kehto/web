import type { NostrEvent, NostrFilter } from '@napplet/core';
import type {
  RelayPoolHooks,
  RelayPoolLike,
  SessionEntry,
  ServiceHandler,
  ShellAdapter,
} from '@kehto/shell';
import type { Signer } from '@kehto/runtime';
import {
  createBleService,
  createCommonService,
  createConfigService,
  createCountService,
  createCvmService,
  createIdentityService,
  createIntentService,
  createKeysService,
  createLinkService,
  createListsService,
  createMediaService,
  createNotificationService,
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
  type CvmServer,
  type CvmTransport,
  type IntentAvailability,
  type IntentRequest,
  type IntentResult,
  type McpMessage,
  type Uploader,
  type UploadRequest,
  type UploadResult,
  type UploadStatus,
} from '@kehto/services';
import type { Theme } from '@napplet/nap/theme/types';
import type { ThemeChangedMessage } from '@napplet/nap/theme/types';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';

import {
  createDevBleController,
  createDevListStore,
  createDevSerialController,
  createDevWebrtcController,
} from './development-services.js';
import type { PajaHostConfig } from './options.js';
import type { PajaSignerMethod } from './browser-signers.js';
import type { PajaSimulation } from './simulation.js';
import { createPajaUploadRuntime, type PajaUploadRuntime } from './browser-upload.js';
import {
  PAJA_LIVE_QUERY_WAIT_MS,
  createPajaIdentityProviders,
  createPajaOutboxRelayPool,
  createPajaRelayBackend,
  createPajaRelayListLoader,
  getPajaRelayUrls,
  matchesAnyFilter,
  type PajaRelayBackend,
} from './browser-relay-runtime.js';

/** Confirmation request emitted before Paja signs, publishes, or uploads. */
export type PajaConfirmationRequest =
  | {
      readonly action: 'sign' | 'publish';
      readonly event: NostrEvent | Partial<NostrEvent>;
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
    };

/** Paja runtime signer provider. */
export interface PajaSignerProvider {
  /** Active signer, if connected. */
  getSigner(): Signer | null;
  /** Selected signer backend. */
  getMethod(): PajaSignerMethod;
  /** Active signer pubkey, if connected. */
  getPubkey(): string | null;
  /** Observe signer identity lifecycle changes. */
  subscribe?(listener: () => void): () => void;
}

/** Identity provider for Paja's simulated target identity. */
export type PajaIdentityProvider = () => Pick<SessionEntry, 'dTag' | 'aggregateHash'>;

const DEV_INTENT_ARCHETYPE = 'paja-target';
const DEV_COMMON_PUBKEY = '1'.repeat(64);
const DEV_COMMON_EVENT_ID = '2'.repeat(64);
const DEV_SIGNER_SECRET_KEY = generateSecretKey();
/** Paja development signer public key. */
export const PAJA_DEV_SIGNER_PUBKEY = getPublicKey(DEV_SIGNER_SECRET_KEY);
const DEV_CVM_SERVER: CvmServer = {
  pubkey: '0'.repeat(64),
  name: 'Kehto Paja ContextVM',
  description: 'Deterministic development ContextVM adapter',
  relays: ['wss://relay.kehto.dev'],
  capabilities: ['echo'],
};

function createRelayHooks(pool: RelayPoolLike, getSimulation: () => PajaSimulation): RelayPoolHooks {
  const cleanups = new Map<string, () => void>();
  return {
    getRelayPool: () => pool,
    trackSubscription(subKey, cleanup) {
      cleanups.set(subKey, cleanup);
    },
    untrackSubscription(subKey) {
      cleanups.get(subKey)?.();
      cleanups.delete(subKey);
    },
    openScopedRelay: () => {},
    closeScopedRelay: () => {},
    publishToScopedRelay: (_windowId, event) => {
      if (getSimulation().relay.mode === 'disabled') return false;
      pool.publish(getPajaRelayUrls(getSimulation()), event);
      return true;
    },
    selectRelayTier: () => getPajaRelayUrls(getSimulation()),
  };
}

function createWorkerRelay(events: NostrEvent[]) {
  return {
    event(event: NostrEvent) {
      events.push(event);
      return Promise.resolve({ ok: true });
    },
    query(req: unknown): Promise<NostrEvent[]> {
      const filters = Array.isArray(req) ? req.slice(2).filter((item): item is NostrFilter => typeof item === 'object' && item !== null) : [];
      return Promise.resolve(events.filter((event) => matchesAnyFilter(event, filters)));
    },
    count(req: unknown): Promise<number> {
      return this.query(req).then((matched) => matched.length);
    },
  };
}

function createDevUploader(getSimulation: () => PajaSimulation): Uploader {
  return {
    async upload(request: UploadRequest, ctx): Promise<UploadResult> {
      const simulation = getSimulation();
      if (simulation.upload.mode === 'disabled') {
        throw new Error('upload simulation is disabled');
      }
      const size = request.data instanceof Blob ? request.data.size : request.data.byteLength;
      const result: UploadResult = {
        ok: true,
        uploadId: ctx.uploadId,
        status: 'complete',
        rail: request.rail ?? simulation.upload.rail ?? 'dev-memory',
        url: `kehto-dev://${simulation.upload.rail ?? 'dev-memory'}/${ctx.uploadId}`,
        size,
        mimeType: request.mimeType ?? (request.data instanceof Blob ? request.data.type : undefined),
      };
      ctx.onStatus({ ...result, updatedAt: Date.now() });
      return result;
    },
    async status(uploadId: string): Promise<UploadStatus> {
      const simulation = getSimulation();
      return {
        ok: simulation.upload.mode !== 'disabled',
        uploadId,
        status: simulation.upload.mode === 'disabled' ? 'failed' : 'complete',
        rail: simulation.upload.rail ?? 'dev-memory',
        url: `kehto-dev://${simulation.upload.rail ?? 'dev-memory'}/${uploadId}`,
        updatedAt: Date.now(),
      };
    },
  };
}

function createDevIntentAvailability(): IntentAvailability {
  return {
    archetype: DEV_INTENT_ARCHETYPE,
    available: true,
    hasDefault: true,
    candidates: [{
      dTag: 'dev-target',
      title: 'Dev runtime target',
      actions: ['open'],
      protocols: ['NAP-01'],
      isDefault: true,
    }],
  };
}

function createDevCvmTransport(getSimulation: () => PajaSimulation): CvmTransport {
  return {
    async discover() {
      if (!getSimulation().cvm.enabled) return [];
      return [{ ...DEV_CVM_SERVER, relays: getPajaRelayUrls(getSimulation()) }];
    },
    async request(_server, message): Promise<McpMessage> {
      const id = typeof message.id === 'string' || typeof message.id === 'number' ? message.id : 'paja';
      return {
        jsonrpc: '2.0',
        id,
        result: {
          echoed: true,
          method: typeof message.method === 'string' ? message.method : null,
        },
      };
    },
    async close() {},
    onEvent() {
      return {
        close() {},
      };
    },
  };
}

function createOutboxRouter(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
  signerProvider?: PajaSignerProvider,
) {
  return createRelayPoolOutboxRouter({
    relayPool: createPajaOutboxRelayPool(backend),
    loadRelayLists: createPajaRelayListLoader(backend, getSimulation, signerProvider),
    fallbackRelays: getPajaRelayUrls(getSimulation()),
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

function createDevSigner(
  getSimulation: () => PajaSimulation,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
): Signer {
  return {
    getPublicKey: () => PAJA_DEV_SIGNER_PUBKEY,
    getRelays: () => Object.fromEntries(getPajaRelayUrls(getSimulation()).map((relay) => [relay, { read: true, write: true }])),
    async signEvent(event: Parameters<typeof finalizeEvent>[0]): Promise<NostrEvent> {
      if (!confirmRequest({ action: 'sign', event: event as Partial<NostrEvent> })) {
        throw new Error('Paja signing request denied');
      }
      const template = { ...event };
      template.created_at ??= Math.floor(Date.now() / 1000);
      template.tags ??= [];
      template.content ??= '';
      return finalizeEvent(template, DEV_SIGNER_SECRET_KEY) as NostrEvent;
    },
  };
}

function getRuntimePubkey(
  getSimulation: () => PajaSimulation,
  signerProvider?: PajaSignerProvider,
): string {
  return getSimulation().identity.pubkey
    || signerProvider?.getPubkey()
    || (signerProvider?.getMethod() === 'dev' ? PAJA_DEV_SIGNER_PUBKEY : '');
}

function createRuntimeSigner(
  getSimulation: () => PajaSimulation,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
  signerProvider?: PajaSignerProvider,
): Signer | null {
  const signer = signerProvider?.getSigner();
  if (!signer) {
    if (signerProvider?.getMethod() === 'dev') return createDevSigner(getSimulation, confirmRequest);
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

function createDevServices(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
  onThemeBroadcast: (envelope: ThemeChangedMessage) => void,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
  uploadRuntime?: PajaUploadRuntime,
  signerProvider?: PajaSignerProvider,
): Record<string, ServiceHandler> {
  const notification = createNotificationService({ maxPerWindow: 50 });
  const theme = createThemeService({
    initialTheme: createDevTheme(getSimulation().theme.mode, getSimulation().theme.values),
    onBroadcast: onThemeBroadcast,
  });
  onThemeService(theme);
  const config = createConfigService({
    getValues: () => ({
      ...getSimulation().config.values,
      simulation: {
        identity: getSimulation().identity.mode,
        relay: getSimulation().relay.mode,
        storage: getSimulation().storage.mode,
        cache: getSimulation().cache.mode,
        upload: getSimulation().upload.mode,
        theme: getSimulation().theme.mode,
      },
    }),
  });
  const services: Record<string, ServiceHandler> = {
    keys: createKeysService(),
    resource: createResourceService({
      fetch: (url, init) => fetch(url, init),
      isOriginGranted: () => true,
      getConnectGrants: () => ['*'],
      resolveIdentity: () => ({ dTag: 'dev-target', aggregateHash: 'paja' }),
    }),
  };

  if (getSimulation().relay.mode !== 'disabled') {
    services.relay = createRelayPoolService({
      subscribe: (filters, callback, relayUrls) => backend.subscription(relayUrls ?? getPajaRelayUrls(getSimulation()), filters).subscribe((item) => {
        if (item === 'EOSE' || (typeof item === 'object' && item !== null)) {
          callback(item as NostrEvent | 'EOSE');
        }
      }),
      publish: (event) => backend.publish(getPajaRelayUrls(getSimulation()), event),
      selectRelayTier: () => getPajaRelayUrls(getSimulation()),
      isAvailable: () => backend.isAvailable(),
    });
    services.outbox = createOutboxService({ router: createOutboxRouter(backend, getSimulation, confirmRequest, signerProvider) });
  }
  if (getSimulation().capabilities.domains.count && typeof backend.count === 'function') {
    services.count = createCountService({
      count: async ({ filters }) => {
        const relays = getPajaRelayUrls(getSimulation());
        return {
          ok: true,
          count: await backend.count!(relays, filters),
          approximate: false,
          relays,
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
      ...createPajaIdentityProviders(backend, getSimulation, signerProvider),
    });
  }
  if (getSimulation().notifications.enabled) {
    services.notifications = notification;
    services.notify = createNotifyService({ defaultGrant: getSimulation().notifications.grant });
  }
  if (getSimulation().media.enabled) services.media = createMediaService();
  if (getSimulation().capabilities.domains.theme) services.theme = theme.handler;
  if (getSimulation().capabilities.domains.config) services.config = config.handler;
  if (getSimulation().cvm.enabled) services.cvm = createCvmService({ transport: createDevCvmTransport(getSimulation) });
  if (getSimulation().upload.mode === 'memory') {
    services.upload = createUploadService({ uploader: createDevUploader(getSimulation) });
  } else if (uploadRuntime) {
    services.upload = createUploadService({
      uploader: uploadRuntime.uploader,
      uploadInfo: uploadRuntime.uploadInfo as UploadInfoProvider,
    });
  }
  if (getSimulation().intent.enabled) {
    services.intent = createIntentService({
      resolver: {
        invoke(request: IntentRequest): IntentResult {
          return {
            ok: true,
            archetype: request.archetype,
            action: request.action ?? 'open',
            handled: request.archetype === DEV_INTENT_ARCHETYPE,
            handler: 'dev-target',
            windowId: 'kehto-paja-window',
            protocol: request.protocol ?? 'NAP-01',
          };
        },
        available: (archetype) => ({
          ...createDevIntentAvailability(),
          archetype,
          available: archetype === DEV_INTENT_ARCHETYPE,
        }),
        handlers: () => [createDevIntentAvailability()],
      },
    });
  }
  if (getSimulation().capabilities.domains.link) {
    services.link = createLinkService({
      open: ({ url }) => ({ status: url.protocol === 'https:' || url.protocol === 'http:' ? 'opened' : 'denied' }),
    });
  }
  if (getSimulation().capabilities.domains.common) {
    services.common = createCommonService({
      getProfile: (target) => ({
        ok: true,
        pubkey: target || getSimulation().identity.pubkey || DEV_COMMON_PUBKEY,
        profile: { name: 'paja', displayName: 'Kehto Paja' },
        relays: getPajaRelayUrls(getSimulation()),
      }),
      follows: () => ({ ok: true, pubkeys: [getSimulation().identity.pubkey || DEV_COMMON_PUBKEY] }),
      follow: () => ({ ok: true, eventId: DEV_COMMON_EVENT_ID }),
      unfollow: () => ({ ok: true, eventId: DEV_COMMON_EVENT_ID }),
      react: () => ({ ok: true, eventId: DEV_COMMON_EVENT_ID }),
      report: () => ({ ok: true, eventId: DEV_COMMON_EVENT_ID }),
    });
  }
  if (getSimulation().capabilities.domains.lists) {
    const listStore = createDevListStore();
    services.lists = createListsService({
      supported: listStore.supported,
      add: listStore.add,
      remove: listStore.remove,
    });
  }
  if (getSimulation().capabilities.domains.serial) {
    services.serial = createSerialService(createDevSerialController());
  }
  if (getSimulation().capabilities.domains.ble) {
    services.ble = createBleService(createDevBleController());
  }
  if (getSimulation().capabilities.domains.webrtc) {
    services.webrtc = createWebrtcService(createDevWebrtcController());
  }

  return services;
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
 * @returns Shell adapter for `createShellBridge`.
 */
export function createPajaAdapter(
  config: PajaHostConfig,
  getSimulation: () => PajaSimulation,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
  onThemeBroadcast: (envelope: ThemeChangedMessage) => void,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
  signerProvider?: PajaSignerProvider,
  getIdentity?: PajaIdentityProvider,
  onEnvironmentChanged?: () => void,
): ShellAdapter {
  const relayBackend = createPajaRelayBackend(getSimulation, confirmRequest);
  const uploadRuntime = getSimulation().upload.mode === 'blossom'
    ? createPajaUploadRuntime({
        getSimulation,
        getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
        getProviderPubkey: () => signerProvider?.getPubkey() ?? null,
        queryDiscovery: (relayUrls, filters) => relayBackend.query(relayUrls, filters),
        getRelayUrls: () => getPajaRelayUrls(getSimulation()),
        confirmRequest,
        getNappletIdentity: () => getIdentity?.() ?? {
          dTag: config.window.dTag,
          aggregateHash: config.window.aggregateHash,
        },
        subscribeSignerChange: signerProvider?.subscribe?.bind(signerProvider),
      })
    : undefined;
  void uploadRuntime?.refreshIdentity();
  signerProvider?.subscribe?.(() => {
    void uploadRuntime?.refreshIdentity().finally(() => onEnvironmentChanged?.());
  });
  const workerRelayEvents: NostrEvent[] = [];
  return {
    relayPool: createRelayHooks(relayBackend, getSimulation),
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => {
        const relays = getPajaRelayUrls(getSimulation());
        return { discovery: relays, super: relays, outbox: relays };
      },
      getNip66Suggestions: () => getPajaRelayUrls(getSimulation()),
    },
    windowManager: { createWindow: () => null },
    auth: {
      getUserPubkey: () => getRuntimePubkey(getSimulation, signerProvider),
      getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
    },
    services: createDevServices(relayBackend, getSimulation, onThemeService, onThemeBroadcast, confirmRequest, uploadRuntime, signerProvider),
    get capabilities() {
      return { disabledDomains: getSimulation().capabilities.disabledDomains };
    },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => createWorkerRelay(workerRelayEvents) },
    upload: getSimulation().upload.mode === 'memory'
      ? { getUploader: () => ({ rails: [getSimulation().upload.rail ?? 'dev-memory'] }) }
      : uploadRuntime
        ? { getUploader: uploadRuntime.getBackend }
        : undefined,
    intent: { isAvailable: () => getSimulation().intent.enabled },
    link: { isAvailable: () => getSimulation().capabilities.domains.link },
    common: { isAvailable: () => getSimulation().capabilities.domains.common },
    lists: { isAvailable: () => getSimulation().capabilities.domains.lists },
    serial: { isAvailable: () => getSimulation().capabilities.domains.serial },
    ble: { isAvailable: () => getSimulation().capabilities.domains.ble },
    webrtc: { isAvailable: () => getSimulation().capabilities.domains.webrtc },
    crypto: {
      verifyEvent: async () => true,
    },
  };
}
