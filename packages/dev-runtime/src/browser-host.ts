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

import type { DevRuntimeHostConfig } from './options.js';

interface DevRuntimeBrowserState {
  readonly config: DevRuntimeHostConfig;
  readonly capabilities: ShellCapabilities;
  readonly services: string[];
  generation: number;
  status: 'booting' | 'ready' | 'reloading' | 'error';
  reload(): void;
  getState(): {
    generation: number;
    status: DevRuntimeBrowserState['status'];
    iframeCount: number;
    initSent: boolean;
    services: string[];
  };
}

declare global {
  interface Window {
    __KEHTO_DEV_RUNTIME__?: DevRuntimeBrowserState;
  }
}

const DEFAULT_RELAYS = ['wss://relay.kehto.dev'];
const DEV_INTENT_ARCHETYPE = 'dev-runtime-target';
const DEV_CVM_SERVER: CvmServer = {
  pubkey: '0'.repeat(64),
  name: 'Kehto Dev Runtime ContextVM',
  description: 'Deterministic development ContextVM adapter',
  relays: DEFAULT_RELAYS,
  capabilities: ['echo'],
};

function readConfig(): DevRuntimeHostConfig {
  const script = document.getElementById('kehto-dev-runtime-config');
  if (!script?.textContent) {
    throw new Error('Missing Kehto dev runtime config.');
  }
  return JSON.parse(script.textContent) as DevRuntimeHostConfig;
}

function setStatus(state: DevRuntimeBrowserState, status: DevRuntimeBrowserState['status']): void {
  state.status = status;
  const statusEl = document.getElementById('lifecycle-status');
  if (statusEl) statusEl.textContent = status;
}

function getFrame(): HTMLIFrameElement {
  const frame = document.getElementById('napplet-frame');
  if (!(frame instanceof HTMLIFrameElement)) {
    throw new Error('Missing Kehto dev runtime iframe.');
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

function createMemoryRelayPool(): RelayPoolLike {
  const events: NostrEvent[] = [];
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

function createRelayHooks(pool: RelayPoolLike): RelayPoolHooks {
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
      pool.publish(DEFAULT_RELAYS, event);
      return true;
    },
    selectRelayTier: () => [...DEFAULT_RELAYS],
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

function createDevUploader(): Uploader {
  return {
    async upload(request: UploadRequest, ctx): Promise<UploadResult> {
      const size = request.data instanceof Blob ? request.data.size : request.data.byteLength;
      const result: UploadResult = {
        ok: true,
        uploadId: ctx.uploadId,
        status: 'complete',
        rail: request.rail ?? 'dev-memory',
        url: `kehto-dev://upload/${ctx.uploadId}`,
        size,
        mimeType: request.mimeType ?? (request.data instanceof Blob ? request.data.type : undefined),
      };
      ctx.onStatus({ ...result, updatedAt: Date.now() });
      return result;
    },
    async status(uploadId: string): Promise<UploadStatus> {
      return {
        ok: true,
        uploadId,
        status: 'complete',
        rail: 'dev-memory',
        url: `kehto-dev://upload/${uploadId}`,
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

function createDevCvmTransport(): CvmTransport {
  return {
    async discover() {
      return [DEV_CVM_SERVER];
    },
    async request(_server, message): Promise<McpMessage> {
      const id = typeof message.id === 'string' || typeof message.id === 'number' ? message.id : 'dev-runtime';
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

function createOutboxRouter(pool: RelayPoolLike) {
  return {
    async query(filters: NostrFilter[]) {
      const events = await new Promise<NostrEvent[]>((resolve) => {
        const out: NostrEvent[] = [];
        pool.request(DEFAULT_RELAYS, filters).subscribe({
          next: (event) => out.push(event as NostrEvent),
          complete: () => resolve(out),
          error: () => resolve(out),
        });
      });
      return { events, relays: Object.fromEntries(events.map((event) => [event.id, DEFAULT_RELAYS])) };
    },
    subscribe(filters: NostrFilter[], _options: unknown, sink: { event(event: NostrEvent, relay?: string): void; eose(): void; closed(reason?: string): void }) {
      const sub = pool.subscription(DEFAULT_RELAYS, filters).subscribe((item) => {
        if (item === 'EOSE') sink.eose();
        else sink.event(item as NostrEvent, DEFAULT_RELAYS[0]);
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
      pool.publish(DEFAULT_RELAYS, event);
      return { ok: true, event, eventId: event.id, relays: { [DEFAULT_RELAYS[0] ?? 'dev']: true } };
    },
    async resolveRelays() {
      return { relays: [...DEFAULT_RELAYS], source: 'policy' as const };
    },
  };
}

function createDevServices(pool: RelayPoolLike): Record<string, ServiceHandler> {
  const notification = createNotificationService({ maxPerWindow: 50 });
  const notify = createNotifyService();
  const theme = createThemeService({ onBroadcast: () => {} });
  const config = createConfigService({
    getValues: () => ({
      runtime: 'kehto-dev-runtime',
      mode: 'development',
      target: 'single-window',
    }),
  });
  const uploader = createDevUploader();
  return {
    relay: createRelayPoolService({
      subscribe: (filters, callback, relayUrls) => pool.subscription(relayUrls ?? DEFAULT_RELAYS, filters).subscribe((item) => {
        if (item === 'EOSE' || (typeof item === 'object' && item !== null)) {
          callback(item as NostrEvent | 'EOSE');
        }
      }),
      publish: (event) => pool.publish(DEFAULT_RELAYS, event),
      selectRelayTier: () => [...DEFAULT_RELAYS],
      isAvailable: () => true,
    }),
    outbox: createOutboxService({ router: createOutboxRouter(pool) }),
    identity: createIdentityService({ getSigner: () => null }),
    notifications: notification,
    notify,
    keys: createKeysService(),
    media: createMediaService(),
    theme: theme.handler,
    config: config.handler,
    resource: createResourceService({
      fetch: (url, init) => fetch(url, init),
      isOriginGranted: () => true,
      getConnectGrants: () => ['*'],
      resolveIdentity: () => ({ dTag: 'dev-target', aggregateHash: 'dev-runtime' }),
    }),
    cvm: createCvmService({ transport: createDevCvmTransport() }),
    upload: createUploadService({ uploader }),
    intent: createIntentService({
      resolver: {
        invoke(request: IntentRequest): IntentResult {
          return {
            ok: true,
            archetype: request.archetype,
            action: request.action ?? 'open',
            handled: request.archetype === DEV_INTENT_ARCHETYPE,
            handler: 'dev-target',
            windowId: 'kehto-dev-runtime-window',
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
    }),
  };
}

function createDevRuntimeAdapter(config: DevRuntimeHostConfig): ShellAdapter {
  const pool = createMemoryRelayPool();
  const workerRelayEvents: NostrEvent[] = [];
  return {
    relayPool: createRelayHooks(pool),
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => ({ discovery: [...DEFAULT_RELAYS], super: [...DEFAULT_RELAYS], outbox: [...DEFAULT_RELAYS] }),
      getNip66Suggestions: () => [...DEFAULT_RELAYS],
    },
    windowManager: { createWindow: () => null },
    auth: { getUserPubkey: () => '', getSigner: () => null },
    services: createDevServices(pool),
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => createWorkerRelay(workerRelayEvents) },
    upload: { getUploader: () => ({ rails: ['dev-memory'] }) },
    intent: { isAvailable: () => true },
    crypto: {
      verifyEvent: async () => true,
    },
    onNip5dIframeCreate: () => ({
      dTag: config.window.dTag,
      aggregateHash: config.window.aggregateHash,
    }),
  };
}

function registerFrameForGeneration(bridge: ShellBridge, frame: HTMLIFrameElement, config: DevRuntimeHostConfig, generation: number): string | null {
  const win = frame.contentWindow;
  if (!win) return null;
  const windowId = `${config.window.id}:${generation}`;
  originRegistry.register(win, windowId, {
    dTag: config.window.dTag,
    aggregateHash: config.window.aggregateHash,
  });
  return windowId;
}

function navigateFrame(bridge: ShellBridge, frame: HTMLIFrameElement, config: DevRuntimeHostConfig, generation: number): string | null {
  const windowId = registerFrameForGeneration(bridge, frame, config, generation);
  frame.src = 'about:blank';
  window.setTimeout(() => {
    registerFrameForGeneration(bridge, frame, config, generation);
    frame.src = config.target.url;
  }, 0);
  return windowId;
}

function installDevRuntimeHost(): void {
  const config = readConfig();
  const frame = getFrame();
  const adapter = createDevRuntimeAdapter(config);
  const bridge = createShellBridge(adapter);
  const capabilities = buildShellCapabilities(adapter);
  const services = Object.keys(adapter.services ?? {}).sort();
  let currentWindowId: string | null = null;
  let initReceivedGeneration = -1;

  const state: DevRuntimeBrowserState = {
    config,
    capabilities,
    services,
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
    getState() {
      return {
        generation: this.generation,
        status: this.status,
        iframeCount: document.querySelectorAll('iframe').length,
        initSent: initReceivedGeneration === this.generation,
        services,
      };
    },
  };

  window.__KEHTO_DEV_RUNTIME__ = state;

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

  setStatus(state, 'booting');
  currentWindowId = navigateFrame(bridge, frame, config, state.generation);
}

try {
  installDevRuntimeHost();
} catch (error) {
  const statusEl = document.getElementById('lifecycle-status');
  if (statusEl) statusEl.textContent = 'error';
  console.error(error);
}
