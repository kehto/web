import type { NostrEvent } from '@napplet/core';
import type { Signer } from '@kehto/runtime';

import type { PajaConfirmationRequest } from './browser-adapter.js';
import {
  createNip46Client,
  parseBunkerUri,
  type Nip46Client,
} from './browser-nip46-client.js';

export type PajaSignerMethod = 'dev' | 'nip07' | 'nip46';
export type PajaSignerStatus = 'connected' | 'connecting' | 'error';

export interface PajaSignerState {
  method: PajaSignerMethod;
  status: PajaSignerStatus;
  pubkey: string | null;
  relay: string | null;
  error: string | null;
}

export interface PajaSignerController {
  getState(): PajaSignerState;
  getSigner(): Signer | null;
  getPubkey(): string | null;
  useDevSigner(): void;
  connectNip07(): Promise<void>;
  connectBunker(uri: string): Promise<void>;
}

interface Nip07Signer {
  getPublicKey?: () => string | Promise<string>;
  signEvent?: (event: NostrEvent | Record<string, unknown>) => Promise<NostrEvent>;
  getRelays?: () => Record<string, { read: boolean; write: boolean }> | Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: Signer['nip04'];
  nip44?: Signer['nip44'];
}

interface PajaSignerControllerOptions {
  confirmRequest(request: PajaConfirmationRequest): boolean;
  onChange(state: PajaSignerState): void;
}

function cloneState(state: PajaSignerState): PajaSignerState {
  return { ...state };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readNip07Signer(): Nip07Signer | null {
  const candidate = (globalThis as { nostr?: unknown }).nostr;
  if (!candidate || typeof candidate !== 'object') return null;
  const signer = candidate as Nip07Signer;
  if (typeof signer.getPublicKey !== 'function' || typeof signer.signEvent !== 'function') return null;
  return signer;
}

function createConfirmedSigner(
  signer: Signer,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
): Signer {
  return {
    ...signer,
    async signEvent(event) {
      if (typeof signer.signEvent !== 'function') {
        throw new Error('Signer does not support event signing');
      }
      if (!confirmRequest({ action: 'sign', event })) {
        throw new Error('Paja signing request denied');
      }
      return signer.signEvent(event);
    },
  };
}

function createNip07Adapter(signer: Nip07Signer): Signer {
  return {
    getPublicKey: signer.getPublicKey?.bind(signer),
    signEvent: signer.signEvent?.bind(signer) as Signer['signEvent'],
    getRelays: signer.getRelays?.bind(signer),
    nip04: signer.nip04,
    nip44: signer.nip44,
  };
}

export function createPajaSignerController(options: PajaSignerControllerOptions): PajaSignerController {
  let state: PajaSignerState = {
    method: 'dev',
    status: 'connected',
    pubkey: null,
    relay: null,
    error: null,
  };
  let activeSigner: Signer | null = null;
  let activeClient: Nip46Client | null = null;

  const update = (next: Partial<PajaSignerState>) => {
    state = { ...state, ...next };
    options.onChange(cloneState(state));
  };

  const closeClient = () => {
    activeClient?.close();
    activeClient = null;
  };

  return {
    getState: () => cloneState(state),
    getSigner: () => activeSigner,
    getPubkey: () => state.pubkey,
    useDevSigner() {
      closeClient();
      activeSigner = null;
      update({
        method: 'dev',
        status: 'connected',
        pubkey: null,
        relay: null,
        error: null,
      });
    },
    async connectNip07() {
      closeClient();
      activeSigner = null;
      update({ method: 'nip07', status: 'connecting', pubkey: null, relay: null, error: null });
      try {
        const signer = readNip07Signer();
        if (!signer) throw new Error('NIP-07 signer not found');
        const pubkey = await signer.getPublicKey!();
        activeSigner = createConfirmedSigner(createNip07Adapter(signer), options.confirmRequest);
        update({ method: 'nip07', status: 'connected', pubkey, relay: null, error: null });
      } catch (error) {
        activeSigner = null;
        update({ method: 'nip07', status: 'error', pubkey: null, relay: null, error: toErrorMessage(error) });
      }
    },
    async connectBunker(uri: string) {
      closeClient();
      activeSigner = null;
      const parsed = parseBunkerUri(uri.trim());
      if (!parsed) {
        update({
          method: 'nip46',
          status: 'error',
          pubkey: null,
          relay: null,
          error: 'Enter a bunker:// or nostrconnect:// URI with a relay parameter',
        });
        return;
      }

      update({ method: 'nip46', status: 'connecting', pubkey: null, relay: parsed.relay, error: null });
      try {
        const client = createNip46Client({
          relayUrl: parsed.relay,
          bunkerPubkey: parsed.pubkey,
          secret: parsed.secret,
        });
        const pubkey = await client.connect();
        activeClient = client;
        activeSigner = createConfirmedSigner(client.getSigner(), options.confirmRequest);
        update({ method: 'nip46', status: 'connected', pubkey, relay: parsed.relay, error: null });
      } catch (error) {
        closeClient();
        activeSigner = null;
        update({ method: 'nip46', status: 'error', pubkey: null, relay: parsed.relay, error: toErrorMessage(error) });
      }
    },
  };
}
