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
  createRelayPoolService,
  createResourceService,
  createSerialService,
  createThemeService,
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
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import {
  createDevBleController,
  createDevListStore,
  createDevSerialController,
  createDevWebrtcController,
} from './development-services.js';
import type { PajaHostConfig } from './options.js';
import type { PajaSimulation } from './simulation.js';

export interface PajaConfirmationRequest {
  action: 'sign' | 'publish';
  event: NostrEvent | Partial<NostrEvent>;
}

export interface PajaSignerProvider {
  getSigner(): Signer | null;
  getPubkey(): string | null;
}

export type PajaIdentityProvider = () => Pick<SessionEntry, 'dTag' | 'aggregateHash'>;

const DEV_INTENT_ARCHETYPE = 'paja-target';
const DEV_COMMON_PUBKEY = '1'.repeat(64);
const DEV_COMMON_EVENT_ID = '2'.repeat(64);
const DEV_SIGNER_SECRET_KEY = generateSecretKey();
export const PAJA_DEV_SIGNER_PUBKEY = getPublicKey(DEV_SIGNER_SECRET_KEY);
const DEV_CVM_SERVER: CvmServer = {
  pubkey: '0'.repeat(64),
  name: 'Kehto Paja ContextVM',
  description: 'Deterministic development ContextVM adapter',
  relays: ['wss://relay.kehto.dev'],
  capabilities: ['echo'],
};

function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  const ids = filter.ids;
  if (ids && !ids.includes(event.id)) return false;
  const authors = filter.authors;
  if (authors && !authors.includes(event.pubkey)) return false;
  const kinds = filter.kinds;
  if (kinds && !kinds.includes(event.kind)) return false;
  return true;
}

function matchesAnyFilter(event: NostrEvent, filters: NostrFilter[]): boolean {
  return filters.length === 0 || filters.some((filter) => matchesFilter(event, filter));
}

function createMemoryRelayPool(
  getSimulation: () => PajaSimulation,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
): RelayPoolLike {
  const events: NostrEvent[] = getSimulation().relay.fixtures.flatMap(toNostrEvent);
  const subscribers = new Set<{
    filters: NostrFilter[];
    next(item: NostrEvent | 'EOSE'): void;
  }>();

  return {
    subscription(_relayUrls: string[], filters: NostrFilter[]) {
      return {
        subscribe(next: (item: unknown) => void) {
          const subscriber = {
            filters,
            next: (item: NostrEvent | 'EOSE') => next(item),
          };
          subscribers.add(subscriber);
          for (const event of events) {
            if (matchesAnyFilter(event, filters)) next(event);
          }
          queueMicrotask(() => {
            if (subscribers.has(subscriber)) next('EOSE');
          });
          return {
            unsubscribe() {
              subscribers.delete(subscriber);
            },
          };
        },
      };
    },
    publish(_relayUrls: string[], event: NostrEvent): void {
      if (getSimulation().relay.mode === 'disabled') return;
      if (!confirmRequest({ action: 'publish', event })) return;
      events.push(event);
      for (const subscriber of subscribers) {
        if (matchesAnyFilter(event, subscriber.filters)) subscriber.next(event);
      }
    },
    request(_relayUrls: string[], filters: NostrFilter[]) {
      return {
        subscribe(observer: { next: (event: unknown) => void; complete: () => void; error: () => void }) {
          for (const event of events) {
            if (matchesAnyFilter(event, filters)) observer.next(event);
          }
          queueMicrotask(() => observer.complete());
          return { unsubscribe() { /* no-op */ } };
        },
      };
    },
  };
}

function toNostrEvent(value: unknown): NostrEvent[] {
  if (
    typeof value === 'object'
    && value !== null
    && typeof (value as { id?: unknown }).id === 'string'
    && typeof (value as { pubkey?: unknown }).pubkey === 'string'
    && typeof (value as { kind?: unknown }).kind === 'number'
    && Array.isArray((value as { tags?: unknown }).tags)
    && typeof (value as { content?: unknown }).content === 'string'
    && typeof (value as { sig?: unknown }).sig === 'string'
  ) {
    return [value as NostrEvent];
  }
  return [];
}

function getRelayUrls(simulation: PajaSimulation): string[] {
  return simulation.relay.mode === 'memory' ? [...simulation.relay.urls] : [];
}

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
      pool.publish(getRelayUrls(getSimulation()), event);
      return true;
    },
    selectRelayTier: () => getRelayUrls(getSimulation()),
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
        rail: request.rail ?? simulation.upload.rail,
        url: `kehto-dev://${simulation.upload.rail}/${ctx.uploadId}`,
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
        rail: simulation.upload.rail,
        url: `kehto-dev://${simulation.upload.rail}/${uploadId}`,
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
      return [{ ...DEV_CVM_SERVER, relays: getRelayUrls(getSimulation()) }];
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
  pool: RelayPoolLike,
  getSimulation: () => PajaSimulation,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
  signerProvider?: PajaSignerProvider,
) {
  return {
    async query(filters: NostrFilter[]) {
      const relayUrls = getRelayUrls(getSimulation());
      const events = await new Promise<NostrEvent[]>((resolve) => {
        const out: NostrEvent[] = [];
        pool.request(relayUrls, filters).subscribe({
          next: (event) => out.push(event as NostrEvent),
          complete: () => resolve(out),
          error: () => resolve(out),
        });
      });
      return { events, relays: Object.fromEntries(events.map((event) => [event.id, relayUrls])) };
    },
    subscribe(filters: NostrFilter[], _options: unknown, sink: { event(event: NostrEvent, relay?: string): void; eose(): void; closed(reason?: string): void }) {
      const relayUrls = getRelayUrls(getSimulation());
      const sub = pool.subscription(relayUrls, filters).subscribe((item) => {
        if (item === 'EOSE') sink.eose();
        else sink.event(item as NostrEvent, relayUrls[0]);
      });
      return { close: () => sub.unsubscribe() };
    },
    async publish(template: Partial<NostrEvent>) {
      const event = await createRuntimeSigner(getSimulation, confirmRequest, signerProvider).signEvent!({
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: '',
        ...template,
      });
      const relayUrls = getRelayUrls(getSimulation());
      pool.publish(relayUrls, event);
      return { ok: true, event, eventId: event.id, relays: { [relayUrls[0] ?? 'dev']: true } };
    },
    async resolveRelays() {
      return { relays: getRelayUrls(getSimulation()), source: 'policy' as const };
    },
  };
}

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
    getPublicKey: () => getSimulation().identity.pubkey || PAJA_DEV_SIGNER_PUBKEY,
    getRelays: () => Object.fromEntries(getRelayUrls(getSimulation()).map((relay) => [relay, { read: true, write: true }])),
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
  return getSimulation().identity.pubkey || signerProvider?.getPubkey() || PAJA_DEV_SIGNER_PUBKEY;
}

function createRuntimeSigner(
  getSimulation: () => PajaSimulation,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
  signerProvider?: PajaSignerProvider,
): Signer {
  const signer = signerProvider?.getSigner();
  if (!signer) return createDevSigner(getSimulation, confirmRequest);
  return {
    ...signer,
    getPublicKey: () => getRuntimePubkey(getSimulation, signerProvider),
  };
}

function createDevServices(
  pool: RelayPoolLike,
  getSimulation: () => PajaSimulation,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
  signerProvider?: PajaSignerProvider,
): Record<string, ServiceHandler> {
  const notification = createNotificationService({ maxPerWindow: 50 });
  const theme = createThemeService({
    initialTheme: createDevTheme(getSimulation().theme.mode, getSimulation().theme.values),
    onBroadcast: () => {},
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

  if (getSimulation().relay.mode === 'memory') {
    services.relay = createRelayPoolService({
      subscribe: (filters, callback, relayUrls) => pool.subscription(relayUrls ?? getRelayUrls(getSimulation()), filters).subscribe((item) => {
        if (item === 'EOSE' || (typeof item === 'object' && item !== null)) {
          callback(item as NostrEvent | 'EOSE');
        }
      }),
      publish: (event) => pool.publish(getRelayUrls(getSimulation()), event),
      selectRelayTier: () => getRelayUrls(getSimulation()),
      isAvailable: () => getSimulation().relay.mode === 'memory',
    });
    services.outbox = createOutboxService({ router: createOutboxRouter(pool, getSimulation, confirmRequest, signerProvider) });
  }

  if (getSimulation().capabilities.domains.identity) {
    services.identity = createIdentityService({ getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider) });
  }
  if (getSimulation().notifications.enabled) {
    services.notifications = notification;
    services.notify = createNotifyService({ defaultGrant: getSimulation().notifications.grant });
  }
  if (getSimulation().media.enabled) services.media = createMediaService();
  if (getSimulation().capabilities.domains.theme) services.theme = theme.handler;
  if (getSimulation().capabilities.domains.config) services.config = config.handler;
  if (getSimulation().cvm.enabled) services.cvm = createCvmService({ transport: createDevCvmTransport(getSimulation) });
  if (getSimulation().upload.mode === 'memory') services.upload = createUploadService({ uploader: createDevUploader(getSimulation) });
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
        relays: getRelayUrls(getSimulation()),
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

export function createPajaAdapter(
  config: PajaHostConfig,
  getSimulation: () => PajaSimulation,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
  signerProvider?: PajaSignerProvider,
  getIdentity?: PajaIdentityProvider,
): ShellAdapter {
  const pool = createMemoryRelayPool(getSimulation, confirmRequest);
  const workerRelayEvents: NostrEvent[] = [];
  return {
    relayPool: createRelayHooks(pool, getSimulation),
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => {
        const relays = getRelayUrls(getSimulation());
        return { discovery: relays, super: relays, outbox: relays };
      },
      getNip66Suggestions: () => getRelayUrls(getSimulation()),
    },
    windowManager: { createWindow: () => null },
    auth: {
      getUserPubkey: () => getRuntimePubkey(getSimulation, signerProvider),
      getSigner: () => createRuntimeSigner(getSimulation, confirmRequest, signerProvider),
    },
    services: createDevServices(pool, getSimulation, onThemeService, confirmRequest, signerProvider),
    get capabilities() {
      return { disabledDomains: getSimulation().capabilities.disabledDomains };
    },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => createWorkerRelay(workerRelayEvents) },
    upload: getSimulation().upload.mode === 'memory' ? { getUploader: () => ({ rails: [getSimulation().upload.rail] }) } : undefined,
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
    onNip5dIframeCreate: () => {
      const identity = getIdentity?.();
      return {
        dTag: identity?.dTag ?? config.window.dTag,
        aggregateHash: identity?.aggregateHash ?? config.window.aggregateHash,
      };
    },
  };
}
