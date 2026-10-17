/** Host-owned Paja service types and shared, side-effect-free setup helpers. */
import type { NostrEvent, NostrFilter } from '@napplet/core';
import type { SessionEntry, ShellAdapter } from '@kehto/shell';
import type { Signer } from '@kehto/runtime';
import { createRelayPoolOutboxRouter, type IntentCandidate, type IntentRequest } from '@kehto/services';
import type { CvmRelayPool, NostrEventLike, NostrFilterLike } from '@kehto/services/cvm-nostr-transport';
import type { Theme } from '@napplet/nap/theme/types';
import { verifyEvent } from 'nostr-tools/pure';
import type { PajaSignerMethod } from './browser-signers.js';
import type { PajaSimulation } from './simulation.js';
import type { PajaSignerRequestContext, PajaSignerSource } from './browser-signer-consent.js';
import { BrowserIntentController } from './browser-intent-controller.js';
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';
import { PAJA_DEV_SIGNER_PUBKEY, createPajaDevSigner } from './browser-dev-runtime.js';
import { isPajaRelayAllowed, type PajaRelayConfigRuntime } from './browser-relay-policy.js';
import { PAJA_LIVE_QUERY_WAIT_MS, createPajaOutboxRelayPool, createPajaRelayListLoader, getPajaRelayUrls, type PajaRelayBackend } from './browser-relay-runtime.js';

/** Confirmation request emitted before Paja signs, publishes, or uploads. */
export type PajaConfirmationRequest =
  | {
      readonly action: 'sign' | 'publish';
      readonly event: NostrEvent | Partial<NostrEvent>;
      readonly signerContext?: PajaSignerRequestContext;
    }
  | {
      readonly action: 'upload';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly filename?: string;
      readonly size: number;
      readonly mimeType?: string;
      readonly server: string;
      readonly warning: string;
    }
  | {
      readonly action: 'link';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly url: string;
      readonly label?: string;
    }
  | {
      readonly action: 'serial' | 'ble';
      readonly windowId: string;
      readonly label?: string;
      readonly details: string;
    }
  | {
      readonly action: 'notify';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly channel?: string;
    }
  | {
      readonly action: 'webrtc';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly scope: string;
      readonly warning: string;
    }
  | {
      readonly action: 'dm';
      readonly recipients: readonly string[];
      readonly content: string;
      readonly warning: string;
    }
  | {
      readonly action: 'fs';
      readonly windowId: string;
      readonly kind: 'file' | 'files' | 'directory' | 'save-file';
      readonly description: string;
    };

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
) => Pick<SessionEntry, 'dTag' | 'aggregateHash'>;

/** Paja shell adapter with private verified-pointer resource context wiring. */
export interface PajaShellAdapter extends ShellAdapter {
  /** Startup promise for asynchronous host probes. */
  readonly ready: Promise<void>;
  /** Bind verified runtime-pointer Blossom hints to one authenticated window. */
  setWindowBlossomServers(windowId: string, servers: readonly string[]): void;
}

export interface PajaIntentHost {
  readonly catalog: InstalledNappletCatalog;
  readonly controller: BrowserIntentController;
  /** Resolve an authenticated frame to its verified catalog identity. */
  resolveSender(windowId: string): string | undefined;
  getDefaultHandler?(archetype: string): string | undefined;
  chooseHandler?(
    archetype: string,
    candidates: IntentCandidate[],
    sender: string,
  ): string | undefined | Promise<string | undefined>;
  authorizeExplicitHandler?(
    sender: string,
    handler: string,
    request: IntentRequest,
    candidate: IntentCandidate,
    context?: import('@kehto/services').IntentResolverContext,
  ): boolean | Promise<boolean>;
  resolveHandlerHint?(
    hint: import('@kehto/services').IntentHandlerHint,
    candidates: readonly IntentCandidate[],
  ): string | undefined | Promise<string | undefined>;
}

export function createPajaCvmRelayPool(backend: PajaRelayBackend): CvmRelayPool {
  return {
    subscribe(relays: string[], filter: NostrFilterLike, params) {
      const subscription = backend.subscription(relays, [filter as NostrFilter]).subscribe((item) => {
        if (item === 'EOSE') params.oneose?.();
        else if (typeof item === 'object' && item !== null) params.onevent?.(item as NostrEventLike);
      });
      return {
        close() {
          subscription.unsubscribe();
        },
      };
    },
    async publish(relays: string[], event: NostrEventLike) {
      const outcomes = await backend.publishToRelays(relays, event as NostrEvent);
      if (!Object.values(outcomes).some(Boolean)) throw new Error('publish failed');
    },
  };
}

export function createOutboxRouter(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  relayConfig: PajaRelayConfigRuntime,
  confirmRequest: PajaConfirmationHandler,
  signerProvider?: PajaSignerProvider,
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
      const signer = createRuntimeSigner(getSimulation, confirmRequest, signerProvider);
      if (!signer?.getPublicKey) throw new Error('no signer configured');
      return signer.getPublicKey();
    },
    signEvent: async (template) => {
      const signer = createRuntimeSigner(getSimulation, confirmRequest, signerProvider);
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

export function getRuntimePubkey(
  getSimulation: () => PajaSimulation,
  signerProvider?: PajaSignerProvider,
): string {
  return signerProvider?.getPubkey()
    || (signerProvider?.getMethod() === 'dev' ? PAJA_DEV_SIGNER_PUBKEY : '')
    || getSimulation().identity.pubkey;
}

export function createRuntimeSigner(
  getSimulation: () => PajaSimulation,
  confirmRequest: PajaConfirmationHandler,
  signerProvider?: PajaSignerProvider,
  source?: PajaSignerSource,
): Signer | null {
  const signer = signerProvider?.getSigner(source);
  if (!signer) {
    if (signerProvider?.getMethod() === 'dev') {
      return createPajaDevSigner(getSimulation, confirmRequest, source);
    }
    const fixedPubkey = getSimulation().identity.pubkey;
    if (fixedPubkey) {
      return {
        getPublicKey: () => fixedPubkey,
        getRelays: () => Object.fromEntries(getPajaRelayUrls(getSimulation()).map((relay) => [relay, { read: true, write: true }])),
      };
    }
    return null;
  }
  return signer;
}

