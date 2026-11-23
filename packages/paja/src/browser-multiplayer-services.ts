import { generateSecretKey } from 'nostr-tools/pure';
import { createUnrecognizedTypeDiagnostic, type ServiceHandler } from '@kehto/runtime';
import { createCvmService, createWebrtcService, type CvmConcurrencyOptions, type CvmRegistryFamily } from '@kehto/services';
import { createNostrCvmTransport } from '@kehto/services/cvm-nostr-transport';
import type { NostrEvent } from '@napplet/core';
import type { PajaMultiplayerConfig } from './multiplayer-config.js';
import type { PajaRelayBackend } from './browser-relay-runtime.js';
import { createPajaCvmRelayPool, scopePajaService } from './browser-operation-scope.js';
import { createPajaWebrtcProfile } from './browser-webrtc-profile.js';
import { getPajaSetting } from './settings.js';

export const PAJA_CVM_OPERATIONS = ['cvm.discover', 'cvm.request', 'cvm.close', 'cvm.registry.list', 'cvm.registry.has', 'cvm.registry.describe', 'cvm.registry.call'];

/** Share transport identity within one authenticated window/source, never across tabs or reloads. */
export function createPajaMultiplayerServices(options: {
  config: PajaMultiplayerConfig;
  /** Resolved CVM families; the signaling config's deprecated registry is not read here. */
  registry: readonly CvmRegistryFamily[];
  /** Per-window NAP-CVM admission limits; absent means the service defaults. */
  concurrency?: CvmConcurrencyOptions;
  scopeKey(windowId: string): string;
  namespace(windowId: string): string | undefined;
  backend(windowId: string, isCurrent: () => boolean): PajaRelayBackend;
}): { cvm: ServiceHandler; webrtc: ServiceHandler } {
  const keys = new Map<string, { secret: Uint8Array; refs: number }>();
  const scoped = (domain: 'cvm' | 'webrtc', base: ServiceHandler, types: string[]) => scopePajaService(base, types, (windowId, isCurrent) => {
    const key = `${windowId}:${options.scopeKey(windowId)}`;
    let entry = keys.get(key);
    if (!entry) { entry = { secret: generateSecretKey(), refs: 0 }; keys.set(key, entry); }
    entry.refs++;
    const backend = options.backend(windowId, isCurrent);
    const service = domain === 'cvm' ? createCvmService({ registry: [...options.registry], concurrency: options.concurrency,
      serverRequestTimeoutMs: getPajaSetting('cvm.serverRequestTimeoutMs'),
      transport: createNostrCvmTransport({ pool: createPajaCvmRelayPool(backend), defaultRelays: options.config.relays, clientSecretKey: entry.secret }),
    }) : createWebrtcService(createPajaWebrtcProfile({
      secretKey: entry.secret, namespace: options.namespace(windowId) ?? options.config.developmentNamespace ?? '',
      relays: options.config.relays, isCurrent,
      iceEndpoints: options.config.iceServers?.flatMap(server => server.urls),
      createPeer: () => new RTCPeerConnection({ iceServers: options.config.iceServers ?? [] }),
      relay: {
        subscribe(relays, filters, onEvent) {
          const sub = backend.subscription([...relays], filters).subscribe(event => { if (typeof event === 'object' && event !== null) onEvent(event as NostrEvent); });
          return { close: () => sub.unsubscribe() };
        },
        publish: (relays, event) => backend.publishWebrtcSignal([...relays], event),
      },
    }));
    let released = false;
    return { ...service, onUnregistered() {
      service.onUnregistered?.();
      if ('dispose' in service) (service.dispose as () => void)();
      if (!released) { released = true; if (--entry.refs === 0) { entry.secret.fill(0); keys.delete(key); } }
    } };
  }, options.scopeKey);
  // PAJA_CVM_OPERATIONS is every napplet request in NAP-CVM #31 @ 28cf1bdb, so
  // the unscoped base only ever sees types the NAP does not define. NIP-5D
  // (nips#2303 @ f60550c3) and NAP-CVM both require those to get no reply.
  const ignoreUnrecognized = createUnrecognizedTypeDiagnostic();
  return {
    cvm: scoped('cvm', { descriptor: { name: 'cvm', version: '1.0.0' }, handleMessage(_windowId, message) {
      ignoreUnrecognized('cvm', message.type);
    } }, PAJA_CVM_OPERATIONS),
    webrtc: scoped('webrtc', createWebrtcService(), ['webrtc.open', 'webrtc.send', 'webrtc.close']),
  };
}
