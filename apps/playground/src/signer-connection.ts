
import type { Signer } from '@kehto/runtime';
import type { Nip46LocalSecretKey } from './nip46-client.js';

export type SignerConnectionMethod = 'nip07' | 'nip46' | 'none';

export interface SignerRequestRecord {
  timestamp: number;
  method: string;     // 'signEvent', 'getPublicKey', 'nip04.encrypt', etc.
  kind?: number;      // for signEvent requests
  success: boolean;
}

export interface SignerConnectionState {
  method: SignerConnectionMethod;
  pubkey: string | null;
  relay: string | null;           // NIP-46 only; null for NIP-07
  recentRequests: SignerRequestRecord[];
  isConnecting: boolean;
  error: string | null;
}

/** NIP-07 browser-extension signer interface (read from `globalThis` during `connectNip07`; never exposed to napplets per NIP-5D MUST NOT clause D-01). */
export interface Nip07Signer {
  getPublicKey(): Promise<string>;
  signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>;
  getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

import { demoConfig } from './demo-config.js';

export const SIGNER_CONNECTION_STORAGE_KEY = 'kehto.playground.signerConnection.v1';

interface PersistedNip07Connection {
  version: 1;
  method: 'nip07';
  pubkey: string;
}

interface PersistedNip46Connection {
  version: 1;
  method: 'nip46';
  pubkey: string;
  relayUrl: string;
  bunkerPubkey: string;
  secret?: string;
  localSecretKey: string;
}

type PersistedSignerConnection = PersistedNip07Connection | PersistedNip46Connection;

const _initialState: SignerConnectionState = {
  method: 'none',
  pubkey: null,
  relay: null,
  recentRequests: [],
  isConnecting: false,
  error: null,
};

let _state: SignerConnectionState = { ..._initialState };
let _activeSigner: Signer | null = null;
const _listeners: Array<(state: SignerConnectionState) => void> = [];

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isHex(value: string, length: number): boolean {
  return value.length === length && /^[0-9a-f]+$/i.test(value);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!isHex(hex, 64)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function isPersistedSignerConnection(value: unknown): value is PersistedSignerConnection {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PersistedSignerConnection>;
  if (record.version !== 1) return false;
  if (record.method === 'nip07') {
    return typeof record.pubkey === 'string' && isHex(record.pubkey, 64);
  }
  if (record.method === 'nip46') {
    const nip46 = record as Partial<PersistedNip46Connection>;
    return (
      typeof nip46.pubkey === 'string' &&
      isHex(nip46.pubkey, 64) &&
      typeof nip46.relayUrl === 'string' &&
      nip46.relayUrl.length > 0 &&
      typeof nip46.bunkerPubkey === 'string' &&
      isHex(nip46.bunkerPubkey, 64) &&
      typeof nip46.localSecretKey === 'string' &&
      isHex(nip46.localSecretKey, 64) &&
      (nip46.secret === undefined || typeof nip46.secret === 'string')
    );
  }
  return false;
}

function readPersistedSignerConnection(): PersistedSignerConnection | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(SIGNER_CONNECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (isPersistedSignerConnection(parsed)) return parsed;
    storage.removeItem(SIGNER_CONNECTION_STORAGE_KEY);
    return null;
  } catch {
    try { storage.removeItem(SIGNER_CONNECTION_STORAGE_KEY); } catch { /* best-effort */ }
    return null;
  }
}

function writePersistedSignerConnection(connection: PersistedSignerConnection): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SIGNER_CONNECTION_STORAGE_KEY, JSON.stringify(connection));
  } catch {
    // Storage can be unavailable in hardened browser contexts; keep session state usable.
  }
}

export function clearPersistedSignerConnection(): void {
  const storage = getStorage();
  if (!storage) return;
  try { storage.removeItem(SIGNER_CONNECTION_STORAGE_KEY); } catch { /* best-effort */ }
}

function _setState(next: SignerConnectionState): void {
  _state = next;
  for (const cb of _listeners) {
    try { cb({ ...next }); } catch { /* ignore listener errors */ }
  }
}

/**
 * Build a Signer-compatible adapter over the NIP-07 browser-extension signer.
 * Forwards all available methods and returns null/undefined for unavailable ones.
 */
function buildNip07Adapter(nostr: Nip07Signer): Signer {
  const adapter: Signer = {
    getPublicKey: () => nostr.getPublicKey(),
    signEvent: async (event) => {
      const result = await nostr.signEvent(event as Record<string, unknown>);
      return result as Awaited<ReturnType<NonNullable<Signer['signEvent']>>>;
    },
  };

  if (typeof nostr.getRelays === 'function') {
    adapter.getRelays = () => nostr.getRelays!();
  }

  if (nostr.nip04) {
    adapter.nip04 = {
      encrypt: (pubkey, plaintext) => nostr.nip04!.encrypt(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => nostr.nip04!.decrypt(pubkey, ciphertext),
    };
  }

  if (nostr.nip44) {
    adapter.nip44 = {
      encrypt: (pubkey, plaintext) => nostr.nip44!.encrypt(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => nostr.nip44!.decrypt(pubkey, ciphertext),
    };
  }

  return adapter;
}

function getNip07ExtensionSigner(): Nip07Signer | undefined {
  const globalSigner = (globalThis as typeof globalThis & { nostr?: unknown }).nostr;
  const windowSigner = (globalThis as typeof globalThis & { window?: { nostr?: unknown } }).window?.nostr;
  return (globalSigner ?? windowSigner) as Nip07Signer | undefined;
}

/**
 * Get a shallow copy of the current signer connection state.
 */
export function getSignerConnectionState(): SignerConnectionState {
  return { ..._state, recentRequests: [..._state.recentRequests] };
}

/**
 * Get the active signer, or null if no signer is connected.
 * Suitable for passing directly to createSignerService({ getSigner }).
 */
export function getSigner(): Signer | null {
  return _activeSigner;
}

export function recordSignerRequest(record: SignerRequestRecord): void {
  const maxRecent = demoConfig.get('demo.MAX_RECENT_REQUESTS');
  const requests = [..._state.recentRequests, record];
  if (requests.length > maxRecent) {
    requests.splice(0, requests.length - maxRecent);
  }
  _setState({ ..._state, recentRequests: requests });
}

/**
 * Connect to a NIP-07 browser extension signer.
 * Sets isConnecting, retrieves the pubkey, and stores the adapter.
 * On failure, sets the error field and clears isConnecting.
 */
export async function connectNip07(options: { persist?: boolean } = {}): Promise<void> {
  // Read the NIP-07 extension signer from globalThis (standard NIP-07 discovery).
  // This is NOT `window.nostr` exposed to napplets — the extension injects it
  // and the shell host reads it here to build an internal Signer adapter.
  // Per D-01/D-02: napplets never see `window.nostr`; signing flows through
  // identity.getPublicKey + relay.publish envelopes (17-03 rewires).
  const extensionSigner = getNip07ExtensionSigner();
  if (!extensionSigner || typeof extensionSigner.getPublicKey !== 'function') {
    _setState({ ..._state, error: 'No NIP-07 extension detected', isConnecting: false });
    return;
  }
  _setState({ ..._state, isConnecting: true, error: null });
  try {
    const pubkey = await extensionSigner.getPublicKey();
    _activeSigner = buildNip07Adapter(extensionSigner);
    if (options.persist !== false) {
      writePersistedSignerConnection({ version: 1, method: 'nip07', pubkey });
    }
    _setState({
      ..._state,
      method: 'nip07',
      pubkey,
      relay: null,
      isConnecting: false,
      error: null,
    });
  } catch (err) {
    _activeSigner = null;
    _setState({
      ..._state,
      isConnecting: false,
      error: `Connection failed: ${(err as Error).message ?? 'unknown error'}`,
    });
  }
}

/**
 * Disconnect the active signer and reset connection state.
 * Calls close() on any NIP-46 client if one is active.
 */
export function disconnectSigner(): void {
  // NIP-46 client cleanup is handled by connectNip46 below (module-level ref)
  _cleanupNip46();
  clearPersistedSignerConnection();
  _activeSigner = null;
  _setState({ ..._initialState, recentRequests: [] });
}

/**
 * Subscribe to signer connection state changes.
 * The callback receives a shallow copy of the new state.
 * Returns an unsubscribe function.
 */
export function onStateChange(cb: (state: SignerConnectionState) => void): () => void {
  _listeners.push(cb);
  return () => {
    const i = _listeners.indexOf(cb);
    if (i !== -1) _listeners.splice(i, 1);
  };
}

export interface Nip46ConnectOptions {
  relayUrl: string;
  bunkerPubkey: string;
  secret?: string;
  localSecretKey?: Nip46LocalSecretKey;
}

/** Module-level NIP-46 client ref for cleanup in disconnectSigner(). */
let _nip46Client: { close(): void } | null = null;

function _cleanupNip46(): void {
  if (_nip46Client) {
    try { _nip46Client.close(); } catch { /* best-effort */ }
    _nip46Client = null;
  }
}

/**
 * Connect to a NIP-46 bunker.
 * Creates a NIP-46 client, performs the connect handshake, and wires
 * the resulting signer into the active signer ref.
 */
async function connectNip46Internal(options: Nip46ConnectOptions, persist: boolean): Promise<void> {
  const { createNip46Client, createNip46LocalSecretKey } = await import('./nip46-client.js');

  _cleanupNip46();
  _setState({ ..._state, isConnecting: true, error: null });

  try {
    const localSecretKey = options.localSecretKey ?? createNip46LocalSecretKey();
    const client = createNip46Client({
      relayUrl: options.relayUrl,
      bunkerPubkey: options.bunkerPubkey,
      secret: options.secret,
      localSecretKey,
    });

    const pubkey = await client.connect();

    _nip46Client = client;
    _activeSigner = client.getSigner();
    if (persist) {
      writePersistedSignerConnection({
        version: 1,
        method: 'nip46',
        pubkey,
        relayUrl: options.relayUrl,
        bunkerPubkey: options.bunkerPubkey,
        secret: options.secret,
        localSecretKey: bytesToHex(localSecretKey),
      });
    }
    _setState({
      ..._state,
      method: 'nip46',
      pubkey,
      relay: options.relayUrl,
      isConnecting: false,
      error: null,
    });
  } catch (err) {
    _activeSigner = null;
    _nip46Client = null;
    _setState({
      ..._state,
      isConnecting: false,
      error: `NIP-46 connection failed: ${(err as Error).message ?? 'unknown error'}`,
    });
  }
}

/**
 * Connect to a NIP-46 bunker.
 * Creates a NIP-46 client, performs the connect handshake, and wires
 * the resulting signer into the active signer ref.
 */
export async function connectNip46(options: Nip46ConnectOptions): Promise<void> {
  await connectNip46Internal(options, true);
}

export async function restorePersistedSignerConnection(): Promise<boolean> {
  if (_activeSigner || _state.isConnecting) return _activeSigner !== null;

  const persisted = readPersistedSignerConnection();
  if (!persisted) return false;

  if (persisted.method === 'nip07') {
    await connectNip07();
    return _state.method === 'nip07' && _state.pubkey !== null && !_state.error;
  }

  const localSecretKey = hexToBytes(persisted.localSecretKey);
  if (!localSecretKey) {
    clearPersistedSignerConnection();
    _setState({
      ..._state,
      isConnecting: false,
      error: 'Stored NIP-46 requester key is invalid',
    });
    return false;
  }

  await connectNip46Internal({
    relayUrl: persisted.relayUrl,
    bunkerPubkey: persisted.bunkerPubkey,
    secret: persisted.secret,
    localSecretKey,
  }, true);
  return _state.method === 'nip46' && _state.pubkey !== null && !_state.error;
}

export interface SignerInspectorDetail {
  method: SignerConnectionMethod;
  pubkey: string | null;
  relay: string | null;
  recentRequests: SignerRequestRecord[];
  isConnecting: boolean;
  error: string | null;
}

/**
 * Get full signer state for the inspector panel.
 * Includes the complete recentRequests history (up to 20 records).
 */
export function getSignerInspectorDetail(): SignerInspectorDetail {
  return { ...getSignerConnectionState() };
}
