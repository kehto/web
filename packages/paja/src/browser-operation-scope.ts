import type { CvmRelayPool, NostrEventLike, NostrFilterLike } from '@kehto/services/cvm-nostr-transport';
import type { PajaConfirmationHandler, PajaSignerProvider } from './browser-adapter.js';
import type { PajaSimulation } from './simulation.js';
import { PAJA_DEV_SIGNER_PUBKEY, createPajaDevSigner } from './browser-dev-runtime.js';
import { getPajaRelayUrls } from './browser-relay-runtime.js';
import type { NostrEvent, NostrFilter } from '@napplet/core';
import type { ServiceHandler, ServiceRuntimeContext, Signer } from '@kehto/runtime';
import type { PajaRelayBackend } from './browser-relay-runtime.js';
import type { PajaSignerRequestContext, PajaSignerSource } from './browser-signer-consent.js';

const documentId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

/** Mutable development URLs have consent only for this document and frame load. */
export function pajaDevelopmentConsentScope(url: string, windowId: string): string {
  return `target-url:${url}|load:${documentId}:${windowId}`;
}

/** Bind selected service operations to their authenticated window without ambient async state. */
export function scopePajaService(base: ServiceHandler, types: readonly string[],
  create: (windowId: string, isCurrent: () => boolean) => ServiceHandler,
  scopeKey?: (windowId: string) => string): ServiceHandler {
  const windows = new Map<string, { service: ServiceHandler; active: boolean; key?: string }>();
  let runtime: ServiceRuntimeContext | undefined;
  let attached = true;
  return {
    ...base,
    onRegistered(context) { runtime = context; attached = true; base.onRegistered?.(context); },
    handleMessage(windowId, message, send) {
      if (!attached) return;
      if (!types.includes(message.type)) return base.handleMessage(windowId, message, send);
      let entry = windows.get(windowId);
      const key = scopeKey?.(windowId);
      if (entry && entry.key !== key) {
        entry.active = false;
        entry.service.onWindowDestroyed?.(windowId);
        entry.service.onUnregistered?.();
        windows.delete(windowId);
        entry = undefined;
      }
      if (!entry) {
        const state = { active: true, key };
        const service = create(windowId, () => attached && state.active && (!runtime || runtime.listWindowIds().includes(windowId)));
        entry = Object.assign(state, { service });
        windows.set(windowId, entry);
        if (runtime) service.onRegistered?.(runtime);
      }
      entry.service.handleMessage(windowId, message, send);
    },
    onWindowDestroyed(windowId) {
      const entry = windows.get(windowId);
      if (entry) { entry.active = false; entry.service.onWindowDestroyed?.(windowId); entry.service.onUnregistered?.(); windows.delete(windowId); }
      base.onWindowDestroyed?.(windowId);
    },
    onCapabilityRevoked(windowId, capability) {
      const entry = windows.get(windowId);
      if (entry) {
        entry.active = false;
        entry.service.onCapabilityRevoked?.(windowId, capability);
        entry.service.onWindowDestroyed?.(windowId);
        entry.service.onUnregistered?.();
        windows.delete(windowId);
      }
      base.onCapabilityRevoked?.(windowId, capability);
    },
    onUnregistered() {
      attached = false;
      for (const [windowId, entry] of windows) {
        entry.active = false;
        entry.service.onWindowDestroyed?.(windowId);
        entry.service.onUnregistered?.();
      }
      windows.clear();
      base.onUnregistered?.();
    },
  };
}

/** Carry source identity to publication while retaining the shared relay transport. */
export function scopePajaRelayBackend(base: PajaRelayBackend, context: () => Promise<PajaSignerRequestContext | undefined>): PajaRelayBackend {
  const current = async () => {
    const value = await context();
    if (value?.isCurrent && !value.isCurrent()) throw new Error('Paja publication source changed');
    return value;
  };
  return {
    ...base,
    async publish(relays: string[], event: NostrEvent) { return base.publish(relays, event, await current()); },
    async publishToRelays(relays, event) { return base.publishToRelays(relays, event, await current()); },
  };
}

/** Create one immutable authority scope for a service's window lifetime. */
export function createPajaWindowScope(options: {
  backend: PajaRelayBackend;
  source: PajaSignerSource;
  isCurrent(): boolean;
  getPubkey(): string;
  getSigner(source: PajaSignerSource): Signer | null;
}): { backend: PajaRelayBackend; source: PajaSignerSource; getSigner(): Signer | null } {
  const account = options.getPubkey();
  const source: PajaSignerSource = {
    ...options.source,
    isCurrent: () => options.isCurrent() && account === options.getPubkey()
      && (!options.source.isCurrent || options.source.isCurrent()),
  };
  const getSigner = () => options.getSigner(source);
  return {
    source, getSigner,
    backend: scopePajaRelayBackend(options.backend, async () => {
      if (!source.isCurrent?.()) throw new Error('Paja publication source changed');
      const signerPubkey = await getSigner()?.getPublicKey?.();
      // CVM signs with host-owned ephemeral keys, even without a user signer.
      if (!signerPubkey || !account) return {
        ...source, signerPubkey: 'host-generated', runtimeScope: `${source.runtimeScope}|host-session:${documentId}`,
      };
      if (signerPubkey.toLowerCase() !== account.toLowerCase()) throw new Error('Paja signer account changed');
      return { ...source, signerPubkey };
    }),
  };
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

