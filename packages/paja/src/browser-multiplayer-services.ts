import { generateSecretKey } from 'nostr-tools/pure';
import type { ServiceHandler } from '@kehto/runtime';
import { createCvmService, createWebrtcService } from '@kehto/services';
import { createNostrCvmTransport } from '@kehto/services/cvm-nostr-transport';
import type { NostrEvent } from '@napplet/core';
import type { PajaMultiplayerConfig } from './multiplayer-config.js';
import type { PajaRelayBackend } from './browser-relay-runtime.js';
import { createPajaCvmRelayPool, scopePajaService } from './browser-operation-scope.js';
import { createPajaWebrtcProfile } from './browser-webrtc-profile.js';

export const PAJA_CVM_OPERATIONS = ['cvm.discover', 'cvm.request', 'cvm.close', 'cvm.registry.list', 'cvm.registry.has', 'cvm.registry.describe', 'cvm.registry.call'];

/** Share transport identity within one authenticated window/source, never across tabs or reloads. */
export function createPajaMultiplayerServices(options: {
  config: PajaMultiplayerConfig;
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
    const service = domain === 'cvm' ? createCvmService({ registry: options.config.registry,
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
  return {
    cvm: scoped('cvm', { descriptor: { name: 'cvm', version: '1.0.0' }, handleMessage(_windowId, message, send) {
      send({ type: `${message.type}.result`, id: 'id' in message ? message.id : '', error: 'unsupported' } as Parameters<typeof send>[0]);
    } }, PAJA_CVM_OPERATIONS),
    webrtc: scoped('webrtc', createWebrtcService(), ['webrtc.open', 'webrtc.send', 'webrtc.close']),
  };
}
