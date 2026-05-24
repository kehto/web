
import { createDispatch, type NappletMessage, type NostrEvent, type NubHandler } from '@napplet/core';
import type { Capability } from '@kehto/acl/capabilities';

import type {
  RuntimeAdapter, ConsentHandler,
  ServiceHandler, ServiceRegistry, ServiceInfo,
} from './types.js';
import { notifyServiceWindowDestroyed } from './service-dispatch.js';
import { createSessionRegistry, type SessionRegistry } from './session-registry.js';
import { createAclState, type AclStateContainer } from './acl-state.js';
import { createManifestCache, type ManifestCache } from './manifest-cache.js';
import { createReplayDetector, type ReplayDetector } from './replay.js';
import { createEventBuffer, RING_BUFFER_SIZE, type EventBuffer, type SubscriptionEntry } from './event-buffer.js';
import { createEnforceGate, createNubEnforceGate, resolveCapabilitiesNub, formatDenialReason } from './enforce.js';
import { createRelayHandler } from './relay-handler.js';
import { createIdentityHandler } from './identity-handler.js';
import { createIfcRuntime, type IfcRuntime } from './ifc-handler.js';
import { createRuntimeDomainHandlers, type RuntimeDomainHandlers } from './domain-handlers.js';

/**
 * The napplet protocol engine — handles NIP-5D NUB domain dispatch,
 * ACL enforcement, subscription lifecycle.
 *
 * @example
 * ```ts
 * import { createRuntime } from '@kehto/runtime';
 *
 * const runtime = createRuntime(hooks);
 * runtime.handleMessage('window-1', { type: 'relay.req', id: 'sub1', filters: [{ kinds: [1] }] });
 * ```
 */
export interface Runtime {
  /**
   * Handle an incoming NIP-5D NappletMessage envelope from a napplet.
   * The caller is responsible for identifying the source (windowId).
   * Legacy NIP-01 arrays are silently dropped (clean break — no dual-mode).
   *
   * @param windowId - The identifier of the napplet that sent the message
   * @param msg - The raw message (NappletMessage envelopes are processed; other types dropped)
   */
  handleMessage(windowId: string, msg: unknown): void;

  /**
   * Inject a shell-originated event into subscription delivery.
   *
   * @param topic - The event topic tag value
   * @param payload - The event content
   */
  injectEvent(topic: string, payload: unknown): void;

  /** Destroy the runtime, persisting state and clearing all internal state. */
  destroy(): void;

  /** Register a handler for consent requests on destructive signing kinds. */
  registerConsentHandler(handler: ConsentHandler): void;

  /**
   * Register a service handler dynamically after runtime creation.
   * If a handler is already registered for this name, it is replaced.
   *
   * @param name - Service name (e.g., 'audio', 'notifications')
   * @param handler - The service handler implementation
   */
  registerService(name: string, handler: ServiceHandler): void;

  /**
   * Unregister a service handler by name. No-op if the name is not registered.
   *
   * @param name - Service name to remove
   */
  unregisterService(name: string): void;

  /**
   * Clean up all state associated with a napplet window.
   * Removes subscriptions, pending state, and notifies service handlers.
   *
   * @param windowId - The window to clean up
   */
  destroyWindow(windowId: string): void;

  /** Access the identity registry (for shell adapter to read napplet session state). */
  readonly sessionRegistry: SessionRegistry;

  /** Access the ACL state container. */
  readonly aclState: AclStateContainer;

  /** Access the manifest cache. */
  readonly manifestCache: ManifestCache;
}

type RuntimeNubHandlers = RuntimeDomainHandlers & {
  relay: (windowId: string, msg: NappletMessage) => void;
  identity: (windowId: string, msg: NappletMessage) => void;
  ifc: (windowId: string, msg: NappletMessage) => void;
};

type RuntimeInstanceContext = {
  hooks: RuntimeAdapter;
  serviceRegistry: ServiceRegistry;
  registeredServices: Map<string, ServiceInfo>;
  replayDetector: ReplayDetector;
  subscriptions: Map<string, SubscriptionEntry>;
  eventBuffer: EventBuffer;
  ifcRuntime: IfcRuntime;
  sessionRegistry: SessionRegistry;
  aclState: AclStateContainer;
  manifestCache: ManifestCache;
  handleMessage: Runtime['handleMessage'];
};

function createRegisteredServices(serviceRegistry: ServiceRegistry): Map<string, ServiceInfo> {
  const registeredServices = new Map<string, ServiceInfo>();
  for (const [name, handler] of Object.entries(serviceRegistry)) {
    registeredServices.set(name, {
      name: handler.descriptor.name,
      version: handler.descriptor.version,
      description: handler.descriptor.description,
    });
  }
  return registeredServices;
}

function createNubEnvelopeDispatcher(handlers: RuntimeNubHandlers): (windowId: string, envelope: NappletMessage) => void {
  let currentWindowId: string | null = null;
  const nubDispatch = createDispatch();
  const adapt = (handler: (windowId: string, msg: NappletMessage) => void): NubHandler => (msg) => {
    if (currentWindowId !== null) handler(currentWindowId, msg);
  };

  nubDispatch.registerNub('relay', adapt(handlers.relay));
  nubDispatch.registerNub('identity', adapt(handlers.identity));
  nubDispatch.registerNub('keys', adapt(handlers.keys));
  nubDispatch.registerNub('media', adapt(handlers.media));
  nubDispatch.registerNub('notify', adapt(handlers.notify));
  nubDispatch.registerNub('storage', adapt(handlers.storage));
  nubDispatch.registerNub('ifc', adapt(handlers.ifc));
  nubDispatch.registerNub('theme', adapt(handlers.theme));
  nubDispatch.registerNub('config', adapt(handlers.config));
  nubDispatch.registerNub('resource', adapt(handlers.resource));

  return (windowId, envelope) => {
    currentWindowId = windowId;
    try {
      nubDispatch.dispatch(envelope);
    } finally {
      currentWindowId = null;
    }
  };
}

function createMessageHandler(
  hooks: RuntimeAdapter,
  enforceNub: ReturnType<typeof createNubEnforceGate>,
  dispatchNubEnvelope: (windowId: string, envelope: NappletMessage) => void,
): Runtime['handleMessage'] {
  return (windowId: string, msg: unknown): void => {
    if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;
    const envelope = msg as NappletMessage;
    const dotIdx = envelope.type.indexOf('.');
    if (dotIdx === -1) return;

    const caps = resolveCapabilitiesNub(envelope);
    if (caps.senderCap) {
      const result = enforceNub(windowId, caps.senderCap as Capability, envelope);
      if (!result.allowed) {
        const id = (envelope as NappletMessage & { id?: string }).id ?? '';
        const isIdentityDecrypt = envelope.type === 'identity.decrypt';
        const error = isIdentityDecrypt
          ? result.reason === 'class-forbidden' ? 'class-forbidden' : 'policy-denied'
          : formatDenialReason(result.capability);
        hooks.sendToNapplet(windowId, { type: `${envelope.type}.error`, id, error } as NappletMessage);
        return;
      }
    }

    dispatchNubEnvelope(windowId, envelope);
  };
}

function createInjectedEvent(hooks: RuntimeAdapter, topic: string, payload: unknown): NostrEvent {
  const uuid = hooks.crypto.randomUUID().replace(/-/g, '').slice(0, 64).padEnd(64, '0');
  return {
    id: uuid,
    pubkey: '0'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind: 29000,
    tags: [['t', topic]],
    content: JSON.stringify(payload),
    sig: '0'.repeat(128),
  };
}

function createRuntimeInstance(context: RuntimeInstanceContext): Runtime {
  const {
    aclState, eventBuffer, hooks, ifcRuntime, manifestCache, registeredServices,
    replayDetector, serviceRegistry, sessionRegistry, subscriptions,
  } = context;
  const undeclaredServiceConsents = new Set<string>();
  let consentHandler: ConsentHandler | null = null;

  return {
    handleMessage: context.handleMessage,
    injectEvent(topic: string, payload: unknown): void {
      eventBuffer.bufferAndDeliver(createInjectedEvent(hooks, topic, payload), null);
    },
    destroy(): void {
      manifestCache.persist();
      aclState.persist();
      replayDetector.clear();
      subscriptions.clear();
      ifcRuntime.clear();
      eventBuffer.clear();
      registeredServices.clear();
      undeclaredServiceConsents.clear();
    },
    registerConsentHandler(handler: ConsentHandler): void {
      consentHandler = handler;
      void consentHandler;
    },
    registerService(name: string, handler: ServiceHandler): void {
      serviceRegistry[name] = handler;
      registeredServices.set(name, {
        name: handler.descriptor.name,
        version: handler.descriptor.version,
        description: handler.descriptor.description,
      });
    },
    unregisterService(name: string): void {
      delete serviceRegistry[name];
      registeredServices.delete(name);
    },
    destroyWindow(windowId: string): void {
      for (const [key] of subscriptions) {
        if (key.startsWith(`${windowId}:`)) {
          subscriptions.delete(key);
          hooks.relayPool?.untrackSubscription(key);
        }
      }
      ifcRuntime.destroyWindow(windowId);
      notifyServiceWindowDestroyed(windowId, serviceRegistry);
    },
    get sessionRegistry() { return sessionRegistry; },
    get aclState() { return aclState; },
    get manifestCache() { return manifestCache; },
  };
}

/**
 * Create a runtime instance with dependency injection via hooks.
 *
 * @param hooks - Host application provides relay pool, auth, config, etc.
 * @returns A Runtime instance ready to handle napplet messages
 *
 * @example
 * ```ts
 * const runtime = createRuntime(hooks);
 * // On incoming message from napplet:
 * runtime.handleMessage(windowId, { type: 'relay.req', id: 'sub1', filters: [] });
 * ```
 */
export function createRuntime(hooks: RuntimeAdapter): Runtime {
  const subscriptions = new Map<string, SubscriptionEntry>();
  const serviceRegistry: ServiceRegistry = { ...hooks.services };
  const registeredServices = createRegisteredServices(serviceRegistry);
  const sessionRegistry = createSessionRegistry(hooks.onPendingUpdate);
  const aclState = createAclState(hooks.aclPersistence);
  const manifestCache = createManifestCache(hooks.manifestPersistence);
  const replayDetector = createReplayDetector(
    hooks.getConfigOverrides
      ? () => hooks.getConfigOverrides!().replayWindowSeconds
      : undefined,
  );

  const enforce = createEnforceGate({
    checkAcl: (pubkey, dTag, aggregateHash, capability) =>
      aclState.check(pubkey, dTag, aggregateHash, capability),
    resolveIdentity: (pubkey) => {
      const entry = sessionRegistry.getEntry(pubkey);
      return entry ? { dTag: entry.dTag, aggregateHash: entry.aggregateHash } : undefined;
    },
    onAclCheck: hooks.onAclCheck,
  });

  const enforceNub = createNubEnforceGate({
    checkAcl: (pubkey, dTag, aggregateHash, capability) =>
      aclState.check(pubkey, dTag, aggregateHash, capability),
    resolveIdentityByWindowId: (windowId) => {
      const entry = sessionRegistry.getEntryByWindowId(windowId);
      return entry
        ? { dTag: entry.dTag, aggregateHash: entry.aggregateHash, class: entry.class }
        : undefined;
    },
    onAclCheck: hooks.onAclCheck,
  });

  const eventBuffer = createEventBuffer(
    hooks.sendToNapplet,
    sessionRegistry,
    enforce,
    subscriptions,
    hooks.getConfigOverrides
      ? () => hooks.getConfigOverrides!().ringBufferSize ?? RING_BUFFER_SIZE
      : undefined,
  );

  aclState.load();
  manifestCache.load();

  const ifcRuntime = createIfcRuntime(hooks, sessionRegistry);
  const domainHandlers = createRuntimeDomainHandlers({ hooks, serviceRegistry, sessionRegistry, aclState });
  const dispatchNubEnvelope = createNubEnvelopeDispatcher({
    relay: createRelayHandler({ hooks, serviceRegistry, subscriptions, eventBuffer, replayDetector }),
    identity: createIdentityHandler({ hooks, serviceRegistry }),
    ifc: ifcRuntime.handleMessage,
    ...domainHandlers,
  });
  const handleMessage = createMessageHandler(hooks, enforceNub, dispatchNubEnvelope);

  return createRuntimeInstance({
    hooks,
    serviceRegistry,
    registeredServices,
    replayDetector,
    subscriptions,
    eventBuffer,
    ifcRuntime,
    sessionRegistry,
    aclState,
    manifestCache,
    handleMessage,
  });
}
