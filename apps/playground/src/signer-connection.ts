
import type { Signer } from '@kehto/runtime';

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
export async function connectNip07(): Promise<void> {
  // Read the NIP-07 extension signer from globalThis (standard NIP-07 discovery).
  // This is NOT `window.nostr` exposed to napplets — the extension injects it
  // and the shell host reads it here to build an internal Signer adapter.
  // Per D-01/D-02: napplets never see `window.nostr`; signing flows through
  // identity.getPublicKey + relay.publish envelopes (17-03 rewires).
  const extensionSigner = (globalThis as typeof globalThis & { nostr?: unknown }).nostr as Nip07Signer | undefined;
  if (!extensionSigner || typeof extensionSigner.getPublicKey !== 'function') {
    _setState({ ..._state, error: 'No NIP-07 extension detected', isConnecting: false });
    return;
  }
  _setState({ ..._state, isConnecting: true, error: null });
  try {
    const pubkey = await extensionSigner.getPublicKey();
    _activeSigner = buildNip07Adapter(extensionSigner);
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
export async function connectNip46(options: Nip46ConnectOptions): Promise<void> {
  const { createNip46Client } = await import('./nip46-client.js');

  _cleanupNip46();
  _setState({ ..._state, isConnecting: true, error: null });

  try {
    const client = createNip46Client({
      relayUrl: options.relayUrl,
      bunkerPubkey: options.bunkerPubkey,
      secret: options.secret,
    });

    const pubkey = await client.connect();

    _nip46Client = client;
    _activeSigner = client.getSigner();
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
