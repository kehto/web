
import { createDispatch, type NappletMessage, type NostrEvent, type NubHandler } from '@napplet/core';
import type { Capability } from '@kehto/acl/capabilities';
import type { Observation } from '@kehto/firewall';

import type {
  RuntimeAdapter, ConsentHandler, FirewallEvent,
  ServiceHandler, ServiceRegistry, ServiceInfo,
} from './types.js';
import { notifyServiceWindowDestroyed } from './service-dispatch.js';
import { createSessionRegistry, type SessionRegistry } from './session-registry.js';
import { createAclState, type AclStateContainer } from './acl-state.js';
import { createFirewallState, type FirewallStateContainer } from './firewall-state.js';
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

  /** Access the firewall state container (for tests to pre-set policy/rules). */
  readonly firewallState: FirewallStateContainer;

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
  firewallState: FirewallStateContainer;
  manifestCache: ManifestCache;
  consentHandlerRef: { current: ConsentHandler | null };
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
  nubDispatch.registerNub('cvm', adapt(handlers.cvm));
  nubDispatch.registerNub('outbox', adapt(handlers.outbox));
  nubDispatch.registerNub('upload', adapt(handlers.upload));

  return (windowId, envelope) => {
    currentWindowId = windowId;
    try {
      nubDispatch.dispatch(envelope);
    } finally {
      currentWindowId = null;
    }
  };
}

/**
 * Compute the UTF-8 byte length of a string without TextEncoder (ES2022-safe).
 * Mirrors the same helper in state-handler.ts to avoid cross-file import.
 */
function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c < 0xd800 || c >= 0xe000) bytes += 3;
    else { i++; bytes += 4; } // surrogate pair
  }
  return bytes;
}

/**
 * Extract kind and byte-size from a message envelope (publish-style ops only).
 * Guards against malformed envelopes — returns undefined fields on any failure.
 *
 * @param envelope - Incoming NappletMessage envelope.
 * @returns `{ kind?, size? }` — both optional; undefined when not a publish-style op.
 */
function extractKindSize(envelope: NappletMessage): { kind?: number; size?: number } {
  const ev = (envelope as NappletMessage & { event?: unknown }).event;
  if (typeof ev !== 'object' || ev === null) return {};
  const kind = typeof (ev as { kind?: unknown }).kind === 'number'
    ? (ev as { kind: number }).kind
    : undefined;
  let size: number | undefined;
  try {
    size = utf8ByteLength(JSON.stringify(ev));
  } catch { /* malformed event — size stays undefined */ }
  return { kind, size };
}

/**
 * Build a normalized Observation from a message envelope and runtime context.
 * The runtime owns the clock (Date.now()); the pure engine never reads it.
 * Focus is sourced exclusively via getFocusContext (FOCUS-01) — never napplet-self-reported.
 * When getFocusContext is absent, defaults to `{ focused: true }` (safe relax-only default).
 *
 * @param envelope        - Incoming NappletMessage envelope.
 * @param windowId        - Source napplet window identifier.
 * @param senderCap       - Resolved sender capability string (or null).
 * @param sessionRegistry - Used to resolve dTag and registeredAt for the window.
 * @param getFocusContext  - Optional shell-supplied focus query hook.
 * @returns A complete Observation ready for evaluate().
 */
function buildObservation(
  envelope: NappletMessage,
  windowId: string,
  senderCap: string | null,
  sessionRegistry: SessionRegistry,
  getFocusContext?: RuntimeAdapter['getFocusContext'],
): Observation {
  const now = Date.now();
  const entry = sessionRegistry.getEntryByWindowId(windowId);
  const napplet = entry?.dTag ?? '';
  const initElapsedMs = now - (entry?.registeredAt ?? now);
  const focus = getFocusContext?.(windowId) ?? { focused: true };
  const opClass = senderCap ?? envelope.type;
  const { kind, size } = extractKindSize(envelope);
  return { napplet, opClass, kind, size, initElapsedMs, focused: focus.focused, msSinceFocusGain: focus.msSinceFocusGain, now };
}

/** Configuration for createFirewallGate. */
interface FirewallGateConfig {
  firewallState: FirewallStateContainer;
  sessionRegistry: SessionRegistry;
  hooks: RuntimeAdapter;
  fireConsent: (windowId: string, napplet: string) => void;
}

/**
 * Create the firewall gate closure to inject into createMessageHandler.
 * Returns 'dispatch' to allow the message through or 'drop' to reject it.
 *
 * Decision→action mapping (RUNTIME-01, RUNTIME-04, POLICY-02):
 *   - reject → error envelope + drop (no dispatch)
 *   - prompt → error envelope + fireConsent + drop (ask path)
 *   - pass + flag → onFirewallEvent audit + dispatch
 *   - pass (ignore/allow) → dispatch (no audit)
 *
 * @param config - Gate configuration (firewallState, sessionRegistry, hooks, fireConsent).
 * @returns A gate function `(windowId, envelope, senderCap) => 'dispatch' | 'drop'`.
 */
function createFirewallGate(config: FirewallGateConfig): (windowId: string, envelope: NappletMessage, senderCap: string | null) => 'dispatch' | 'drop' {
  const { firewallState, sessionRegistry, hooks, fireConsent } = config;

  return function firewallGate(windowId: string, envelope: NappletMessage, senderCap: string | null): 'dispatch' | 'drop' {
    const obs = buildObservation(envelope, windowId, senderCap, sessionRegistry, hooks.getFocusContext);
    const result = firewallState.evaluate(obs);
    const { decision, action, ruleId, reason } = result;
    const napplet = obs.napplet;
    const opClass = obs.opClass;

    if (decision === 'reject' || decision === 'prompt') {
      // Mirror the ACL denial envelope shaping (runtime.ts ACL path):
      // storage envelopes → `.result`; all others → `.error` (T-81-03: no internals leaked)
      const id = (envelope as NappletMessage & { id?: string }).id ?? '';
      const isStorageEnvelope = envelope.type.startsWith('storage.');
      const type = isStorageEnvelope ? `${envelope.type}.result` : `${envelope.type}.error`;
      hooks.sendToNapplet(windowId, { type, id, error: `firewall: ${reason}` } as NappletMessage);

      hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);

      if (decision === 'prompt') {
        // POLICY-02: reject current message AND fire async consent prompt
        fireConsent(windowId, napplet);
      }
      return 'drop';
    }

    // decision === 'pass'
    if (action === 'flag') {
      // RUNTIME-04: flag → audit + dispatch (message is NOT dropped)
      hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);
    }
    return 'dispatch';
  };
}

function createMessageHandler(
  hooks: RuntimeAdapter,
  enforceNub: ReturnType<typeof createNubEnforceGate>,
  dispatchNubEnvelope: (windowId: string, envelope: NappletMessage) => void,
  firewallGate: (windowId: string, envelope: NappletMessage, senderCap: string | null) => 'dispatch' | 'drop',
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
        const isStorageEnvelope = envelope.type.startsWith('storage.');
        const error = formatDenialReason(result.capability);
        const type = isStorageEnvelope ? `${envelope.type}.result` : `${envelope.type}.error`;
        hooks.sendToNapplet(windowId, { type, id, error } as NappletMessage);
        return;
      }
    }

    const verdict = firewallGate(windowId, envelope, caps.senderCap);
    if (verdict === 'drop') return;

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
    aclState, firewallState, eventBuffer, hooks, ifcRuntime, manifestCache, registeredServices,
    replayDetector, serviceRegistry, sessionRegistry, subscriptions, consentHandlerRef,
  } = context;
  const undeclaredServiceConsents = new Set<string>();

  return {
    handleMessage: context.handleMessage,
    injectEvent(topic: string, payload: unknown): void {
      eventBuffer.bufferAndDeliver(createInjectedEvent(hooks, topic, payload), null);
    },
    destroy(): void {
      manifestCache.persist();
      aclState.persist();
      firewallState.persist();
      replayDetector.clear();
      subscriptions.clear();
      ifcRuntime.clear();
      eventBuffer.clear();
      registeredServices.clear();
      undeclaredServiceConsents.clear();
    },
    registerConsentHandler(handler: ConsentHandler): void {
      consentHandlerRef.current = handler;
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
    get firewallState() { return firewallState; },
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
  const firewallState = createFirewallState(hooks.firewallPersistence);
  const manifestCache = createManifestCache(hooks.manifestPersistence);
  const replayDetector = createReplayDetector(
    hooks.getConfigOverrides
      ? () => hooks.getConfigOverrides!().replayWindowSeconds
      : undefined,
  );

  // Shared consent handler ref — lifted to createRuntime scope so the firewall gate
  // can fire it. The gate is built here (outer scope) but registerConsentHandler is
  // called on the runtime instance (inner scope); the ref bridges both closures.
  const consentHandlerRef: { current: ConsentHandler | null } = { current: null };

  // fireConsent: invoked by the gate on 'prompt' decisions (POLICY-02 ask path).
  // On resolution the user's choice is persisted as a per-napplet policy so subsequent
  // messages are NOT re-prompted (T-81-04: bounded consent spam prevention).
  const fireConsent = (windowId: string, napplet: string): void => {
    const handler = consentHandlerRef.current;
    if (!handler) return;
    handler({
      type: 'firewall-policy',
      windowId,
      napplet,
      pubkey: '',
      resolve: (allowed: boolean): void => {
        firewallState.setPolicy(napplet, allowed ? 'allow' : 'deny');
        firewallState.persist();
      },
    });
  };

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

  const firewallGate = createFirewallGate({ firewallState, sessionRegistry, hooks, fireConsent });

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
  firewallState.load();
  manifestCache.load();

  const ifcRuntime = createIfcRuntime(hooks, sessionRegistry);
  const domainHandlers = createRuntimeDomainHandlers({ hooks, serviceRegistry, sessionRegistry, aclState });
  const dispatchNubEnvelope = createNubEnvelopeDispatcher({
    relay: createRelayHandler({ hooks, serviceRegistry, subscriptions, eventBuffer, replayDetector }),
    identity: createIdentityHandler({ hooks, serviceRegistry }),
    ifc: ifcRuntime.handleMessage,
    ...domainHandlers,
  });
  const handleMessage = createMessageHandler(hooks, enforceNub, dispatchNubEnvelope, firewallGate);

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
    firewallState,
    manifestCache,
    consentHandlerRef,
    handleMessage,
  });
}
