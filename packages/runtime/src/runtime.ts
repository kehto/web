
import { createDispatch, type NappletMessage, type NostrEvent, type NapHandler, type NapDomain } from '@napplet/core';
import type { Capability } from '@kehto/acl/capabilities';
import type { Observation, PermissionRequirement } from '@kehto/firewall';

import type {
  RuntimeAdapter, ConsentHandler, FirewallEvent,
  ServiceHandler, ServiceRegistry, ServiceInfo, ServiceRuntimeContext,
} from './types.js';
import { createServiceExtensionRouter } from './service-extensions.js';
import { notifyServiceWindowDestroyed, notifyServicePermissionRevoked } from './service-dispatch.js';
import { createSessionRegistry, type SessionRegistry } from './session-registry.js';
import { createAclState, type AclStateContainer } from './acl-state.js';
import { createFirewallState, type FirewallStateContainer } from './firewall-state.js';
import { createPermissionRuntime, type RuntimePermissions } from './permission-runtime.js';
import type { ApprovalSignal } from './approval-coordinator.js';
import { createManifestCache, type ManifestCache } from './manifest-cache.js';
import { createReplayDetector, type ReplayDetector } from './replay.js';
import { createEventBuffer, RING_BUFFER_SIZE, type EventBuffer, type SubscriptionEntry } from './event-buffer.js';
import { createEnforceGate, createNapEnforceGate, resolveCapabilitiesNap, formatDenialReason } from './enforce.js';
import { createRelayHandler, revokeRelaySubscriptions } from './relay-handler.js';
import { createIdentityHandler } from './identity-handler.js';
import { createCountHandler } from './count-handler.js';
import { createIncRuntime, type IncRuntime } from './inc-handler.js';
import { createRuntimeDomainHandlers, type RuntimeDomainHandlers } from './domain-handlers.js';
import {
  createCanonicalDomainResult,
  createIntentPolicyDenial,
  isIdentityOrThemeMessage,
} from './domain-results.js';

/**
 * The napplet protocol engine — handles NIP-5D NAP domain dispatch,
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
  /** Scoped permission management when the host supplies approval adapters. */
  readonly permissions?: RuntimePermissions;
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
   * Built-in domains keep their NAP routing. Other domains require the
   * handler's exact messageCapabilities map and an explicit host domain grant.
   * Registration never injects namespace bindings or grants capabilities.
   *
   * @param name - Exact domain name (e.g., 'notify' or a host extension)
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

type RuntimeNapHandlers = RuntimeDomainHandlers & {
  relay: (windowId: string, msg: NappletMessage) => void;
  identity: (windowId: string, msg: NappletMessage) => void;
  count: (windowId: string, msg: NappletMessage) => void;
  inc: (windowId: string, msg: NappletMessage) => void;
};

type RuntimeInstanceContext = {
  permissions?: ReturnType<typeof createPermissionRuntime>;
  hooks: RuntimeAdapter;
  serviceRegistry: ServiceRegistry;
  registeredServices: Map<string, ServiceInfo>;
  replayDetector: ReplayDetector;
  subscriptions: Map<string, SubscriptionEntry>;
  eventBuffer: EventBuffer;
  incRuntime: IncRuntime;
  sessionRegistry: SessionRegistry;
  aclState: AclStateContainer;
  firewallState: FirewallStateContainer;
  manifestCache: ManifestCache;
  consentHandlerRef: { current: ConsentHandler | null };
  handleMessage: Runtime['handleMessage'];
  extensions: ReturnType<typeof createServiceExtensionRouter>;
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

function createNapEnvelopeDispatcher(handlers: RuntimeNapHandlers): (windowId: string, envelope: NappletMessage) => void {
  let currentWindowId: string | null = null;
  const napDispatch = createDispatch();
  const adapt = (handler: (windowId: string, msg: NappletMessage) => void): NapHandler => (msg) => {
    if (currentWindowId !== null) handler(currentWindowId, msg);
  };

  // NAP-GAMEPAD proposal #108 defines this domain; older core type unions predate it.
  napDispatch.registerNap('gamepad' as NapDomain, adapt(handlers.gamepad));
  napDispatch.registerNap('relay', adapt(handlers.relay));
  napDispatch.registerNap('identity', adapt(handlers.identity));
  napDispatch.registerNap('count', adapt(handlers.count));
  napDispatch.registerNap('keys', adapt(handlers.keys));
  napDispatch.registerNap('media', adapt(handlers.media));
  napDispatch.registerNap('notify', adapt(handlers.notify));
  napDispatch.registerNap('storage', adapt(handlers.storage));
  napDispatch.registerNap('inc', adapt(handlers.inc));
  napDispatch.registerNap('theme', adapt(handlers.theme));
  napDispatch.registerNap('config', adapt(handlers.config));
  napDispatch.registerNap('resource', adapt(handlers.resource));
  napDispatch.registerNap('cvm', adapt(handlers.cvm));
  napDispatch.registerNap('outbox', adapt(handlers.outbox));
  napDispatch.registerNap('upload', adapt(handlers.upload));
  napDispatch.registerNap('intent', adapt(handlers.intent));
  napDispatch.registerNap('link', adapt(handlers.link));
  napDispatch.registerNap('common', adapt(handlers.common));
  napDispatch.registerNap('lists', adapt(handlers.lists));
  napDispatch.registerNap('serial', adapt(handlers.serial));
  napDispatch.registerNap('ble', adapt(handlers.ble));
  napDispatch.registerNap('webrtc', adapt(handlers.webrtc));
  napDispatch.registerNap('dm', adapt(handlers.dm));
  napDispatch.registerNap('fs', adapt(handlers.fs));

  return (windowId, envelope) => {
    currentWindowId = windowId;
    try {
      napDispatch.dispatch(envelope);
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
  return {
    napplet,
    opClass,
    kind,
    size,
    initElapsedMs,
    // `windowId` comes from the host's source-bound session lookup, never the
    // napplet message envelope. Trusted register() calls retire this key's
    // previous startup budget; ordinary messages cannot reset it.
    initKey: windowId,
    focused: focus.focused,
    msSinceFocusGain: focus.msSinceFocusGain,
    now,
  };
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
function createFirewallGate(config: FirewallGateConfig): (windowId: string, envelope: NappletMessage, senderCap: string | null, respond?: boolean) => 'dispatch' | 'drop' {
  const { firewallState, sessionRegistry, hooks, fireConsent } = config;

  return function firewallGate(windowId: string, envelope: NappletMessage, senderCap: string | null, respond = true): 'dispatch' | 'drop' {
    const obs = buildObservation(envelope, windowId, senderCap, sessionRegistry, hooks.getFocusContext);
    const result = firewallState.evaluate(obs);
    const { decision, action, ruleId, reason } = result;
    const napplet = obs.napplet;
    const opClass = obs.opClass;

    if (decision === 'reject' || decision === 'prompt') {
      if (!respond) {
        // Extension error contracts are host-owned; do not invent wire replies.
        hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);
        if (decision === 'prompt') fireConsent(windowId, napplet);
        return 'drop';
      }
      const intentDenial = createIntentPolicyDenial(envelope);
      if (intentDenial) {
        hooks.sendToNapplet(windowId, intentDenial);
        hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);
        if (decision === 'prompt') fireConsent(windowId, napplet);
        return 'drop';
      }

      const canonicalResult = createCanonicalDomainResult(envelope);
      if (canonicalResult) {
        hooks.sendToNapplet(windowId, canonicalResult);
        hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);
        if (decision === 'prompt') fireConsent(windowId, napplet);
        return 'drop';
      }

      const denial = createDenialResponse(envelope, `firewall: ${reason}`);
      if (denial) hooks.sendToNapplet(windowId, denial);

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

function denialResponseType(envelope: NappletMessage): string | null {
  if (envelope.type.startsWith('intent.')) return null;
  if (envelope.type.startsWith('storage.')) return `${envelope.type}.result`;
  if (envelope.type === 'inc.subscribe' || envelope.type === 'inc.channel.open') {
    return `${envelope.type}.result`;
  }
  if (envelope.type.startsWith('inc.')) return null;
  return `${envelope.type}.error`;
}

function createDenialResponse(envelope: NappletMessage, error: string): NappletMessage | null {
  const id = (envelope as NappletMessage & { id?: string }).id ?? '';
  if (envelope.type === 'outbox.query') {
    return {
      type: 'outbox.query.result',
      id,
      events: [],
      error,
    } as NappletMessage;
  }
  const type = denialResponseType(envelope);
  return type ? { type, id, error } as NappletMessage : null;
}

function createMessageHandler(
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  enforceNap: ReturnType<typeof createNapEnforceGate>,
  dispatchNapEnvelope: (windowId: string, envelope: NappletMessage) => void,
  serviceRouting: { builtInDomains: ReadonlySet<string>; extensions: ReturnType<typeof createServiceExtensionRouter> },
  firewallGate: (windowId: string, envelope: NappletMessage, senderCap: string | null) => 'dispatch' | 'drop',
  permissions?: ReturnType<typeof createPermissionRuntime>,
): Runtime['handleMessage'] {
  return (windowId: string, msg: unknown): void => {
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg) || !('type' in msg) || typeof msg.type !== 'string') return;
    const envelope = msg as NappletMessage;
    const dotIdx = envelope.type.indexOf('.');
    if (dotIdx === -1) return;
    // Only source-bound sessions may dispatch. The browser adapter registers
    // trusted creation identity independently of the optional NAP-SHELL exchange.
    if (!sessionRegistry.getEntryByWindowId(windowId)) return;
    if (permissions && !permissions.isSourceActive(windowId)) return;
    const domain = envelope.type.slice(0, dotIdx);
    if (!serviceRouting.builtInDomains.has(domain)) {
      serviceRouting.extensions.handleMessage(windowId, envelope);
      return;
    }
    if (hooks.isDomainAllowed && !hooks.isDomainAllowed(windowId, domain)) return;
    // The migrated LINK service validates its exact destination before invoking
    // shared approval/rate coordination. Unknown methods cannot trigger prompts.
    if (hooks.permissions && domain === 'link') {
      if (envelope.type === 'link.open') dispatchNapEnvelope(windowId, envelope);
      return;
    }
    // Configured hosts cannot expose a built-in interface merely by setting an
    // environment flag. Startup admission supplies the corresponding grant.
    if (permissions && !permissions.hasInterface(windowId, domain)) return;
    if (isIdentityOrThemeMessage(envelope) && !createCanonicalDomainResult(envelope)) return;

    const caps = resolveCapabilitiesNap(envelope);
    if (caps.senderCap) {
      const result = enforceNap(windowId, caps.senderCap as Capability, envelope);
      if (!result.allowed) {
        const intentDenial = createIntentPolicyDenial(envelope);
        if (intentDenial) {
          hooks.sendToNapplet(windowId, intentDenial);
          return;
        }

        const canonicalResult = createCanonicalDomainResult(envelope);
        if (canonicalResult) {
          hooks.sendToNapplet(windowId, canonicalResult);
          return;
        }

        const error = formatDenialReason(result.capability);
        const denial = createDenialResponse(envelope, error);
        if (denial) hooks.sendToNapplet(windowId, denial);
        return;
      }
    }

    const verdict = firewallGate(windowId, envelope, caps.senderCap);
    if (verdict === 'drop') return;

    dispatchNapEnvelope(windowId, envelope);
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
    aclState, firewallState, eventBuffer, hooks, incRuntime, manifestCache, registeredServices,
    replayDetector, serviceRegistry, sessionRegistry, subscriptions, consentHandlerRef, extensions,
  } = context;
  const undeclaredServiceConsents = new Set<string>();
  const attachedServices = new Map<string, ServiceHandler>();
  const serviceLifetimes = new Map<string, object>();
  const isDomainAllowed = hooks.isDomainAllowed;
  const sendToNapplet = hooks.sendToNapplet;
  const serviceContext: ServiceRuntimeContext = Object.freeze({
    resolveDTag(windowId: string): string | undefined {
      return sessionRegistry.getEntryByWindowId(windowId)?.dTag;
    },
    listWindowIds(): readonly string[] {
      return Object.freeze(
        sessionRegistry.getAllEntries().map((entry) => entry.windowId),
      );
    },
    hasCapability(windowId: string, capability: Capability): boolean {
      const entry = sessionRegistry.getEntryByWindowId(windowId);
      return !!entry && aclState.check('', entry.dTag, entry.aggregateHash, capability);
    },
    sendToEligibleNapplet(windowId: string, message: NappletMessage): boolean {
      const entry = sessionRegistry.getEntryByWindowId(windowId);
      if (!entry || typeof message.type !== 'string') return false;
      const dotIndex = message.type.indexOf('.');
      if (dotIndex <= 0) return false;
      const domain = message.type.slice(0, dotIndex);
      try {
        if (isDomainAllowed && !isDomainAllowed(windowId, domain)) return false;
        const { recipientCap } = resolveCapabilitiesNap(message);
        // NAP-GAMEPAD requires source/domain isolation; its ACL checks are optional.
        // Do not fabricate a gamepad:read capability absent from the proposal.
        if (!recipientCap && message.type !== 'gamepad.state') return false;
        if (recipientCap && !aclState.check('', entry.dTag, entry.aggregateHash, recipientCap as Capability)) {
          return false;
        }
        sendToNapplet(windowId, message);
        return true;
      } catch {
        return false;
      }
    },
  });

  function attachService(name: string, handler: ServiceHandler): void {
    attachedServices.set(name, handler);
    const lifetime = {};
    serviceLifetimes.set(name, lifetime);
    const boundContext: ServiceRuntimeContext = context.permissions ? Object.freeze({ ...serviceContext,
      authorizeOperation<T>(windowId: string, operation: string, requirements: readonly PermissionRequirement[],
        execute: (signal: ApprovalSignal) => T | Promise<T>, signal?: ApprovalSignal) {
        return context.permissions!.run(windowId, operation, requirements, () => serviceLifetimes.get(name) === lifetime, execute, 'operation', signal);
      },
    }) : serviceContext;
    try {
      handler.onRegistered?.(boundContext);
    } catch {
      // A failed optional attachment leaves the service safely context-free.
    }
  }

  function detachService(name: string): void {
    const handler = attachedServices.get(name);
    if (!handler) return;
    attachedServices.delete(name);
    serviceLifetimes.delete(name);
    try {
      handler.onUnregistered?.();
    } catch {
      // Service cleanup is best-effort and cannot block runtime teardown.
    }
  }

  for (const [name, handler] of Object.entries(serviceRegistry)) {
    attachService(name, handler);
  }

  return {
    handleMessage: context.handleMessage,
    injectEvent(topic: string, payload: unknown): void {
      eventBuffer.bufferAndDeliver(createInjectedEvent(hooks, topic, payload), null);
    },
    destroy(): void {
      context.permissions?.destroy();
      extensions.destroy();
      registeredServices.clear();
      for (const name of attachedServices.keys()) detachService(name);
      manifestCache.persist();
      aclState.persist();
      firewallState.persist();
      replayDetector.clear();
      subscriptions.clear();
      incRuntime.clear();
      eventBuffer.clear();
      undeclaredServiceConsents.clear();
    },
    registerConsentHandler(handler: ConsentHandler): void {
      consentHandlerRef.current = handler;
    },
    registerService(name: string, handler: ServiceHandler): void {
      context.permissions?.cancelPending();
      registeredServices.delete(name);
      detachService(name);
      serviceRegistry[name] = handler;
      registeredServices.set(name, {
        name: handler.descriptor.name,
        version: handler.descriptor.version,
        description: handler.descriptor.description,
      });
      attachService(name, handler);
    },
    unregisterService(name: string): void {
      context.permissions?.cancelPending();
      registeredServices.delete(name);
      detachService(name);
      delete serviceRegistry[name];
    },
    destroyWindow(windowId: string): void {
      context.permissions?.close(windowId);
      extensions.destroyWindow(windowId);
      for (const [key] of subscriptions) {
        if (key.startsWith(`${windowId}:`)) {
          subscriptions.delete(key);
          hooks.relayPool?.untrackSubscription(key);
        }
      }
      incRuntime.destroyWindow(windowId);
      notifyServiceWindowDestroyed(windowId, serviceRegistry);
    },
    get sessionRegistry() { return sessionRegistry; },
    get aclState() { return aclState; },
    get firewallState() { return firewallState; },
    get permissions() { return context.permissions?.management; },
    get manifestCache() { return manifestCache; },
  };
}

function createRuntimePermissions(
  hooks: RuntimeAdapter, sessionRegistry: SessionRegistry, aclState: AclStateContainer,
  subscriptions: Map<string, SubscriptionEntry>, serviceRegistry: ServiceRegistry, getIncRuntime: () => IncRuntime | null,
  revokeExtension: (windowId: string) => void,
) {
  return createPermissionRuntime({
    adapter: hooks.permissions!,
    createId: () => hooks.crypto.randomUUID(),
    getSession: (windowId) => sessionRegistry.getEntryByWindowId(windowId),
    focused: (windowId) => hooks.getFocusContext?.(windowId).focused ?? true,
    allowed(windowId, requirements, phase) {
      const entry = sessionRegistry.getEntryByWindowId(windowId);
      if (!entry || aclState.isBlocked('', entry.dTag, entry.aggregateHash)) return false;
      return requirements.every((requirement) => {
        if (phase === 'operation' && hooks.isDomainAllowed && !hooks.isDomainAllowed(windowId, requirement.domain)) return false;
        if (requirement.category === 'interface') return true;
        const capability = resolveCapabilitiesNap({ type: requirement.operation }).senderCap;
        return !capability || aclState.check('', entry.dTag, entry.aggregateHash, capability as Capability);
      });
    },
    invalidate(windowId) {
      const windows = windowId === undefined ? sessionRegistry.getAllEntries().map((entry) => entry.windowId) : [windowId];
      for (const id of windows) {
        revokeExtension(id);
        revokeRelaySubscriptions({ hooks, serviceRegistry, subscriptions }, id);
        getIncRuntime()?.revokeWindow(id);
        notifyServicePermissionRevoked(id, serviceRegistry);
      }
    },
  });
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
  const firewallState = createFirewallState(hooks.firewallPersistence);
  let extensions: ReturnType<typeof createServiceExtensionRouter> | undefined;
  let permissions: ReturnType<typeof createPermissionRuntime> | undefined;
  const sessionRegistry = createSessionRegistry(hooks.onPendingUpdate, (windowId) => {
    firewallState.resetInitBudget(windowId);
    extensions?.destroyWindow(windowId);
    permissions?.retire(windowId);
    if (hooks.permissions) notifyServiceWindowDestroyed(windowId, serviceRegistry);
  }, (windowId) => {
    permissions?.retire(windowId);
    if (hooks.permissions) notifyServiceWindowDestroyed(windowId, serviceRegistry);
  });
  let incRuntime: IncRuntime | null = null;
  const aclState = createAclState(hooks.aclPersistence, 'permissive', (mutation) => {
    for (const entry of sessionRegistry.getAllEntries()) {
      if (entry.dTag === mutation.dTag && entry.aggregateHash === mutation.aggregateHash) {
        permissions?.cancelWindow(entry.windowId);
      }
    }
    if (mutation.type === 'revoke' && mutation.capability !== 'relay:read') return;
    for (const entry of sessionRegistry.getAllEntries()) {
      if (entry.dTag === mutation.dTag && entry.aggregateHash === mutation.aggregateHash) {
        revokeRelaySubscriptions({ hooks, serviceRegistry, subscriptions }, entry.windowId);
        incRuntime?.revokeWindow(entry.windowId);
      }
    }
  });
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

  const enforceNap = createNapEnforceGate({
    checkAcl: (pubkey, dTag, aggregateHash, capability) =>
      aclState.check(pubkey, dTag, aggregateHash, capability),
    resolveIdentityByWindowId: (windowId) => {
      const entry = sessionRegistry.getEntryByWindowId(windowId);
      return entry
        ? { dTag: entry.dTag, aggregateHash: entry.aggregateHash }
        : undefined;
    },
    onAclCheck: hooks.onAclCheck,
  });

  if (hooks.permissions) {
    permissions = createRuntimePermissions(hooks, sessionRegistry, aclState, subscriptions, serviceRegistry, () => incRuntime,
      (windowId) => extensions?.revokeWindow(windowId));
  }

  incRuntime = createIncRuntime(
    hooks,
    sessionRegistry,
    (targetWindowId, message) => enforceNap(targetWindowId, 'relay:read', message).allowed,
  );

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

  const domainHandlers = createRuntimeDomainHandlers({ hooks, serviceRegistry, sessionRegistry, aclState });
  const napHandlers: RuntimeNapHandlers = {
    relay: createRelayHandler({ hooks, serviceRegistry, subscriptions, eventBuffer, replayDetector,
      canReadRelay(windowId) {
        const entry = sessionRegistry.getEntryByWindowId(windowId);
        return !!entry && aclState.check('', entry.dTag, entry.aggregateHash, 'relay:read');
      },
      authorizeOperation: permissions ? (windowId, operation, requirements, execute, signal) =>
        permissions.run(windowId, operation, requirements,
          () => !!sessionRegistry.getEntryByWindowId(windowId), execute, 'operation', signal) : undefined,
    }),
    identity: createIdentityHandler({ hooks, serviceRegistry }),
    count: createCountHandler({ hooks, serviceRegistry }),
    inc: incRuntime.handleMessage,
    ...domainHandlers,
  };
  const dispatchNapEnvelope = createNapEnvelopeDispatcher(napHandlers);
  // Shell is adapter-owned; signer is intentionally retired by NIP-5D.
  const builtInDomains = new Set([...Object.keys(napHandlers), 'shell', 'signer']);
  extensions = createServiceExtensionRouter({
    hooks, services: serviceRegistry, registrations: registeredServices,
    sessions: sessionRegistry, acl: aclState, enforce: enforceNap, firewall: firewallGate, permissions,
  });
  const handleMessage = createMessageHandler(hooks, sessionRegistry, enforceNap, dispatchNapEnvelope, { builtInDomains, extensions }, firewallGate, permissions);

  return createRuntimeInstance({
    hooks,
    serviceRegistry,
    registeredServices,
    replayDetector,
    subscriptions,
    eventBuffer,
    incRuntime,
    sessionRegistry,
    aclState,
    firewallState,
    manifestCache,
    consentHandlerRef,
    handleMessage,
    extensions,
    permissions,
  });
}
