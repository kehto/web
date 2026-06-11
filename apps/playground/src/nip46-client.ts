
import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
} from 'nostr-tools/pure';
import { nip04 } from 'nostr-tools';
import type { Signer } from '@kehto/runtime';

export interface Nip46ClientOptions {
  relayUrl: string;
  bunkerPubkey: string;
  secret?: string;
  localSecretKey?: Nip46LocalSecretKey;
  timeout?: number; // ms, default 30000
}

export type Nip46LocalSecretKey = Uint8Array;

export interface Nip46Client {
  /** Connect to the bunker and complete handshake. Returns the authorized pubkey. */
  connect(): Promise<string>;
  /** Returns a Signer-compatible adapter over the bunker connection. */
  getSigner(): Signer;
  /** Close the WebSocket and clean up. */
  close(): void;
}

/**
 * Parse a bunker:// URI into its components.
 *
 * Handles:
 * - `bunker://<pubkey>?relay=<url>&secret=<token>`
 * - `nostrconnect://<pubkey>?relay=<url>` (outbound QR form)
 *
 * @returns null for invalid or unparseable URIs
 */
export function parseBunkerUri(uri: string): { pubkey: string; relay: string; secret?: string } | null {
  if (!uri || typeof uri !== 'string') return null;

  let scheme: string;
  let rest: string;

  if (uri.startsWith('bunker://')) {
    scheme = 'bunker';
    rest = uri.slice('bunker://'.length);
  } else if (uri.startsWith('nostrconnect://')) {
    scheme = 'nostrconnect';
    rest = uri.slice('nostrconnect://'.length);
  } else {
    return null;
  }

  const questionMark = rest.indexOf('?');
  const pubkey = questionMark !== -1 ? rest.slice(0, questionMark) : rest;
  const queryString = questionMark !== -1 ? rest.slice(questionMark + 1) : '';

  if (!pubkey || pubkey.length !== 64 || !/^[0-9a-f]+$/.test(pubkey)) {
    return null;
  }

  const params = new URLSearchParams(queryString);
  const relay = params.get('relay');
  if (!relay) return null;

  const secret = params.get('secret') ?? undefined;
  void scheme; // scheme is validated implicitly by the prefix checks above
  return { pubkey, relay, secret };
}

/**
 * Build a nostrconnect:// URI for QR code display.
 * The remote bunker app scans this to initiate the connection.
 */
export function buildNostrConnectUri(relayUrl: string, localPubkey: string): string {
  const params = new URLSearchParams({ relay: relayUrl });
  return `nostrconnect://${localPubkey}?${params.toString()}`;
}

interface PendingNip46Request {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Nip46ClientState {
  relayUrl: string;
  bunkerPubkey: string;
  timeout: number;
  localSecretKey: Nip46LocalSecretKey;
  localPubkey: string;
  pending: Map<string, PendingNip46Request>;
  subId: string;
  ws: WebSocket | null;
  authorizedPubkey: string | null;
}

export function createNip46LocalSecretKey(): Nip46LocalSecretKey {
  return generateSecretKey();
}

function normalizeLocalSecretKey(secretKey: Nip46LocalSecretKey): Nip46LocalSecretKey {
  if (secretKey.length !== 32) {
    throw new Error('NIP-46 local secret key must be 32 bytes');
  }
  return new Uint8Array(secretKey);
}

function createNip46ClientState(options: Nip46ClientOptions): Nip46ClientState {
  const localSecretKey = normalizeLocalSecretKey(options.localSecretKey ?? createNip46LocalSecretKey());
  const localPubkey = getPublicKey(localSecretKey);
  return {
    relayUrl: options.relayUrl,
    bunkerPubkey: options.bunkerPubkey,
    timeout: options.timeout ?? 30000,
    localSecretKey,
    localPubkey,
    pending: new Map<string, PendingNip46Request>(),
    subId: `nip46-${localPubkey.substring(0, 8)}`,
    ws: null,
    authorizedPubkey: null,
  };
}

function cleanupNip46State(state: Nip46ClientState): void {
  for (const entry of state.pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error('NIP-46 client closed'));
  }
  state.pending.clear();
  if (state.ws && state.ws.readyState !== WebSocket.CLOSED) {
    state.ws.close();
  }
  state.ws = null;
}

async function sendRequestWithId(
  state: Nip46ClientState,
  correlationId: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    throw new Error('NIP-46 WebSocket not open');
  }

  const payload = JSON.stringify({ id: correlationId, method, params });
  const encryptedContent = await nip04.encrypt(state.localSecretKey, state.bunkerPubkey, payload);
  const eventTemplate = {
    kind: 24133,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', state.bunkerPubkey]],
    content: encryptedContent,
    pubkey: state.localPubkey,
  };
  const signedEvent = finalizeEvent(eventTemplate, state.localSecretKey);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(correlationId);
      reject(new Error(`NIP-46 request timed out: ${method}`));
    }, state.timeout);

    state.pending.set(correlationId, { resolve, reject, timer });
    state.ws!.send(JSON.stringify(['EVENT', signedEvent]));
  });
}

async function handleRelayMessage(state: Nip46ClientState, data: string): Promise<void> {
  let msg: unknown[];
  try {
    msg = JSON.parse(data) as unknown[];
  } catch {
    return;
  }

  if (!Array.isArray(msg) || msg[0] !== 'EVENT') return;
  const event = msg[2] as Record<string, unknown> | undefined;
  if (!event || event.kind !== 24133) return;

  let response: { id: string; result?: unknown; error?: string };
  try {
    const decrypted = await nip04.decrypt(state.localSecretKey, state.bunkerPubkey, event.content as string);
    response = JSON.parse(decrypted) as { id: string; result?: unknown; error?: string };
  } catch {
    return;
  }

  const entry = state.pending.get(response.id);
  if (!entry) return;

  if (response.error) {
    entry.reject(new Error(response.error));
  } else {
    entry.resolve(response.result);
  }
}

function rejectPendingOnClose(state: Nip46ClientState): void {
  for (const entry of state.pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error('NIP-46 WebSocket closed unexpectedly'));
  }
  state.pending.clear();
}

function openWebSocket(state: Nip46ClientState): Promise<void> {
  return new Promise((resolve, reject) => {
    state.ws = new WebSocket(state.relayUrl);

    state.ws.onopen = () => {
      const subMsg = JSON.stringify([
        'REQ',
        state.subId,
        { kinds: [24133], '#p': [state.localPubkey] },
      ]);
      state.ws!.send(subMsg);
      resolve();
    };

    state.ws.onmessage = (event: MessageEvent) => {
      handleRelayMessage(state, event.data as string).catch(() => { /* ignore */ });
    };

    state.ws.onerror = () => {
      reject(new Error(`NIP-46 WebSocket connection failed: ${state.relayUrl}`));
    };

    state.ws.onclose = () => {
      rejectPendingOnClose(state);
    };
  });
}

function createNipEncryptionMethods(state: Nip46ClientState, prefix: 'nip04' | 'nip44'): NonNullable<Signer['nip04']> {
  return {
    encrypt: async (pubkey: string, plaintext: string): Promise<string> => {
      const corrId = crypto.randomUUID();
      const result = await sendRequestWithId(state, corrId, `${prefix}_encrypt`, [pubkey, plaintext]);
      return result as string;
    },
    decrypt: async (pubkey: string, ciphertext: string): Promise<string> => {
      const corrId = crypto.randomUUID();
      const result = await sendRequestWithId(state, corrId, `${prefix}_decrypt`, [pubkey, ciphertext]);
      return result as string;
    },
  };
}

async function connectNip46State(state: Nip46ClientState, secret?: string): Promise<string> {
  await openWebSocket(state);
  const connectParams: unknown[] = [state.bunkerPubkey, secret ?? ''];
  const result = await sendRequestWithId(state, crypto.randomUUID(), 'connect', connectParams);

  if (typeof result === 'string') {
    state.authorizedPubkey = result;
  } else if (result && typeof result === 'object' && 'pubkey' in result) {
    state.authorizedPubkey = (result as { pubkey: string }).pubkey;
  } else {
    const pkResult = await sendRequestWithId(state, crypto.randomUUID(), 'get_public_key', []);
    state.authorizedPubkey = pkResult as string;
  }

  return state.authorizedPubkey!;
}

function createNip46Signer(state: Nip46ClientState): Signer {
  return {
    getPublicKey: async (): Promise<string> => {
      if (state.authorizedPubkey) return state.authorizedPubkey;
      const result = await sendRequestWithId(state, crypto.randomUUID(), 'get_public_key', []);
      return result as string;
    },

    signEvent: async (event) => {
      const result = await sendRequestWithId(state, crypto.randomUUID(), 'sign_event', [JSON.stringify(event)]);
      if (typeof result === 'string') {
        return JSON.parse(result) as Awaited<ReturnType<NonNullable<Signer['signEvent']>>>;
      }
      return result as Awaited<ReturnType<NonNullable<Signer['signEvent']>>>;
    },

    nip04: createNipEncryptionMethods(state, 'nip04'),

    nip44: createNipEncryptionMethods(state, 'nip44'),
  };
}

/**
 * Create a NIP-46 requester client.
 *
 * @example
 * ```ts
 * const optionalConnectionToken = readConnectionToken();
 * const client = createNip46Client({
 *   relayUrl: 'wss://relay.nsec.app',
 *   bunkerPubkey: 'abc123...',
 *   secret: optionalConnectionToken,
 * });
 * const pubkey = await client.connect();
 * const signer = client.getSigner();
 * ```
 */
export function createNip46Client(options: Nip46ClientOptions): Nip46Client {
  const state = createNip46ClientState(options);

  return {
    async connect(): Promise<string> {
      return connectNip46State(state, options.secret);
    },

    getSigner(): Signer {
      return createNip46Signer(state);
    },

    close(): void {
      cleanupNip46State(state);
    },
  };
}
