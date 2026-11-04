/** Host-owned Paja service types and shared, side-effect-free setup helpers. */
import type { SessionEntry, ShellAdapter } from '@kehto/shell';
import type { Signer } from '@kehto/runtime';
import { createRelayPoolOutboxRouter } from '@kehto/services';
import type { Theme } from '@napplet/nap/theme/types';
import { verifyEvent } from 'nostr-tools/pure';
import type { PajaSignerMethod } from './browser-signers.js';
import type { PajaSimulation } from './simulation.js';
import type { PajaSignerSource } from './browser-signer-consent.js';
import { createRuntimeSigner } from './browser-operation-scope.js';
import { isPajaRelayAllowed, type PajaRelayConfigRuntime } from './browser-relay-policy.js';
import { PAJA_LIVE_QUERY_WAIT_MS, createPajaOutboxRelayPool, createPajaRelayListLoader, type PajaRelayBackend } from './browser-relay-runtime.js';

export type { PajaConfirmationRequest } from './browser-confirmation-request.js';
import type { PajaConfirmationRequest } from './browser-confirmation-request.js';

/** Async-capable host policy callback for user-visible Paja operations. */
export type PajaConfirmationHandler = (
  request: PajaConfirmationRequest,
) => boolean | Promise<boolean>;

/** Paja runtime signer provider. */
export interface PajaSignerProvider {
  /** Active signer, if connected. */
  getSigner(source?: PajaSignerSource): Signer | null;
  /** Selected signer backend. */
  getMethod(): PajaSignerMethod;
  /** Active signer pubkey, if connected. */
  getPubkey(): string | null;
  /** Observe signer identity lifecycle changes. */
  subscribe?(listener: () => void): () => void;
}

/** Identity provider for Paja's simulated target identity. */
export type PajaIdentityProvider = (
  windowId?: string,
) => Pick<SessionEntry, 'dTag' | 'aggregateHash'> & {
  readonly consentScope?: string;
  readonly isCurrent?: () => boolean;
};

/** Paja shell adapter with private verified-pointer resource context wiring. */
export interface PajaShellAdapter extends ShellAdapter {
  /** Startup promise for asynchronous host probes. */
  readonly ready: Promise<void>;
  /** Bind verified runtime-pointer Blossom hints to one authenticated window. */
  setWindowBlossomServers(windowId: string, servers: readonly string[]): void;
  /** Recompute intent availability after a host-owned default-handler update. */
  notifyIntentChanged(archetype: string): void;
}

export function createOutboxRouter(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  relayConfig: PajaRelayConfigRuntime,
  confirmRequest: PajaConfirmationHandler,
  signerProvider?: PajaSignerProvider,
  source?: PajaSignerSource,
) {
  return createRelayPoolOutboxRouter({
    relayPool: createPajaOutboxRelayPool(backend),
    loadRelayLists: createPajaRelayListLoader(
      backend,
      getSimulation,
      signerProvider,
      () => relayConfig.getRelayUrls(['discovery', 'super']),
    ),
    fallbackRelays: relayConfig.outboxRelays,
    getSignerPubkey: async () => {
      const signer = createRuntimeSigner(getSimulation, confirmRequest, signerProvider, source);
      if (!signer?.getPublicKey) throw new Error('no signer configured');
      return signer.getPublicKey();
    },
    signEvent: async (template) => {
      const signer = createRuntimeSigner(getSimulation, confirmRequest, signerProvider, source);
      if (!signer?.signEvent) throw new Error('no signer configured');
      const event = { ...template };
      event.created_at ??= Math.floor(Date.now() / 1000);
      event.kind ??= 1;
      event.tags ??= [];
      event.content ??= '';
      return signer.signEvent(event);
    },
    verifyEvent: (event) => verifyEvent(event as Parameters<typeof verifyEvent>[0]),
    isRelayAllowed: (url) => isPajaRelayAllowed(url, () => relayConfig.getRelayUrls()),
    defaultTimeoutMs: PAJA_LIVE_QUERY_WAIT_MS,
  });
}

/**
 * Create a theme object from Paja simulation settings.
 *
 * @param mode - Theme mode.
 * @param values - Extra theme values.
 * @returns Theme object exposed to the simulated runtime.
 */
export function createDevTheme(mode: PajaSimulation['theme']['mode'], values: PajaSimulation['theme']['values']): Theme {
  const defaultColors = mode === 'light'
    ? { background: '#f7f5ed', text: '#1d211d', primary: '#6a5a12' }
    : { background: '#101211', text: '#f4f0df', primary: '#d8c36a' };
  return {
    ...values,
    colors: {
      ...defaultColors,
      ...((typeof values.colors === 'object' && values.colors !== null && !Array.isArray(values.colors)) ? values.colors : {}),
    },
  } as Theme;
}
