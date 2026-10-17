import type { NostrEvent } from '@napplet/core';
import type { Signer } from '@kehto/runtime';

import type { PajaConfirmationHandler } from './browser-adapter.js';
import {
  parsePajaIdentityInput,
  readPajaViewOnlyPubkey,
  writePajaViewOnlyPubkey,
  type PajaPreferenceStorage,
} from './browser-identity-input.js';
import type {
  PajaSignerRequestContext,
  PajaSignerSource,
} from './browser-signer-consent.js';
import {
  createNip46Client,
  parseBunkerUri,
  type Nip46Client,
} from './browser-nip46-client.js';

/** Signer backend selected in the Paja browser UI. */
export type PajaSignerMethod = 'none' | 'dev' | 'nip07' | 'nip46' | 'viewonly';
/** Connection state for the selected Paja signer backend. */
export type PajaSignerStatus = 'disconnected' | 'connected' | 'connecting' | 'error';

/** Current signer connection state shown by Paja. */
export interface PajaSignerState {
  /** Active signer backend. */
  method: PajaSignerMethod;
  /** Backend connection status. */
  status: PajaSignerStatus;
  /** Connected signer pubkey, when available. */
  pubkey: string | null;
  /** Relay URL for NIP-46 signers, when available. */
  relay: string | null;
  /** Last connection error message, when any. */
  error: string | null;
}

/** Browser signer controller. */
export interface PajaSignerController {
  /** Return a copy of current signer state. */
  getState(): PajaSignerState;
  /** Return the active runtime signer, if one is connected. */
  getSigner(source?: PajaSignerSource): Signer | null;
  /** Return the selected signer backend. */
  getMethod(): PajaSignerMethod;
  /** Return the active signer pubkey, if one is connected. */
  getPubkey(): string | null;
  /** Observe signer connection and identity changes. */
  subscribe(listener: () => void): () => void;
  /** Switch to the deterministic development signer. */
  useDevSigner(): void;
  /** Connect to `window.nostr` when a NIP-07 signer is available. */
  connectNip07(): Promise<void>;
  /** Connect to a NIP-46 bunker signer URI. */
  connectBunker(uri: string): Promise<void>;
  /**
   * Switch to a view-only identity. Reading works; signing and encryption do not.
   * A persisted view-only identity survives host reloads per browser origin.
   */
  useViewOnlySigner(input: string): void;
  /** Disconnect every identity and clear the persisted view-only identity. */
  disconnect(): void;
}

interface Nip07Signer {
  getPublicKey?: () => string | Promise<string>;
  signEvent?: (event: NostrEvent | Record<string, unknown>) => Promise<NostrEvent>;
  getRelays?: () => Record<string, { read: boolean; write: boolean }> | Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: Signer['nip04'];
  nip44?: Signer['nip44'];
}

interface PajaSignerControllerOptions {
  confirmRequest: PajaConfirmationHandler;
  onChange(state: PajaSignerState): void;
  /** Host relays reported for a view-only identity that carries no relay hints. */
  getRelays?: () => Record<string, { read: boolean; write: boolean }>;
  /** Preference store for the persisted view-only identity. */
  storage?: PajaPreferenceStorage | null;
}

/**
 * Read the browser's local storage without assuming it exists.
 *
 * @returns The origin's localStorage, or null in non-browser or blocked contexts.
 */
function defaultStorage(): PajaPreferenceStorage | null {
  try {
    return (globalThis as { localStorage?: PajaPreferenceStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Require a signer that can actually produce signatures.
 *
 * @param signer - The runtime signer selected for the window.
 * @returns The same signer, narrowed to one with `signEvent`.
 * @throws When no signer is connected, or when the connected identity is
 *   read-only (for example a view-only npub).
 * @example
 * ```ts
 * const signer = requireWritableSigner(runtimeSigner);
 * await signer.signEvent(template);
 * ```
 */
export function requireWritableSigner(
  signer: Signer | null,
): Signer & Required<Pick<Signer, 'signEvent'>> {
  if (!signer) throw new Error('no signer configured');
  if (!signer.signEvent) throw new Error('signing unavailable (read-only identity)');
  return signer as Signer & Required<Pick<Signer, 'signEvent'>>;
}

/**
 * Build a signer that can read an identity but can never act as it.
 *
 * `signEvent`, `nip04`, and `nip44` are deliberately absent: the runtime,
 * Paja's outbox router, DM advertisement, WebRTC advertisement, and Blossom
 * upload all gate on the presence of the method they need, so a view-only
 * identity fails closed instead of prompting for consent it cannot fulfil.
 *
 * @param pubkey - Hex pubkey of the view-only identity.
 * @param relays - Relay hints from an `nprofile`, or the host relays.
 * @returns Signer exposing only public information.
 */
function createViewOnlySigner(
  pubkey: string,
  relays: Record<string, { read: boolean; write: boolean }>,
): Signer {
  return {
    getPublicKey: () => pubkey,
    getRelays: () => relays,
  };
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
  confirmRequest: PajaConfirmationHandler,
  source?: PajaSignerSource,
): Signer {
  const confirmed: Signer = { ...signer };
  // A read-only identity keeps its missing `signEvent`: callers must see the
  // capability gap, not a wrapper that throws inside the signing path.
  if (typeof signer.signEvent !== 'function') return confirmed;
  const signEvent = signer.signEvent.bind(signer);
  confirmed.signEvent = async (event) => {
    const signerContext = await resolveSignerContext(signer, source);
    if (!await confirmRequest({
      action: 'sign',
      event,
      ...(signerContext ? { signerContext } : {}),
    })) {
      throw new Error('Paja signing request denied');
    }
    return signEvent(event);
  };
  return confirmed;
}

async function resolveSignerContext(
  signer: Signer,
  source?: PajaSignerSource,
): Promise<PajaSignerRequestContext | undefined> {
  if (!source || typeof signer.getPublicKey !== 'function') return undefined;
  try {
    const signerPubkey = await signer.getPublicKey();
    if (!/^[0-9a-f]{64}$/i.test(signerPubkey)) return undefined;
    return { ...source, signerPubkey };
  } catch {
    return undefined;
  }
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

/**
 * Create a browser signer controller for Paja's signer controls.
 *
 * @param options - Confirmation, state-change, relay, and storage dependencies.
 * @returns Signer controller for dev, NIP-07, NIP-46, and view-only modes.
 */
export function createPajaSignerController(options: PajaSignerControllerOptions): PajaSignerController {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const hostRelays = options.getRelays ?? (() => ({}));
  const storedViewOnlyPubkey = readPajaViewOnlyPubkey(storage);
  let state: PajaSignerState = storedViewOnlyPubkey
    ? {
        method: 'viewonly',
        status: 'connected',
        pubkey: storedViewOnlyPubkey,
        relay: null,
        error: null,
      }
    : {
        method: 'none',
        status: 'disconnected',
        pubkey: null,
        relay: null,
        error: null,
      };
  // A persisted view-only identity is restored before any host probe runs, so
  // an explicit choice outlives a reload even when a NIP-07 extension exists.
  let activeSigner: Signer | null = storedViewOnlyPubkey
    ? createViewOnlySigner(storedViewOnlyPubkey, hostRelays())
    : null;
  let activeClient: Nip46Client | null = null;
  const listeners = new Set<() => void>();

  const update = (next: Partial<PajaSignerState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
    options.onChange(cloneState(state));
  };

  const closeClient = () => {
    activeClient?.close();
    activeClient = null;
  };

  const viewOnlyRelays = (hints: readonly string[]): Record<string, { read: boolean; write: boolean }> => {
    if (hints.length === 0) return hostRelays();
    return Object.fromEntries(hints.map((relay) => [relay, { read: true, write: true }]));
  };

  // Every explicit identity choice other than view-only supersedes the saved
  // view-only npub, so switching or logging out cannot resurrect it on reload.
  const resetSigner = (next: PajaSignerState): void => {
    closeClient();
    activeSigner = null;
    writePajaViewOnlyPubkey(storage, null);
    update(next);
  };

  return {
    getState: () => cloneState(state),
    getSigner(source) {
      if (!activeSigner) return null;
      return createConfirmedSigner(activeSigner, options.confirmRequest, source);
    },
    getMethod: () => state.method,
    getPubkey: () => state.pubkey,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    useDevSigner() {
      resetSigner({
        method: 'dev',
        status: 'connected',
        pubkey: null,
        relay: null,
        error: null,
      });
    },
    useViewOnlySigner(input: string) {
      closeClient();
      activeSigner = null;
      const parsed = parsePajaIdentityInput(input);
      if (!parsed.ok) {
        // The last valid persisted identity is kept: a rejected paste must not
        // silently drop an identity the author can still fall back to.
        update({
          method: 'viewonly',
          status: 'error',
          pubkey: null,
          relay: null,
          error: parsed.error,
        });
        return;
      }
      activeSigner = createViewOnlySigner(parsed.pubkey, viewOnlyRelays(parsed.relays));
      writePajaViewOnlyPubkey(storage, parsed.pubkey);
      update({
        method: 'viewonly',
        status: 'connected',
        pubkey: parsed.pubkey,
        relay: null,
        error: null,
      });
    },
    disconnect() {
      resetSigner({
        method: 'none',
        status: 'disconnected',
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
        activeSigner = createNip07Adapter(signer);
        writePajaViewOnlyPubkey(storage, null);
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
        activeSigner = client.getSigner();
        writePajaViewOnlyPubkey(storage, null);
        update({ method: 'nip46', status: 'connected', pubkey, relay: parsed.relay, error: null });
      } catch (error) {
        closeClient();
        activeSigner = null;
        update({ method: 'nip46', status: 'error', pubkey: null, relay: parsed.relay, error: toErrorMessage(error) });
      }
    },
  };
}
