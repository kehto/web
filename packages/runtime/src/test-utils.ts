
import type {
  RuntimeAdapter,
  RelayPoolAdapter,
  CacheAdapter,
  AuthAdapter,
  ConfigAdapter,
  HotkeyAdapter,
  CryptoAdapter,
  AclPersistence,
  ManifestPersistence,
  StatePersistence,
  WindowManagerAdapter,
  RelayConfigAdapter,
  AclCheckEvent,
  SessionEntry,
} from './types.js';
import type { NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';

export interface SentMessage {
  windowId: string;
  message: unknown[] | NappletMessage;
}

export interface MockRuntimeContext {
  hooks: RuntimeAdapter;
  /** All messages sent to napplets via sendToNapplet. */
  sent: SentMessage[];
  /** All ACL check events logged. */
  aclChecks: AclCheckEvent[];
  /** In-memory state storage. */
  stateStore: Map<string, string>;
  /** In-memory ACL persistence store. */
  aclStore: { data: string | null };
  /** In-memory manifest persistence store. */
  manifestStore: { data: string | null };
  /** Reset all recorded data. */
  reset(): void;
}

function createMockRelayPool(): RelayPoolAdapter {
  const tracked = new Map<string, () => void>();

  return {
    subscribe(_filters: NostrFilter[], _cb: (item: NostrEvent | 'EOSE') => void, _relayUrls?: string[]) {
      return { unsubscribe() { /* no-op */ } };
    },
    publish(_event: NostrEvent) { /* no-op */ },
    selectRelayTier(_filters: NostrFilter[]) { return []; },
    trackSubscription(subKey: string, cleanup: () => void) { tracked.set(subKey, cleanup); },
    untrackSubscription(subKey: string) { const fn = tracked.get(subKey); if (fn) { fn(); tracked.delete(subKey); } },
    openScopedRelay() { /* no-op */ },
    closeScopedRelay() { /* no-op */ },
    publishToScopedRelay() { return false; },
    isAvailable() { return false; },
  };
}

function createMockCache(): CacheAdapter {
  return {
    query(_filters: NostrFilter[]) { return Promise.resolve([]); },
    store(_event: NostrEvent) { /* no-op */ },
    isAvailable() { return false; },
  };
}

function createMockAuth(): AuthAdapter {
  return {
    getUserPubkey() { return 'user_' + '0'.repeat(60); },
    getSigner() { return null; },
  };
}

function createMockConfig(): ConfigAdapter {
  return {
    getNappUpdateBehavior() { return 'auto-grant'; },
  };
}

function createMockHotkeys(): HotkeyAdapter {
  return {
    executeHotkeyFromForward() { /* no-op */ },
  };
}

let uuidCounter = 0;

function createMockCrypto(): CryptoAdapter {
  return {
    async verifyEvent(_event: NostrEvent) { return true; },
    randomUUID() { return `mock-uuid-${++uuidCounter}-${'0'.repeat(40)}`; },
    randomBytes(length: number) { return new Uint8Array(length); },
  };
}

function createMockAclPersistence(store: { data: string | null }): AclPersistence {
  return {
    persist(data: string) { store.data = data; },
    load() { return store.data; },
  };
}

function createMockManifestPersistence(store: { data: string | null }): ManifestPersistence {
  return {
    persist(data: string) { store.data = data; },
    load() { return store.data; },
  };
}

function createMockStatePersistence(stateStore: Map<string, string>): StatePersistence {
  return {
    get(key: string) { return stateStore.get(key) ?? null; },
    set(key: string, value: string) { stateStore.set(key, value); return true; },
    remove(key: string) { stateStore.delete(key); },
    clear(prefix: string) {
      for (const k of stateStore.keys()) {
        if (k.startsWith(prefix)) stateStore.delete(k);
      }
    },
    keys(prefix: string) {
      return [...stateStore.keys()].filter(k => k.startsWith(prefix));
    },
    calculateBytes(prefix: string) {
      let bytes = 0;
      for (const [k, v] of stateStore.entries()) {
        if (k.startsWith(prefix)) bytes += k.length + v.length;
      }
      return bytes;
    },
  };
}

function createMockWindowManager(): WindowManagerAdapter {
  return {
    createWindow(_options: { title: string; class: string; iframeSrc?: string }) { return 'mock-window-1'; },
  };
}

function createMockRelayConfig(): RelayConfigAdapter {
  return {
    addRelay() { /* no-op */ },
    removeRelay() { /* no-op */ },
    getRelayConfig() { return { discovery: [], super: [], outbox: [] }; },
    getNip66Suggestions() { return []; },
  };
}

/**
 * Create a complete set of mock RuntimeAdapter for testing.
 * All adapters are sensible no-ops that record calls for assertions.
 *
 * @param overrides - Partial overrides for any adapter property
 * @returns A MockRuntimeContext with hooks and recorded data
 */
export function createMockRuntimeAdapter(overrides?: Partial<RuntimeAdapter>): MockRuntimeContext {
  const sent: SentMessage[] = [];
  const aclChecks: AclCheckEvent[] = [];
  const stateStore = new Map<string, string>();
  const aclStore = { data: null as string | null };
  const manifestStore = { data: null as string | null };

  uuidCounter = 0;

  const hooks: RuntimeAdapter = {
    sendToNapplet(windowId: string, msg: unknown[] | NappletMessage) {
      sent.push({ windowId, message: msg });
    },
    relayPool: createMockRelayPool(),
    cache: createMockCache(),
    auth: createMockAuth(),
    config: createMockConfig(),
    hotkeys: createMockHotkeys(),
    crypto: createMockCrypto(),
    aclPersistence: createMockAclPersistence(aclStore),
    manifestPersistence: createMockManifestPersistence(manifestStore),
    statePersistence: createMockStatePersistence(stateStore),
    windowManager: createMockWindowManager(),
    relayConfig: createMockRelayConfig(),
    onAclCheck(event: AclCheckEvent) { aclChecks.push(event); },
    ...overrides,
  };

  return {
    hooks,
    sent,
    aclChecks,
    stateStore,
    aclStore,
    manifestStore,
    reset() {
      sent.length = 0;
      aclChecks.length = 0;
      stateStore.clear();
      aclStore.data = null;
      manifestStore.data = null;
      uuidCounter = 0;
    },
  };
}

/**
 * Create a NIP-5D session entry for use in tests.
 * The pubkey is empty string — identity comes from origin registration.
 *
 * @param windowId - The napplet's window identifier
 * @param dTag - The napplet's dTag (NIP-5D identifier)
 * @param aggregateHash - The napplet's aggregate hash
 * @param options - Optional entry overrides (e.g. `instanceable` for per-window storage; kehto/web#35)
 * @returns A SessionEntry suitable for registering in tests
 *
 * @example
 * ```ts
 * const entry = createNip5dSessionEntry('win-1', 'my-napp', 'abc123...');
 * runtime.sessionRegistry.register('win-1', entry);
 *
 * // Instanceable napplet (per-window storage scoping):
 * const inst = createNip5dSessionEntry('win-2', 'feed', 'abc123...', { instanceable: true });
 * ```
 */
export function createNip5dSessionEntry(
  windowId: string,
  dTag: string,
  aggregateHash: string,
  options?: { instanceable?: boolean },
): SessionEntry {
  return {
    pubkey: '',
    windowId,
    origin: '',
    type: 'nip5d',
    dTag,
    aggregateHash,
    registeredAt: Date.now(),
    instanceId: `guid-${windowId}`,
    provenance: 'nip-5d',
    class: null, // CLASS-02: permissive default
    instanceable: options?.instanceable ?? false,
  };
}

/**
 * Find a NIP-5D envelope response in the sent messages by type.
 * Useful for asserting that a handler returned an envelope with the expected type.
 *
 * @param sent - The sent messages array from MockRuntimeContext
 * @param type - The expected envelope type (e.g., 'relay.req.error')
 * @returns The matching NappletMessage, or undefined if not found
 *
 * @example
 * ```ts
 * const errMsg = findEnvelopeResponse(ctx.sent, 'relay.req.error');
 * expect(errMsg).toBeDefined();
 * expect((errMsg as any).error).toBe('not implemented');
 * ```
 */
export function findEnvelopeResponse(sent: SentMessage[], type: string): NappletMessage | undefined {
  for (const s of sent) {
    if (
      typeof s.message === 'object' &&
      !Array.isArray(s.message) &&
      (s.message as NappletMessage).type === type
    ) {
      return s.message as NappletMessage;
    }
  }
  return undefined;
}
