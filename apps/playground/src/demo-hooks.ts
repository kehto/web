import {
  buildShellCapabilities,
  connectStore,
  type AclCheckEvent,
  type NostrEvent,
  type ServiceHandler,
  type SessionEntry,
  type ShellAdapter,
  type ShellCapabilities,
} from '@kehto/shell';
import {
  createIdentityService,
  createNotificationService,
  createKeysService,
  createMediaService,
  createThemeService,
  createConfigService,
  createResourceService,
  createCvmService,
  type ConfigService,
  type Notification,
  type ThemeService,
} from '@kehto/services';
import { createNip66Aggregator, type Nip66Aggregator } from '@kehto/nip/66';

import { createDemoDecryptBridge } from './demo-decrypt.js';
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
  onResolvedAclCheck(event: AclCheckEvent, windowId: string, nappletName: string): void;
}

let notificationServiceHandler: ServiceHandler | null = null;
let themeServiceBundle: ThemeService | null = null;
let identityServiceHandler: ServiceHandler | null = null;
let configServiceBundle: ConfigService | null = null;
let shellCapabilities: ShellCapabilities | null = null;
let nip66Aggregator: Nip66Aggregator | null = null;
let relayRuntimeDestroy: (() => void) | null = null;
let relayRuntimeActivity: ((limit?: number) => PlaygroundRelayActivityEntry[]) | null = null;
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

export function createDemoHooks(
  notificationOnChange: ((notifications: readonly Notification[]) => void) | undefined,
  context: DemoHooksContext,
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
  const themeBundle = createThemeService({ onBroadcast: () => {} });
  const configBundle = createConfigService({ getValues: () => ({ ...demoConfigFixtures }) });
  const resourceHandler = createDemoResourceHandler();
  const cvmService = createCvmService({ transport: createPlaygroundCvmTransport() });
  const identityService = createIdentityService({
    getSigner,
    getDecryptor: () => createDemoDecryptBridge(),
    verifyEvent: verifyDemoEvent,
  });
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
    theme: themeBundle.handler,
    config: configBundle.handler,
    resource: resourceHandler,
    cvm: cvmService,
  };

  notificationServiceHandler = notificationService;
  identityServiceHandler = identityService;
  themeServiceBundle = themeBundle;
  configServiceBundle = configBundle;

  const adapter = createDemoShellAdapter(
    services,
    context,
    relayRuntime.relayPoolHooks,
    workerRelay.workerRelayHooks,
  );
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
    getConnectGrants: (dTag, aggregateHash) => connectStore.getOrigins(dTag, aggregateHash),
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
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: () => {} },
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
  if (!shellCapabilities) return null;
  return {
    nubs: [...shellCapabilities.nubs],
    sandbox: [...shellCapabilities.sandbox],
  };
}

export function getMissingRequiredNaps(requires: readonly string[]): string[] {
  const capabilities = shellCapabilities;
  if (!capabilities) return [...requires];
  const supported = new Set(capabilities.nubs);
  return requires.filter((capability) => !supported.has(capability));
}
