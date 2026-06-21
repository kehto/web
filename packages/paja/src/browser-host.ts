import type { NostrEvent, NostrFilter } from '@napplet/core';
import {
  buildShellCapabilities,
  createShellBridge,
  originRegistry,
  type RelayPoolHooks,
  type RelayPoolLike,
  type ServiceHandler,
  type ShellAdapter,
  type ShellBridge,
  type ShellCapabilities,
} from '@kehto/shell';
import {
  createConfigService,
  createCvmService,
  createIdentityService,
  createIntentService,
  createKeysService,
  createMediaService,
  createNotificationService,
  createNotifyService,
  createOutboxService,
  createRelayPoolService,
  createResourceService,
  createThemeService,
  createUploadService,
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

import type { PajaHostConfig } from './options.js';
import {
  summarizePajaSimulation,
  type PajaSimulation,
} from './simulation.js';

interface PajaBrowserState {
  readonly config: PajaHostConfig;
  readonly capabilities: ShellCapabilities;
  readonly services: string[];
  simulation: PajaSimulation;
  generation: number;
  status: 'booting' | 'ready' | 'reloading' | 'error';
  reload(): void;
  setThemeMode(mode: PajaSimulation['theme']['mode']): void;
  getState(): {
    generation: number;
    status: PajaBrowserState['status'];
    iframeCount: number;
    initSent: boolean;
    services: string[];
    simulation: PajaSimulation;
  };
}

declare global {
  interface Window {
    __KEHTO_PAJA__?: PajaBrowserState;
  }
}

const DEV_INTENT_ARCHETYPE = 'paja-target';
const DEV_CVM_SERVER: CvmServer = {
  pubkey: '0'.repeat(64),
  name: 'Kehto Paja ContextVM',
  description: 'Deterministic development ContextVM adapter',
  relays: ['wss://relay.kehto.dev'],
  capabilities: ['echo'],
};

function readConfig(): PajaHostConfig {
  const script = document.getElementById('kehto-paja-config');
  if (!script?.textContent) {
    throw new Error('Missing Kehto Paja config.');
  }
  return JSON.parse(script.textContent) as PajaHostConfig;
}

function setStatus(state: PajaBrowserState, status: PajaBrowserState['status']): void {
  state.status = status;
  const statusEl = document.getElementById('lifecycle-status');
  if (statusEl) statusEl.textContent = status;
}

function setSimulationStatus(state: PajaBrowserState): void {
  const statusEl = document.getElementById('simulation-status');
  if (statusEl) statusEl.textContent = summarizePajaSimulation(state.simulation);
  const themeSelect = document.getElementById('simulation-theme');
  if (themeSelect instanceof HTMLSelectElement) themeSelect.value = state.simulation.theme.mode;
}

function getFrame(): HTMLIFrameElement {
  const frame = document.getElementById('napplet-frame');
  if (!(frame instanceof HTMLIFrameElement)) {
    throw new Error('Missing Kehto Paja iframe.');
  }
  frame.sandbox.add('allow-scripts');
  frame.sandbox.remove('allow-same-origin');
  return frame;
}

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

function createMemoryRelayPool(getSimulation: () => PajaSimulation): RelayPoolLike {
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

function createOutboxRouter(pool: RelayPoolLike, getSimulation: () => PajaSimulation) {
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
      const event = {
        id: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
        pubkey: '0'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: '',
        sig: '0'.repeat(128),
        ...template,
      } as NostrEvent;
      const relayUrls = getRelayUrls(getSimulation());
      pool.publish(relayUrls, event);
      return { ok: true, event, eventId: event.id, relays: { [relayUrls[0] ?? 'dev']: true } };
    },
    async resolveRelays() {
      return { relays: getRelayUrls(getSimulation()), source: 'policy' as const };
    },
  };
}

function createDevTheme(mode: PajaSimulation['theme']['mode'], values: PajaSimulation['theme']['values']): Theme {
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

function createDevSigner(getSimulation: () => PajaSimulation) {
  return {
    getPublicKey: () => getSimulation().identity.pubkey,
    getRelays: () => Object.fromEntries(getRelayUrls(getSimulation()).map((relay) => [relay, { read: true, write: true }])),
  };
}

function createDevServices(
  pool: RelayPoolLike,
  getSimulation: () => PajaSimulation,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
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
    services.outbox = createOutboxService({ router: createOutboxRouter(pool, getSimulation) });
  }

  if (getSimulation().identity.mode === 'fixed') {
    services.identity = createIdentityService({ getSigner: () => createDevSigner(getSimulation) });
  } else if (getSimulation().capabilities.domains.identity) {
    services.identity = createIdentityService({ getSigner: () => null });
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

  return services;
}

function createPajaAdapter(
  config: PajaHostConfig,
  getSimulation: () => PajaSimulation,
  onThemeService: (theme: ReturnType<typeof createThemeService>) => void,
): ShellAdapter {
  const pool = createMemoryRelayPool(getSimulation);
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
      getUserPubkey: () => getSimulation().identity.pubkey,
      getSigner: () => (getSimulation().identity.mode === 'fixed' ? createDevSigner(getSimulation) : null),
    },
    services: createDevServices(pool, getSimulation, onThemeService),
    capabilities: { disabledDomains: getSimulation().capabilities.disabledDomains },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => createWorkerRelay(workerRelayEvents) },
    upload: getSimulation().upload.mode === 'memory' ? { getUploader: () => ({ rails: [getSimulation().upload.rail] }) } : undefined,
    intent: { isAvailable: () => getSimulation().intent.enabled },
    crypto: {
      verifyEvent: async () => true,
    },
    onNip5dIframeCreate: () => ({
      dTag: config.window.dTag,
      aggregateHash: config.window.aggregateHash,
    }),
  };
}

function registerFrameForGeneration(bridge: ShellBridge, frame: HTMLIFrameElement, config: PajaHostConfig, generation: number): string | null {
  const win = frame.contentWindow;
  if (!win) return null;
  const windowId = `${config.window.id}:${generation}`;
  originRegistry.register(win, windowId, {
    dTag: config.window.dTag,
    aggregateHash: config.window.aggregateHash,
  });
  return windowId;
}

function navigateFrame(bridge: ShellBridge, frame: HTMLIFrameElement, config: PajaHostConfig, generation: number): string | null {
  const windowId = registerFrameForGeneration(bridge, frame, config, generation);
  frame.src = 'about:blank';
  window.setTimeout(() => {
    registerFrameForGeneration(bridge, frame, config, generation);
    frame.src = config.target.url;
  }, 0);
  return windowId;
}

function installPajaHost(): void {
  const config = readConfig();
  const frame = getFrame();
  let currentSimulation = config.simulation;
  const getSimulation = () => currentSimulation;
  let themeService: ReturnType<typeof createThemeService> | null = null;
  const adapter = createPajaAdapter(config, getSimulation, (theme) => {
    themeService = theme;
  });
  const bridge = createShellBridge(adapter);
  const capabilities = buildShellCapabilities(adapter);
  const services = Object.keys(adapter.services ?? {}).sort();
  let currentWindowId: string | null = null;
  let initReceivedGeneration = -1;

  const state: PajaBrowserState = {
    config,
    capabilities,
    services,
    simulation: currentSimulation,
    generation: 0,
    status: 'booting',
    reload() {
      if (currentWindowId) {
        bridge.runtime.destroyWindow(currentWindowId);
        bridge.runtime.sessionRegistry.unregister(currentWindowId);
        originRegistry.unregister(currentWindowId);
      }
      this.generation += 1;
      initReceivedGeneration = -1;
      setStatus(this, 'reloading');
      currentWindowId = navigateFrame(bridge, frame, config, this.generation);
    },
    setThemeMode(mode) {
      currentSimulation = {
        ...currentSimulation,
        theme: {
          ...currentSimulation.theme,
          mode,
        },
      };
      this.simulation = currentSimulation;
      themeService?.publishTheme(createDevTheme(currentSimulation.theme.mode, currentSimulation.theme.values));
      setSimulationStatus(this);
    },
    getState() {
      return {
        generation: this.generation,
        status: this.status,
        iframeCount: document.querySelectorAll('iframe').length,
        initSent: initReceivedGeneration === this.generation,
        services,
        simulation: currentSimulation,
      };
    },
  };

  window.__KEHTO_PAJA__ = state;

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    bridge.handleMessage(event);
    const data = event.data as { type?: unknown } | null;
    if (data && typeof data === 'object' && data.type === 'shell.ready') {
      initReceivedGeneration = state.generation;
      setStatus(state, 'ready');
    }
  });

  frame.addEventListener('load', () => {
    if (state.status === 'booting' || state.status === 'reloading') {
      registerFrameForGeneration(bridge, frame, config, state.generation);
    }
  });

  frame.addEventListener('error', () => {
    setStatus(state, 'error');
  });

  document.getElementById('reload-target')?.addEventListener('click', () => {
    state.reload();
  });

  document.getElementById('simulation-theme')?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.value === 'dark' || target.value === 'light') {
      state.setThemeMode(target.value);
    }
  });

  setStatus(state, 'booting');
  setSimulationStatus(state);
  currentWindowId = navigateFrame(bridge, frame, config, state.generation);
}

try {
  installPajaHost();
} catch (error) {
  const statusEl = document.getElementById('lifecycle-status');
  if (statusEl) statusEl.textContent = 'error';
  console.error(error);
}
