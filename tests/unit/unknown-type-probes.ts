/**
 * unknown-type-probes.ts — behavioural driver for the NIP-5D unknown-type guard.
 *
 * NIP-5D (nostr-protocol/nips#2303 @ dskvr/nips@f60550c3): "Messages with an
 * unrecognized `type` MUST be silently ignored" and "Unrecognized message types
 * are silently ignored, preventing capability probing." Every reference service
 * is built here with inert options, attached to a permissive runtime context and
 * sent types its NAP does not define. Any envelope it produces, through `send`
 * or a runtime push, is a violation (kehto/web#465).
 */
import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
import * as services from '@kehto/services';

export const PROBE_WINDOW = 'win-probe';

/** An object whose every method is a no-op returning a no-op (usable as an unsubscribe). */
function inert<T>(): T {
  const noop = (): (() => void) => () => undefined;
  return new Proxy({}, { get: (_target, key) => (key === 'then' ? undefined : noop) }) as T;
}

const never = (): Promise<never> => new Promise(() => undefined);
const relayPool = { subscribe: () => ({ unsubscribe() { /* inert */ } }), publish() { /* inert */ }, selectRelayTier: () => [], isAvailable: () => true };
const cache = { query: async () => [], store() { /* inert */ }, isAvailable: () => true };

/**
 * Every reference service factory exported by `@kehto/services`, keyed by the
 * export name, with the wire domain it serves. The guard fails when a new
 * `create*Service` export is missing here.
 */
export const SERVICE_PROBES: Readonly<Record<string, { domain: string; build: () => ServiceHandler }>> = {
  createBleService: { domain: 'ble', build: () => services.createBleService() },
  createCacheService: { domain: 'relay', build: () => services.createCacheService(cache as never) },
  createConfigService: { domain: 'config', build: () => services.createConfigService({ getValues: () => ({}) }).handler },
  createCommonService: { domain: 'common', build: () => services.createCommonService() },
  createCoordinatedRelay: { domain: 'relay', build: () => services.createCoordinatedRelay({ relayPool, cache } as never) },
  createCountService: { domain: 'count', build: () => services.createCountService({ count: () => 0 } as never) },
  createCvmService: { domain: 'cvm', build: () => services.createCvmService({ transport: inert() }) },
  createDmService: { domain: 'dm', build: () => services.createDmService({ adapter: inert() }) },
  createFsService: { domain: 'fs', build: () => services.createFsService({ backend: inert() }) },
  createGamepadService: { domain: 'gamepad', build: () => services.createGamepadService({ readGamepads: () => [] }) },
  createIdentityService: { domain: 'identity', build: () => services.createIdentityService({ getSigner: () => null }) },
  createIntentService: { domain: 'intent', build: () => services.createIntentService({ resolveSender: () => 'source', resolver: inert() }) },
  createKeysService: { domain: 'keys', build: () => services.createKeysService() },
  createLinkService: { domain: 'link', build: () => services.createLinkService({ open: never } as never) },
  createListsService: { domain: 'lists', build: () => services.createListsService() },
  createLlmService: { domain: 'llm', build: () => services.createLlmService({ host: inert() }) },
  createMediaService: { domain: 'media', build: () => services.createMediaService({ hostBridge: { onAction: () => () => undefined, ...inert<object>() } } as never) },
  createNotificationService: { domain: 'notify', build: () => services.createNotificationService() },
  createNotifyService: { domain: 'notify', build: () => services.createNotifyService() },
  createOutboxService: { domain: 'outbox', build: () => services.createOutboxService({ router: inert() }) },
  createRelayPoolService: { domain: 'relay', build: () => services.createRelayPoolService(relayPool as never) },
  createResourceService: { domain: 'resource', build: () => services.createResourceService({ fetch: never } as never) },
  createSerialService: { domain: 'serial', build: () => services.createSerialService() },
  createThemeService: { domain: 'theme', build: () => services.createThemeService().handler },
  createUploadService: { domain: 'upload', build: () => services.createUploadService({ uploader: inert() }) },
  createWebrtcService: { domain: 'webrtc', build: () => services.createWebrtcService() },
};

/** Names of `@kehto/services` exports that build a NAP-domain service handler. */
export function serviceFactoryExports(): string[] {
  return Object.keys(services).filter((name) => /^create\w+Service$/.test(name) || name === 'createCoordinatedRelay');
}

/**
 * Types no NAP defines for `domain`, plus result/push shapes a napplet must
 * never send. `webrtc.stats` is a request NAP-WEBRTC #59 @ fb4dd6f0 does not
 * define (it is only a pushed event); `storage.clear` is not in NAP-STORAGE
 * #3 @ 4f4cf0ca.
 */
export function unknownTypesFor(domain: string): string[] {
  const extra: Record<string, string[]> = { webrtc: ['webrtc.stats'], storage: ['storage.clear'] };
  return [`${domain}.bogus`, `${domain}.bogus.deep.action`, ...(extra[domain] ?? [])];
}

/** A runtime context that approves everything and records pushes. */
export function permissiveContext(pushed: NappletMessage[]): ServiceRuntimeContext {
  return {
    authorizeOperation: async (_windowId, _operation, _requirements, execute) =>
      ({ status: 'executed', value: await execute(new AbortController().signal) }) as never,
    resolveDTag: () => 'probe',
    listWindowIds: () => [PROBE_WINDOW],
    hasCapability: () => true,
    sendToEligibleNapplet: (_windowId, message) => { pushed.push(message); return true; },
  };
}

/** Let promise chains and zero-delay timers run. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Drive one service with every unknown type for its domain and return all
 * envelopes it produced (replies and pushes).
 */
export async function probeService(service: ServiceHandler, domain: string): Promise<NappletMessage[]> {
  const out: NappletMessage[] = [];
  service.onRegistered?.(permissiveContext(out));
  for (const type of unknownTypesFor(domain)) {
    service.handleMessage(PROBE_WINDOW, { type, id: `probe-${type}`, sessionId: 's1', subId: 's1' } as NappletMessage, (message) => out.push(message));
  }
  await settle();
  service.onWindowDestroyed?.(PROBE_WINDOW);
  service.onUnregistered?.();
  (service as { destroy?: () => void }).destroy?.();
  return out;
}
