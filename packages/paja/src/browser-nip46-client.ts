import type { Signer } from '@kehto/runtime';
import { nip04 } from 'nostr-tools';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';

export interface Nip46ClientOptions {
  relayUrl: string;
  bunkerPubkey: string;
  secret?: string;
  localSecretKey?: Uint8Array;
  timeout?: number;
}

export interface Nip46Client {
  connect(): Promise<string>;
  getSigner(): Signer;
  close(): void;
}

export function parseBunkerUri(uri: string): { pubkey: string; relay: string; secret?: string } | null {
  if (!uri || typeof uri !== 'string') return null;

  let rest: string;
  if (uri.startsWith('bunker://')) {
    rest = uri.slice('bunker://'.length);
  } else if (uri.startsWith('nostrconnect://')) {
    rest = uri.slice('nostrconnect://'.length);
  } else {
    return null;
  }

  const questionMark = rest.indexOf('?');
  const pubkey = questionMark !== -1 ? rest.slice(0, questionMark) : rest;
  const queryString = questionMark !== -1 ? rest.slice(questionMark + 1) : '';
  if (!pubkey || pubkey.length !== 64 || !/^[0-9a-f]+$/u.test(pubkey)) return null;

  const params = new URLSearchParams(queryString);
  const relay = params.get('relay');
  if (!relay) return null;
  return { pubkey, relay, secret: params.get('secret') ?? undefined };
}

interface PendingNip46Request {
  resolve(value: unknown): void;
  reject(reason: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

interface Nip46ClientState {
  relayUrl: string;
  bunkerPubkey: string;
  timeout: number;
  localSecretKey: Uint8Array;
  localPubkey: string;
  pending: Map<string, PendingNip46Request>;
  subId: string;
  ws: WebSocket | null;
  authorizedPubkey: string | null;
}

function createNip46ClientState(options: Nip46ClientOptions): Nip46ClientState {
  const localSecretKey = normalizeLocalSecretKey(options.localSecretKey ?? generateSecretKey());
  const localPubkey = getPublicKey(localSecretKey);
  return {
    relayUrl: options.relayUrl,
    bunkerPubkey: options.bunkerPubkey,
    timeout: options.timeout ?? 30_000,
    localSecretKey,
    localPubkey,
    pending: new Map(),
    subId: `paja-nip46-${localPubkey.substring(0, 8)}`,
    ws: null,
    authorizedPubkey: null,
  };
}

function normalizeLocalSecretKey(secretKey: Uint8Array): Uint8Array {
  if (secretKey.length !== 32) {
    throw new Error('NIP-46 local secret key must be 32 bytes');
  }
  return new Uint8Array(secretKey);
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
  const signedEvent = finalizeEvent({
    kind: 24_133,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', state.bunkerPubkey]],
    content: encryptedContent,
  }, state.localSecretKey);

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
  let msg: unknown;
  try {
    msg = JSON.parse(data) as unknown;
  } catch {
    return;
  }

  if (!Array.isArray(msg) || msg[0] !== 'EVENT') return;
  const event = msg[2] as Record<string, unknown> | undefined;
  if (!event || event.kind !== 24_133 || typeof event.content !== 'string') return;

  let response: { id: string; result?: unknown; error?: string };
  try {
    const decrypted = await nip04.decrypt(state.localSecretKey, state.bunkerPubkey, event.content);
    response = JSON.parse(decrypted) as { id: string; result?: unknown; error?: string };
  } catch {
    return;
  }

  const entry = state.pending.get(response.id);
  if (!entry) return;
  clearTimeout(entry.timer);
  state.pending.delete(response.id);

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
      state.ws!.send(JSON.stringify([
        'REQ',
        state.subId,
        { kinds: [24_133], '#p': [state.localPubkey] },
      ]));
      resolve();
    };

    state.ws.onmessage = (event: MessageEvent) => {
      handleRelayMessage(state, event.data as string).catch(() => {});
    };
    state.ws.onerror = () => reject(new Error(`NIP-46 WebSocket connection failed: ${state.relayUrl}`));
    state.ws.onclose = () => rejectPendingOnClose(state);
  });
}

function createNipEncryptionMethods(state: Nip46ClientState, prefix: 'nip04' | 'nip44'): NonNullable<Signer['nip04']> {
  return {
    encrypt: async (pubkey, plaintext) => sendRequestWithId(state, crypto.randomUUID(), `${prefix}_encrypt`, [pubkey, plaintext]) as Promise<string>,
    decrypt: async (pubkey, ciphertext) => sendRequestWithId(state, crypto.randomUUID(), `${prefix}_decrypt`, [pubkey, ciphertext]) as Promise<string>,
  };
}

async function connectNip46State(state: Nip46ClientState, secret?: string): Promise<string> {
  await openWebSocket(state);
  const result = await sendRequestWithId(state, crypto.randomUUID(), 'connect', [state.bunkerPubkey, secret ?? '']);

  if (typeof result === 'string') {
    state.authorizedPubkey = result;
  } else if (result && typeof result === 'object' && 'pubkey' in result) {
    state.authorizedPubkey = (result as { pubkey: string }).pubkey;
  } else {
    const pkResult = await sendRequestWithId(state, crypto.randomUUID(), 'get_public_key', []);
    state.authorizedPubkey = pkResult as string;
  }

  return state.authorizedPubkey;
}

function createNip46Signer(state: Nip46ClientState): Signer {
  return {
    getPublicKey: async () => {
      if (state.authorizedPubkey) return state.authorizedPubkey;
      return sendRequestWithId(state, crypto.randomUUID(), 'get_public_key', []) as Promise<string>;
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

export function createNip46Client(options: Nip46ClientOptions): Nip46Client {
  const state = createNip46ClientState(options);
  return {
    connect: () => connectNip46State(state, options.secret),
    getSigner: () => createNip46Signer(state),
    close: () => cleanupNip46State(state),
  };
}
