import {
  buildShellCapabilities,
  resolveShellEnvironment,
  type AclCheckEvent,
  type NostrEvent,
  type OriginIdentity,
  type ServiceHandler,
  type SessionEntry,
  type ShellAdapter,
  type ShellCapabilities,
} from '@kehto/shell';
import type {
  BleAttribute,
  BleOpenRequest,
  BleOpenResult,
  BleService as CoreBleService,
  BleWriteOptions,
  WebrtcEvent,
  WebrtcOpenRequest,
  WebrtcOpenResult,
} from '@napplet/core';
import type { Theme, ThemeChangedMessage } from '@napplet/nap/theme/types';
import { RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN } from './main-preferences.js';

/**
 * Static per-dTag origin allowlist for `getConnectGrants` (Task 4 static-allowlist).
 * resource-demo is the only napplet that fetches external resources; all others
 * receive an empty array (deny all origins).
 */
const STATIC_CONNECT_GRANTS: ReadonlyMap<string, readonly string[]> = new Map([
  ['resource-demo', [RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN]],
]);
import {
  createIdentityService,
  createNotificationService,
  createKeysService,
  createLinkService,
  createListsService,
  createMediaService,
  createThemeService,
  createConfigService,
  createCommonService,
  createResourceService,
  createBleService,
  createSerialService,
  createWebrtcService,
  createCvmService,
  type ConfigService,
  type Notification,
  type ThemeService,
} from '@kehto/services';
import { createNip66Aggregator, type Nip66Aggregator } from '@kehto/nip/66';

import { demoConfig } from './demo-config.js';
import { createPlaygroundNip66FixturePool } from './playground-relay-fixtures.js';
import {
  createPlaygroundRelayRuntime,
  type PlaygroundRelayActivityEntry,
} from './playground-relay-service.js';
import { DEFAULT_PLAYGROUND_RELAY_SELECTION } from './playground-relay-selection.js';
import { createPlaygroundWorkerRelayBundle } from './playground-worker-relay.js';
import { getSigner, getSignerConnectionState } from './signer-connection.js';
import { createPlaygroundCvmTransport } from './playground-cvm-transport.js';

type NappletAclInfo = {
  pubkey?: string;
  dTag?: string;
  name: string;
};

export interface DemoHooksContext {
  getNappletEntries(): Iterable<[string, NappletAclInfo]>;
  getDisabledDomains(): readonly string[];
  onResolvedAclCheck(event: AclCheckEvent, windowId: string, nappletName: string): void;
  onThemeBroadcast(envelope: ThemeChangedMessage): void;
}

let notificationServiceHandler: ServiceHandler | null = null;
let themeServiceBundle: ThemeService | null = null;
let identityServiceHandler: ServiceHandler | null = null;
let configServiceBundle: ConfigService | null = null;
let shellCapabilities: ShellCapabilities | null = null;
let shellAdapter: ShellAdapter | null = null;
let nip66Aggregator: Nip66Aggregator | null = null;
let relayRuntimeDestroy: (() => void) | null = null;
let relayRuntimeActivity: ((limit?: number) => PlaygroundRelayActivityEntry[]) | null = null;
let relayServiceHandler: ServiceHandler | null = null;
let relayTeardownInstalled = false;
let sessionRegistryRef: {
  getEntryByWindowId(windowId: string): SessionEntry | undefined;
} | null = null;

const demoConfigFixtures: Record<string, unknown> = {
  theme: 'dark',
  density: 'compact',
  'notifications-enabled': true,
  recentSearches: [],
};
const DEMO_COMMON_PUBKEY = '3'.repeat(64);
const DEMO_COMMON_EVENT_ID = '4'.repeat(64);
const DEMO_LISTS_EVENT_ID = '5'.repeat(64);
const DEMO_SERIAL_LABEL = 'Playground serial';
const DEMO_BLE_DEVICE_NAME = 'Playground BLE';
const DEMO_BLE_SERVICE_UUID = 'battery_service';
const DEMO_BLE_CHARACTERISTIC_UUID = 'battery_level';
const DEMO_WEBRTC_PEER = '7'.repeat(64);
type DemoListRef = { readonly type?: string; readonly kind?: number };
type DemoListItem = { readonly itemType: string; readonly value: string };

const DEMO_LISTS_SUPPORT = {
  kind: 10003,
  type: 'bookmarks',
  addressable: false,
  supportedItemTypes: ['event', 'url'] as never[],
};

export function createDemoHooks(
  notificationOnChange: ((notifications: readonly Notification[]) => void) | undefined,
  context: DemoHooksContext,
  initialTheme?: Theme,
): ShellAdapter {
  const notificationService = createNotificationService({ onChange: notificationOnChange, maxPerWindow: 50 });
  const keysService = createDemoKeysService();
  const mediaService = createMediaService({
    onSessionCreate: (windowId, sessionId, metadata) => {
      void windowId;
      void sessionId;
      void metadata;
    },
  });
  const themeBundle = createThemeService({ initialTheme, onBroadcast: context.onThemeBroadcast });
  const configBundle = createConfigService({ getValues: () => ({ ...demoConfigFixtures }) });
  const resourceHandler = createDemoResourceHandler();
  const linkService = createLinkService({
    open: ({ url }) => ({
      status: url.hostname === 'blocked.example' ? 'denied' : 'opened',
    }),
  });
  const commonService = createCommonService({
    getProfile: (target) => ({
      ok: true,
      pubkey: target || getSignerConnectionState().pubkey || DEMO_COMMON_PUBKEY,
      profile: { name: 'playground-common', displayName: 'Playground Common' },
      relays: [...DEFAULT_PLAYGROUND_RELAY_SELECTION.defaultRelays],
    }),
    follows: () => ({ ok: true, pubkeys: [getSignerConnectionState().pubkey ?? DEMO_COMMON_PUBKEY] }),
    follow: () => ({ ok: true, eventId: DEMO_COMMON_EVENT_ID }),
    unfollow: () => ({ ok: true, eventId: DEMO_COMMON_EVENT_ID }),
    react: () => ({ ok: true, eventId: DEMO_COMMON_EVENT_ID }),
    report: () => ({ ok: true, eventId: DEMO_COMMON_EVENT_ID }),
  });
  const listsService = createDemoListsService();
  const serialService = createDemoSerialService();
  const bleService = createDemoBleService();
  const webrtcService = createDemoWebrtcService();
  const cvmService = createCvmService({ transport: createPlaygroundCvmTransport() });
  const identityService = createIdentityService({ getSigner });
  relayRuntimeDestroy?.();
  relayRuntimeActivity = null;
  nip66Aggregator?.stop();
  nip66Aggregator = createNip66Aggregator({
    pool: createPlaygroundNip66FixturePool(),
    bootstrap: ['wss://demo-monitor.local'],
  });
  nip66Aggregator.start();
  const workerRelay = createPlaygroundWorkerRelayBundle();
  const relayRuntime = createPlaygroundRelayRuntime({
    nip66Aggregator,
    cache: workerRelay.cache,
  });
  relayRuntimeDestroy = relayRuntime.destroy;
  relayRuntimeActivity = relayRuntime.getRelayActivity;
  installRelayTeardown();

  const services = {
    relay: relayRuntime.relayService,
    identity: identityService,
    notifications: notificationService,
    notify: notificationService,
    keys: keysService,
    media: mediaService,
    link: linkService,
    common: commonService,
    lists: listsService,
    serial: serialService,
    ble: bleService,
    webrtc: webrtcService,
    theme: themeBundle.handler,
    config: configBundle.handler,
    resource: resourceHandler,
    cvm: cvmService,
  };

  notificationServiceHandler = notificationService;
  identityServiceHandler = identityService;
  themeServiceBundle = themeBundle;
  configServiceBundle = configBundle;
  relayServiceHandler = relayRuntime.relayService;

  const adapter = createDemoShellAdapter(
    services,
    context,
    relayRuntime.relayPoolHooks,
    workerRelay.workerRelayHooks,
  );
  shellAdapter = adapter;
  shellCapabilities = buildShellCapabilities(adapter);
  return adapter;
}

function createDemoKeysService(): ServiceHandler {
  return createKeysService({
    reservedChords: ['Ctrl+Shift+R'],
    onForward: (event) => {
      const sentinel = document.getElementById('reserved-chord-last-fired');
      if (!sentinel) return;
      const parts: string[] = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push('Meta');
      parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
      sentinel.textContent = parts.join('+');
    },
  });
}

async function hostFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; signal: AbortSignal },
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10_000);
  const composite = new AbortController();
  for (const src of [init.signal, timeoutController.signal]) {
    src.addEventListener('abort', () => composite.abort(), { once: true });
  }
  try {
    return await fetch(url, { method: init.method, headers: init.headers, signal: composite.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function createDemoResourceHandler(): ServiceHandler {
  return createResourceService({
    fetch: hostFetch,
    isOriginGranted: (origin, grants) => grants.includes(origin),
    getConnectGrants: (dTag, _aggregateHash) => STATIC_CONNECT_GRANTS.get(dTag) ?? [],
    resolveIdentity: (windowId) => {
      const entry = sessionRegistryRef?.getEntryByWindowId(windowId);
      return entry ? { dTag: entry.dTag, aggregateHash: entry.aggregateHash } : null;
    },
  });
}

async function verifyDemoEvent(event: NostrEvent): Promise<boolean> {
  const { verifyEvent } = await import('nostr-tools/pure');
  return verifyEvent(event as Parameters<typeof verifyEvent>[0]);
}

function createDemoShellAdapter(
  services: ShellAdapter['services'],
  context: DemoHooksContext,
  relayPool: ShellAdapter['relayPool'],
  workerRelay: ShellAdapter['workerRelay'],
): ShellAdapter {
  return {
    relayPool,
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => ({
        discovery: [...DEFAULT_PLAYGROUND_RELAY_SELECTION.relayIndexerRelays],
        super: [...DEFAULT_PLAYGROUND_RELAY_SELECTION.indexerRelays],
        outbox: [...DEFAULT_PLAYGROUND_RELAY_SELECTION.defaultRelays],
      }),
      getNip66Suggestions: () => Array.from(nip66Aggregator?.getRelaySet() ?? []),
    },
    windowManager: { createWindow: () => null },
    auth: {
      getUserPubkey: () => getSignerConnectionState().pubkey ?? '',
      getSigner,
    },
    services,
    capabilities: {
      get disabledDomains(): readonly string[] {
        return context.getDisabledDomains();
      },
    },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    link: { isAvailable: () => true },
    common: { isAvailable: () => true },
    lists: { isAvailable: () => true },
    serial: { isAvailable: () => true },
    ble: { isAvailable: () => true },
    webrtc: { isAvailable: () => true },
    workerRelay,
    crypto: createDemoCrypto(),
    getConfigOverrides: () => ({
      replayWindowSeconds: demoConfig.get('core.REPLAY_WINDOW_SECONDS'),
      ringBufferSize: demoConfig.get('runtime.RING_BUFFER_SIZE'),
    }),
    onAclCheck: (event) => handleAclCheck(context, event),
  };
}

function installRelayTeardown(): void {
  if (relayTeardownInstalled || typeof window === 'undefined') return;
  relayTeardownInstalled = true;
  window.addEventListener('beforeunload', () => {
    relayRuntimeDestroy?.();
    relayRuntimeActivity = null;
    nip66Aggregator?.stop();
  });
}

function createDemoCrypto(): ShellAdapter['crypto'] {
  return {
    verifyEvent: verifyDemoEvent,
  };
}

function handleAclCheck(context: DemoHooksContext, event: AclCheckEvent): void {
  if (typeof window !== 'undefined') {
    const w = window as Window & { __aclEvents__?: Array<unknown> };
    w.__aclEvents__ ??= [];
    w.__aclEvents__.push({ ...event });
  }
  const resolved = resolveAclEntry(context, event);
  if (resolved) context.onResolvedAclCheck(event, resolved.windowId, resolved.nappletName);
}

function resolveAclEntry(
  context: DemoHooksContext,
  event: AclCheckEvent,
): { windowId: string; nappletName: string } | null {
  for (const [windowId, info] of context.getNappletEntries()) {
    if (info.pubkey && info.pubkey === event.identity.pubkey) {
      return { windowId, nappletName: info.name };
    }
    if (!event.identity.pubkey && info.dTag === event.identity.dTag) {
      return { windowId, nappletName: info.name };
    }
  }
  return null;
}

function createDemoListsService(): ServiceHandler {
  const values = new Set<string>();
  const itemKey = (item: DemoListItem) => `${item.itemType}:${item.value}`;
  const isSupported = (list: DemoListRef): boolean =>
    ('type' in list && list.type === DEMO_LISTS_SUPPORT.type)
    || ('kind' in list && list.kind === DEMO_LISTS_SUPPORT.kind);

  return createListsService({
    supported: () => [DEMO_LISTS_SUPPORT],
    add: (list: DemoListRef, items: readonly DemoListItem[]) => {
      if (!isSupported(list)) return { ok: false, error: 'unsupported-list', reason: 'unsupported list', supported: [DEMO_LISTS_SUPPORT] };
      let added = 0;
      let skipped = 0;
      for (const item of items) {
        const key = itemKey(item);
        if (values.has(key)) skipped += 1;
        else {
          values.add(key);
          added += 1;
        }
      }
      return { ok: true, eventId: DEMO_LISTS_EVENT_ID, added, skipped };
    },
    remove: (list: DemoListRef, items: readonly DemoListItem[]) => {
      if (!isSupported(list)) return { ok: false, error: 'unsupported-list', reason: 'unsupported list', supported: [DEMO_LISTS_SUPPORT] };
      let removed = 0;
      let skipped = 0;
      for (const item of items) {
        if (values.delete(itemKey(item))) removed += 1;
        else skipped += 1;
      }
      return { ok: true, eventId: DEMO_LISTS_EVENT_ID, removed, skipped };
    },
  });
}

function destroyWindowSessions<T extends { windowId: string }>(
  sessions: Map<string, T>,
  windowId: string,
): void {
  for (const [sessionId, session] of sessions) {
    if (session.windowId === windowId) sessions.delete(sessionId);
  }
}

function createDemoSerialService(): ServiceHandler {
  const sessions = new Map<string, { windowId: string; writes: number[][] }>();
  let nextSession = 1;

  return createSerialService({
    open: (_request, context) => {
      const id = `playground-serial-${nextSession++}`;
      sessions.set(id, { windowId: context.windowId, writes: [] });
      return {
        session: {
          id,
          state: 'open',
          info: { displayName: DEMO_SERIAL_LABEL },
        },
      };
    },
    write: (sessionId, data) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error('serial session not found');
      session.writes.push([...data]);
    },
    close: (sessionId) => {
      if (!sessions.delete(sessionId)) throw new Error('serial session not found');
    },
    destroyWindow: (windowId) => {
      destroyWindowSessions(sessions, windowId);
    },
  });
}

function createDemoBleService(): ServiceHandler {
  const sessions = new Map<string, { windowId: string; writes: number[][]; subscriptions: Set<string> }>();
  let nextSession = 1;
  const service: CoreBleService = {
    uuid: DEMO_BLE_SERVICE_UUID,
    characteristics: [{
      uuid: DEMO_BLE_CHARACTERISTIC_UUID,
      properties: { read: true, write: true, notify: true },
    }],
  };
  const targetKey = (target: BleAttribute): string =>
    `${String(target.service)}:${String(target.characteristic)}:${String(target.descriptor ?? '')}`;
  const getSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('ble session not found');
    return session;
  };

  return createBleService({
    open: (_request: BleOpenRequest, context): BleOpenResult => {
      const id = `playground-ble-${nextSession++}`;
      sessions.set(id, { windowId: context.windowId, writes: [], subscriptions: new Set() });
      return {
        session: {
          id,
          state: 'open',
          device: {
            id: 'playground-ble-device',
            name: DEMO_BLE_DEVICE_NAME,
            services: [DEMO_BLE_SERVICE_UUID],
          },
        },
      };
    },
    services: (sessionId) => {
      getSession(sessionId);
      return [service];
    },
    read: (sessionId) => {
      getSession(sessionId);
      return [87];
    },
    write: (sessionId, _target, data, _options: BleWriteOptions | undefined) => {
      getSession(sessionId).writes.push([...data]);
    },
    subscribe: (sessionId, target) => {
      getSession(sessionId).subscriptions.add(targetKey(target));
    },
    unsubscribe: (sessionId, target) => {
      getSession(sessionId).subscriptions.delete(targetKey(target));
    },
    close: (sessionId) => {
      if (!sessions.delete(sessionId)) throw new Error('ble session not found');
    },
    destroyWindow: (windowId) => {
      destroyWindowSessions(sessions, windowId);
    },
  });
}

function createDemoWebrtcService(): ServiceHandler {
  const sessions = new Map<string, { windowId: string; payloads: unknown[] }>();
  let nextSession = 1;
  const getSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('webrtc session not found');
    return session;
  };

  return createWebrtcService({
    open: (request: WebrtcOpenRequest, context): WebrtcOpenResult => {
      const id = `playground-webrtc-${nextSession++}`;
      const channel = request.channel ?? 'default';
      sessions.set(id, { windowId: context.windowId, payloads: [] });
      context.emit({ type: 'state', sessionId: id, state: 'open' });
      context.emit({ type: 'peer', sessionId: id, pubkey: DEMO_WEBRTC_PEER, state: 'joined' });
      return {
        session: {
          id,
          scope: request.scope,
          channel,
          ...(request.protocol ? { protocol: request.protocol } : {}),
          state: 'open',
        },
      };
    },
    send: (sessionId, payload, context) => {
      getSession(sessionId).payloads.push(payload);
      context.emit({ type: 'message', sessionId, from: DEMO_WEBRTC_PEER, payload } satisfies WebrtcEvent);
    },
    close: (sessionId, reason, context) => {
      getSession(sessionId);
      sessions.delete(sessionId);
      context.emit({ type: 'closed', sessionId, ...(reason ? { reason } : {}) });
    },
    destroyWindow: (windowId) => {
      destroyWindowSessions(sessions, windowId);
    },
  });
}

export function setDemoSessionRegistryRef(registry: typeof sessionRegistryRef): void {
  sessionRegistryRef = registry;
}

export function getNip66Aggregator(): Nip66Aggregator | null {
  return nip66Aggregator;
}

export function getPlaygroundRelayActivity(limit = 5): PlaygroundRelayActivityEntry[] {
  return relayRuntimeActivity?.(limit) ?? [];
}

export function getConfigServiceBundle(): ConfigService | null {
  return configServiceBundle;
}

export function setDemoConfigValue(key: string, value: unknown): void {
  demoConfigFixtures[key] = value;
  configServiceBundle?.publishValues({ ...demoConfigFixtures });
}

export function getNotificationServiceHandler(): ServiceHandler | null {
  return notificationServiceHandler;
}

export function getThemeServiceBundle(): ThemeService | null {
  return themeServiceBundle;
}

export function getIdentityServiceHandler(): ServiceHandler | null {
  return identityServiceHandler;
}

export function getShellCapabilities(): ShellCapabilities | null {
  if (!shellCapabilities || !shellAdapter) return null;
  return {
    domains: [...buildShellCapabilities(shellAdapter).domains],
  };
}

export function getMissingRequiredNaps(
  requires: readonly string[],
  domains = getShellCapabilities()?.domains,
): string[] {
  if (!domains) return [...requires];
  const supported = new Set(domains);
  return requires.filter((capability) => !supported.has(capability));
}

/**
 * Resolve one fresh, immutable host environment for a trusted playground frame.
 *
 * @param identity - The frame identity registered before its srcdoc executes.
 * @returns A host-resolved snapshot of the frame's live, granted environment.
 */
export function getPlaygroundShellEnvironment(identity: OriginIdentity) {
  if (!shellAdapter) throw new Error('playground shell hooks are not initialized');
  return resolveShellEnvironment(shellAdapter, identity);
}

/**
 * Get the relay service handler for host-side relay operations (e.g. theme discovery).
 * Returns null before createDemoHooks() has run.
 *
 * @returns The relay ServiceHandler, or null if not yet initialized.
 */
export function getRelayServiceHandler(): ServiceHandler | null {
  return relayServiceHandler;
}
