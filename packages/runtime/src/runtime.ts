/**
 * runtime.ts — The napplet protocol engine factory.
 *
 * createRuntime(hooks) creates the complete protocol engine that handles
 * NIP-5D NUB domain dispatch, ACL enforcement, subscription lifecycle,
 * signer proxying, and shell command routing.
 *
 * No browser APIs. No DOM. No localStorage. No postMessage.
 * All I/O is delegated to RuntimeAdapter.
 */

import type { NostrEvent, NostrFilter, NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: Capability, BusKind, ALL_CAPABILITIES removed
// from @napplet/core v0.2.0+ (napplet phase-87). Sourced from local core-compat shim.
import type { Capability } from './core-compat.js';
import { BusKind, ALL_CAPABILITIES } from './core-compat.js';

// NUB message types — types-only imports from @napplet/nub-* peer deps (v1.2).
// Phase 11-02 / DRIFT-CORE-05: replaces hand-copied widening casts with real
// upstream unions. Phase 12 handler rewrites will narrow per-branch (DRIFT-RT-08/09).
import type { StorageMessage } from '@napplet/nub-storage';
import type { IfcMessage } from '@napplet/nub-ifc';
import type { RelayNubMessage } from '@napplet/nub-relay';
/** Alias to match the canonical nub-relay union name used by callers (`RelayMessage` is
 *  the base interface; `RelayNubMessage` is the full discriminated union). */
type RelayMessage = RelayNubMessage;

// Timer globals are available in all JS runtimes (Node.js, Deno, Bun, browsers)
// but not included in the ES2022 lib. Declare them to avoid needing DOM lib.
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;
import type {
  RuntimeAdapter, ConsentRequest, ConsentHandler,
  ServiceHandler, ServiceRegistry, CompatibilityReport, ServiceInfo,
} from './types.js';
import { routeServiceMessage, notifyServiceWindowDestroyed } from './service-dispatch.js';
import { createServiceDiscoveryEvent } from './service-discovery.js';
import { createSessionRegistry } from './session-registry.js';
import type { SessionRegistry } from './session-registry.js';
import { createAclState } from './acl-state.js';
import type { AclStateContainer } from './acl-state.js';
import { createManifestCache } from './manifest-cache.js';
import type { ManifestCache } from './manifest-cache.js';
import { createReplayDetector } from './replay.js';
import { createEventBuffer, matchesAnyFilter, RING_BUFFER_SIZE } from './event-buffer.js';
import type { SubscriptionEntry } from './event-buffer.js';
import { createEnforceGate, createNubEnforceGate, resolveCapabilities, resolveCapabilitiesNub, formatDenialReason } from './enforce.js';
import type { NubEnforceConfig } from './enforce.js';
import { handleStorageNub } from './state-handler.js';

// ─── Runtime Interface ─────────────────────────────────────────────────────

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

// ─── Factory ───────────────────────────────────────────────────────────────

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
  // ─── Module-level state ──────────────────────────────────────────────────

  const subscriptions = new Map<string, SubscriptionEntry>();
  /** IFC topic subscriptions: Map<topic, Set<windowId>> */
  const ifcSubscriptions = new Map<string, Set<string>>();
  let _consentHandler: ConsentHandler | null = null;

  // ─── Service Registry (static from hooks + dynamic from registerService) ──
  const serviceRegistry: ServiceRegistry = { ...(hooks.services ?? {}) };

  // ─── Registered Services (for compatibility checks) ───────────────────────
  // Tracks service name → ServiceInfo for compatibility checks (Phase 22).
  // Populated by registerService / unregisterService.
  const registeredServices = new Map<string, ServiceInfo>();
  // Pre-populate from static hooks.services
  for (const [name, handler] of Object.entries(serviceRegistry)) {
    registeredServices.set(name, {
      name: handler.descriptor.name,
      version: handler.descriptor.version,
      description: handler.descriptor.description,
    });
  }

  // ─── Undeclared Service Consent Cache (Phase 22) ──────────────────────────
  /** Tracks consented undeclared service usage per session: "windowId:serviceName" */
  const undeclaredServiceConsents = new Set<string>();

  // ─── Sub-module instances ────────────────────────────────────────────────

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
      return entry ? { dTag: entry.dTag, aggregateHash: entry.aggregateHash } : undefined;
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

  // Load persisted state
  aclState.load();
  manifestCache.load();

  // ─── Compatibility Check (Phase 22) ─────────────────────────────────────

  /**
   * Check if a napplet's declared service requirements are satisfied.
   * Called after session establishment but before message dispatch.
   *
   * Returns true if compatible (or permissive mode allows loading).
   * Returns false only in strict mode when required services are missing.
   */
  function checkCompatibility(
    requires: string[],
    windowId: string,
    eventId: string,
  ): boolean {
    if (requires.length === 0) return true;

    const available: ServiceInfo[] = Array.from(registeredServices.values());
    const registeredNames = new Set(registeredServices.keys());
    const missing = requires.filter((name) => !registeredNames.has(name));
    const compatible = missing.length === 0;

    if (!compatible) {
      const report: CompatibilityReport = { available, missing, compatible };
      hooks.onCompatibilityIssue?.(report);

      if (hooks.strictMode) {
        hooks.sendToNapplet(windowId, [
          'OK', eventId, false,
          `blocked: missing required services: ${missing.join(', ')}`,
        ]);
        return false;
      }
    }

    return true;
  }

  // ─── Undeclared Service Check (Phase 22) ──────────────────────────────────

  /**
   * Check if a napplet is using a service it did not declare in its manifest.
   * If undeclared, raises a consent request via the consent handler.
   *
   * Returns true if the service is declared or consent was previously granted.
   * Returns false if consent is needed (async — caller must wait for resolve).
   * Calls onApproved when consent is granted, allowing the caller to proceed.
   */
  function checkUndeclaredService(
    windowId: string,
    pubkey: string,
    serviceName: string,
    event: NostrEvent,
    onApproved: () => void,
  ): boolean {
    // If the service is not registered, this is not our concern — let normal dispatch handle it
    if (!registeredServices.has(serviceName)) return true;

    // Look up the napplet's declared requires via two-step registry lookup
    const nappletPubkey = sessionRegistry.getPubkey(windowId);
    if (!nappletPubkey) return true; // No identity yet — skip check
    const nappletEntry = sessionRegistry.getEntry(nappletPubkey);
    if (!nappletEntry) return true;

    const requires = manifestCache.getRequires(nappletEntry.pubkey, nappletEntry.dTag);

    // If the service IS declared in requires, no consent needed
    if (requires.includes(serviceName)) return true;

    // Check consent cache — already approved this session
    const consentKey = `${windowId}:${serviceName}`;
    if (undeclaredServiceConsents.has(consentKey)) return true;

    // Raise consent request
    if (_consentHandler) {
      _consentHandler({
        type: 'undeclared-service',
        windowId,
        pubkey,
        event,
        serviceName,
        resolve: (allowed: boolean) => {
          if (allowed) {
            undeclaredServiceConsents.add(consentKey);
            onApproved();
          }
          // If denied, event is silently dropped
        },
      });
      return false; // Async — caller should not proceed synchronously
    }

    // No consent handler registered — silently drop undeclared service usage
    return false;
  }

  // ─── Hotkey Forward Handler ──────────────────────────────────────────────

  function handleHotkeyForward(event: NostrEvent): void {
    const keyData = {
      key: event.tags?.find((t) => t[0] === 'key')?.[1] ?? '',
      code: event.tags?.find((t) => t[0] === 'code')?.[1] ?? '',
      ctrlKey: event.tags?.find((t) => t[0] === 'ctrl')?.[1] === '1',
      altKey: event.tags?.find((t) => t[0] === 'alt')?.[1] === '1',
      shiftKey: event.tags?.find((t) => t[0] === 'shift')?.[1] === '1',
      metaKey: event.tags?.find((t) => t[0] === 'meta')?.[1] === '1',
    };
    hooks.hotkeys.executeHotkeyFromForward(keyData);
  }

  // ─── Shell Command Handler ───────────────────────────────────────────────

  function handleShellCommand(event: NostrEvent, windowId: string, topic: string): void {
    function sendOk(success: boolean, reason: string): void {
      hooks.sendToNapplet(windowId, ['OK', event.id, success, reason]);
    }

    function sendInterPaneReply(replyTopic: string, content: string): void {
      const responseEvent: Partial<NostrEvent> = {
        kind: BusKind.IPC_PEER, pubkey: '',
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', replyTopic]], content, id: '', sig: '',
      };
      hooks.sendToNapplet(windowId, ['EVENT', '__shell__', responseEvent]);
      sendOk(true, '');
    }

    switch (topic) {
      case 'shell:acl-get': {
        const aclEntries = aclState.getAllEntries();
        const nappletEntries = sessionRegistry.getAllEntries();
        const nappletInfoMap: Record<string, { type: string; registeredAt: number }> = {};
        for (const e of nappletEntries) nappletInfoMap[e.pubkey] = { type: e.type, registeredAt: e.registeredAt };
        const merged = [...aclEntries];
        for (const e of nappletEntries) {
          if (!merged.find((a) => a.pubkey === e.pubkey)) {
            merged.push({ pubkey: e.pubkey, capabilities: [...ALL_CAPABILITIES], blocked: false });
          }
        }
        const display = merged.map((e) => ({
          ...e, type: nappletInfoMap[e.pubkey]?.type ?? 'unknown',
          registeredAt: nappletInfoMap[e.pubkey]?.registeredAt ?? 0,
        }));
        sendInterPaneReply('shell:acl-current', JSON.stringify({ entries: display }));
        break;
      }
      case 'shell:acl-revoke': case 'shell:acl-grant': case 'shell:acl-block': case 'shell:acl-unblock': {
        const pk = event.tags?.find((t) => t[0] === 'pubkey')?.[1];
        const cap = event.tags?.find((t) => t[0] === 'cap')?.[1];
        if (!pk) { sendOk(false, 'error: missing pubkey tag'); break; }
        const ne = sessionRegistry.getEntry(pk);
        if (topic === 'shell:acl-revoke' && cap) aclState.revoke(pk, ne?.dTag ?? '', ne?.aggregateHash ?? '', cap as Capability);
        else if (topic === 'shell:acl-grant' && cap) aclState.grant(pk, ne?.dTag ?? '', ne?.aggregateHash ?? '', cap as Capability);
        else if (topic === 'shell:acl-block') aclState.block(pk, ne?.dTag ?? '', ne?.aggregateHash ?? '');
        else if (topic === 'shell:acl-unblock') aclState.unblock(pk, ne?.dTag ?? '', ne?.aggregateHash ?? '');
        aclState.persist();
        const ae = aclState.getEntry(pk, ne?.dTag ?? '', ne?.aggregateHash ?? '');
        sendInterPaneReply('shell:acl-current', JSON.stringify({ entries: ae ? [ae] : [] }));
        break;
      }
      case 'shell:relay-get':
        sendInterPaneReply('shell:relay-current', JSON.stringify(hooks.relayConfig.getRelayConfig()));
        break;
      case 'shell:relay-add': {
        const tier = event.tags?.find((t) => t[0] === 'tier')?.[1];
        const url = event.tags?.find((t) => t[0] === 'url')?.[1];
        if (tier && url) { hooks.relayConfig.addRelay(tier, url); sendInterPaneReply('shell:relay-current', JSON.stringify(hooks.relayConfig.getRelayConfig())); }
        else sendOk(false, 'error: missing tier/url');
        break;
      }
      case 'shell:relay-remove': {
        const tier = event.tags?.find((t) => t[0] === 'tier')?.[1];
        const url = event.tags?.find((t) => t[0] === 'url')?.[1];
        if (tier && url) { hooks.relayConfig.removeRelay(tier, url); sendInterPaneReply('shell:relay-current', JSON.stringify(hooks.relayConfig.getRelayConfig())); }
        else sendOk(false, 'error: missing tier/url');
        break;
      }
      case 'shell:relay-nip66':
        sendInterPaneReply('shell:relay-nip66-data', JSON.stringify(hooks.relayConfig.getNip66Suggestions()));
        break;
      case 'shell:relay-scoped-connect': {
        const url = event.tags?.find((t) => t[0] === 'url')?.[1];
        const subId = event.tags?.find((t) => t[0] === 'sub-id')?.[1];
        const filtersTag = event.tags?.find((t) => t[0] === 'filters')?.[1];
        if (!url || !subId || !filtersTag) { sendOk(false, 'error: missing tags'); break; }
        try {
          const filters = JSON.parse(filtersTag) as NostrFilter[];
          hooks.relayPool?.openScopedRelay(windowId, url, subId, filters, hooks.sendToNapplet);
          sendOk(true, '');
        } catch { sendOk(false, 'error: invalid filters'); }
        break;
      }
      case 'shell:relay-scoped-close':
        hooks.relayPool?.closeScopedRelay(windowId);
        sendOk(true, '');
        break;
      case 'shell:relay-scoped-publish': {
        const et = event.tags?.find((t) => t[0] === 'event')?.[1];
        if (!et) { sendOk(false, 'error: missing event tag'); break; }
        try {
          const signed = JSON.parse(et) as NostrEvent;
          const ok = hooks.relayPool?.publishToScopedRelay(windowId, signed) ?? false;
          sendOk(ok, ok ? '' : 'error: no active scoped relay');
        } catch { sendOk(false, 'error: invalid event JSON'); }
        break;
      }
      case 'shell:create-window': {
        try {
          const payload = JSON.parse(event.content) as { title?: string; class?: string; iframeSrc?: string };
          if (!payload.title || !payload.class) { sendOk(false, 'error: requires title and class'); break; }
          const id = hooks.windowManager.createWindow({ title: payload.title, class: payload.class, iframeSrc: payload.iframeSrc });
          sendOk(!!id, id ? '' : 'error: window creation failed');
        } catch { sendOk(false, 'error: invalid JSON'); }
        break;
      }
      case 'shell:send-dm': {
        if (hooks.dm) {
          const corrId = event.tags?.find((t) => t[0] === 'id')?.[1] ?? '';
          const recipient = event.tags?.find((t) => t[0] === 'p')?.[1];
          let message: string | undefined;
          try { message = JSON.parse(event.content).message; } catch { /* Malformed DM content */ }
          if (!recipient || !message) { sendOk(false, 'error: missing recipient or message'); break; }
          hooks.dm.sendDm(recipient, message).then((result) => {
            const payload = result.success
              ? { success: true, ...(result.eventId ? { eventId: result.eventId } : {}) }
              : { success: false, error: result.error ?? 'unknown error' };
            const response: Partial<NostrEvent> = {
              kind: BusKind.IPC_PEER, pubkey: '',
              created_at: Math.floor(Date.now() / 1000),
              tags: [['t', 'shell:send-dm-result'], ['id', corrId]],
              content: JSON.stringify(payload), id: '', sig: '',
            };
            hooks.sendToNapplet(windowId, ['EVENT', '__shell__', response]);
            sendOk(result.success, result.success ? '' : `error: ${result.error}`);
          }).catch(() => { sendOk(false, 'error: DM send failed'); });
        } else sendOk(false, 'error: DM hooks not configured');
        break;
      }
      default:
        sendOk(true, '');
        break;
    }
  }

  // ─── NUB Domain Handlers (NIP-5D envelope dispatch) ──────────────────────

  function handleRelayMessage(windowId: string, msg: NappletMessage): void {
    // DRIFT-RT-08 — Phase 12: handler dispatches by sub-action string rather than by
    // msg.type discriminant, so we widen to `unknown` through RelayMessage and
    // access fields per-branch. Phase 12 handler rewrite narrows each case against
    // the canonical RelayNubMessage discriminant union.
    const m = msg as unknown as RelayMessage & {
      subId?: string;
      filters?: NostrFilter[];
      event?: NostrEvent;
      id?: string;
    };
    const dotIdx = msg.type.indexOf('.');
    const action = msg.type.slice(dotIdx + 1);

    switch (action) {
      case 'subscribe': {
        const subId = m.subId ?? '';
        const filters = m.filters ?? [];
        if (!subId) return;

        const subKey = `${windowId}:${subId}`;
        subscriptions.set(subKey, { windowId, filters });

        const seenIds = new Set<string>();
        function deliver(event: NostrEvent): void {
          if (seenIds.has(event.id)) return;
          seenIds.add(event.id);
          if (subscriptions.has(subKey)) {
            hooks.sendToNapplet(windowId, { type: 'relay.event', subId, event } as NappletMessage);
          }
        }

        // Replay buffered events
        for (const bufferedEvent of eventBuffer.getBufferedEvents()) {
          if (matchesAnyFilter(bufferedEvent, filters)) deliver(bufferedEvent);
        }

        const isBusKind = filters.length > 0 && filters.every((f) => f.kinds?.every((k) => k >= 29000 && k < 30000));

        // Service dispatch path
        if (!isBusKind) {
          const relayService = serviceRegistry['relay'] ?? serviceRegistry['relay-pool'];
          const cacheService = !serviceRegistry['relay'] ? serviceRegistry['cache'] : undefined;

          if (relayService) {
            relayService.handleMessage(windowId, msg, (resp: NappletMessage) => {
              if (!subscriptions.has(subKey)) return;
              hooks.sendToNapplet(windowId, resp);
            });
            if (cacheService) cacheService.handleMessage(windowId, msg, (resp: NappletMessage) => {
              if (!subscriptions.has(subKey)) return;
              hooks.sendToNapplet(windowId, resp);
            });
            return;
          }
        }

        // Fallback: internal relay pool + cache hooks
        const cache = hooks.cache;
        if (cache?.isAvailable() && !isBusKind) {
          cache.query(filters)
            .then((cachedEvents) => { for (const event of cachedEvents) deliver(event); })
            .catch(() => {});
        }

        const pool = hooks.relayPool;
        if (pool?.isAvailable() && !isBusKind) {
          const relayUrls = pool.selectRelayTier(filters);
          let eoseSent = false;
          const eoseFallbackTimer = setTimeout(() => {
            if (!eoseSent) { eoseSent = true; hooks.sendToNapplet(windowId, { type: 'relay.eose', subId } as NappletMessage); }
          }, 15_000);

          const subscription = pool.subscribe(filters, (item) => {
            if (item === 'EOSE') {
              clearTimeout(eoseFallbackTimer);
              if (!eoseSent) { eoseSent = true; hooks.sendToNapplet(windowId, { type: 'relay.eose', subId } as NappletMessage); }
              return;
            }
            deliver(item as NostrEvent);
            if (cache?.isAvailable() && !isBusKind) {
              try { cache.store(item as NostrEvent); } catch { /* best-effort */ }
            }
          }, relayUrls);

          pool.trackSubscription(subKey, () => {
            clearTimeout(eoseFallbackTimer);
            subscription.unsubscribe();
          });
        } else if (!isBusKind) {
          hooks.sendToNapplet(windowId, { type: 'relay.eose', subId } as NappletMessage);
        }
        break;
      }

      case 'close': {
        const subId = m.subId ?? '';
        if (!subId) return;
        const subKey = `${windowId}:${subId}`;
        subscriptions.delete(subKey);

        const relayService = serviceRegistry['relay'] ?? serviceRegistry['relay-pool'];
        if (relayService) {
          relayService.handleMessage(windowId, msg, () => {});
        }
        hooks.relayPool?.untrackSubscription(subKey);
        hooks.sendToNapplet(windowId, { type: 'relay.closed', subId, message: '' } as NappletMessage);
        break;
      }

      case 'publish': {
        const event = m.event;
        const id = m.id ?? '';
        if (!event || typeof event !== 'object') {
          hooks.sendToNapplet(windowId, { type: 'relay.publish.error', id, error: 'invalid event' } as NappletMessage);
          return;
        }

        const replayResult = replayDetector.check(event);
        if (replayResult !== null) {
          hooks.sendToNapplet(windowId, { type: 'relay.publish.result', id, accepted: false, message: replayResult } as NappletMessage);
          return;
        }

        const relayService = serviceRegistry['relay'] ?? serviceRegistry['relay-pool'];
        if (relayService) {
          relayService.handleMessage(windowId, msg, (resp: NappletMessage) => {
            hooks.sendToNapplet(windowId, resp);
          });
        } else if (hooks.relayPool?.isAvailable()) {
          hooks.relayPool.publish(event);
          hooks.sendToNapplet(windowId, { type: 'relay.publish.result', id, accepted: true } as NappletMessage);
        } else {
          hooks.sendToNapplet(windowId, { type: 'relay.publish.result', id, accepted: false, message: 'no relay pool available' } as NappletMessage);
        }

        // Buffer and deliver to local subscribers
        eventBuffer.bufferAndDeliver(event, windowId);
        break;
      }

      case 'query': {
        const id = m.id ?? '';
        const filters = m.filters ?? [];
        let count = 0;
        for (const event of eventBuffer.getBufferedEvents()) {
          if (matchesAnyFilter(event, filters)) count++;
        }
        hooks.sendToNapplet(windowId, { type: 'relay.query.result', id, count } as NappletMessage);
        break;
      }

      default: break;
    }
  }

  // DRIFT-RT-07 — Phase 12: delete handleSignerMessage; encryption primitives become private helpers called by handleRelayMessage for relay.publishEncrypted
  function handleSignerMessage(windowId: string, msg: NappletMessage): void {
    // DRIFT-RT-07 — Phase 12: handleSignerMessage deleted; signer domain dissolved into identity + relay.publishEncrypted
    const m = msg as any;
    const id = (m.id as string) ?? '';
    // Extract action: for 'signer.nip04.encrypt' -> 'nip04.encrypt'
    const action = msg.type.split('.').slice(1).join('.');

    function sendError(error: string): void {
      hooks.sendToNapplet(windowId, { type: `${msg.type}.error`, id, error } as NappletMessage);
    }

    function sendResult(payload: Record<string, unknown>): void {
      hooks.sendToNapplet(windowId, { type: `${msg.type}.result`, id, ...payload } as NappletMessage);
    }

    // Signer service takes priority if registered
    // DRIFT-RT-10 — Phase 12: remove signer service-registry branch (tied to DRIFT-RT-07 handleSignerMessage deletion)
    const signerService = serviceRegistry['signer'];
    if (signerService) {
      signerService.handleMessage(windowId, msg, (resp: NappletMessage) => {
        hooks.sendToNapplet(windowId, resp);
      });
      return;
    }

    // Internal signer fallback
    const maybeSigner = hooks.auth.getSigner();
    if (!maybeSigner) { sendError('no signer configured'); return; }
    const signer = maybeSigner;

    function dispatch(eventToSign: NostrEvent | null): void {
      const signerPromise: Promise<unknown> = (() => {
        switch (action) {
          case 'getPublicKey': return Promise.resolve(signer.getPublicKey?.());
          case 'signEvent': return eventToSign ? (signer.signEvent?.(eventToSign) ?? Promise.resolve(null)) : Promise.resolve(null);
          case 'getRelays': return Promise.resolve(signer.getRelays?.() ?? {});
          case 'nip04.encrypt': return signer.nip04?.encrypt(m.pubkey ?? '', m.plaintext ?? '') ?? Promise.resolve('');
          case 'nip04.decrypt': return signer.nip04?.decrypt(m.pubkey ?? '', m.ciphertext ?? '') ?? Promise.resolve('');
          case 'nip44.encrypt': return signer.nip44?.encrypt(m.pubkey ?? '', m.plaintext ?? '') ?? Promise.resolve('');
          case 'nip44.decrypt': return signer.nip44?.decrypt(m.pubkey ?? '', m.ciphertext ?? '') ?? Promise.resolve('');
          default: return Promise.reject(new Error(`Unknown signer method: ${action}`));
        }
      })();

      signerPromise.then((result) => {
        switch (action) {
          case 'getPublicKey':
            sendResult({ pubkey: result as string }); break;
          case 'signEvent':
            sendResult({ event: result as NostrEvent }); break;
          case 'getRelays':
            sendResult({ relays: result as Record<string, { read: boolean; write: boolean }> }); break;
          case 'nip04.encrypt':
          case 'nip44.encrypt':
            sendResult({ ciphertext: result as string }); break;
          case 'nip04.decrypt':
          case 'nip44.decrypt':
            sendResult({ plaintext: result as string }); break;
          default:
            sendResult({ value: result }); break;
        }
      }).catch((err: unknown) => {
        sendError((err as Error).message ?? 'signing failed');
      });
    }

    // Consent check for destructive signing kinds
    if (action === 'signEvent' && m.event) {
      const eventToSign = m.event as NostrEvent;
      if (aclState.requiresPrompt(eventToSign.kind) && _consentHandler) {
        new Promise<boolean>((resolve) => {
          _consentHandler!({ windowId, pubkey: '', event: eventToSign, resolve });
        }).then((allowed) => {
          if (!allowed) { sendError('user rejected'); return; }
          dispatch(eventToSign);
        }).catch(() => { sendError('consent check failed'); });
        return;
      }
      dispatch(eventToSign);
      return;
    }
    dispatch(null);
  }

  function handleStorageMessage(windowId: string, msg: NappletMessage): void {
    handleStorageNub(windowId, msg, hooks.sendToNapplet, sessionRegistry, aclState, hooks.statePersistence);
  }

  function handleIfcMessage(windowId: string, msg: NappletMessage): void {
    // DRIFT-RT-09 — Phase 12: ifc.channel.* sub-protocol unhandled today; handler
    // dispatches by sub-action rather than by msg.type discriminant. Widen through
    // IfcMessage with per-branch optional fields until Phase 12 adds channel routing.
    const m = msg as unknown as IfcMessage & {
      topic?: string;
      payload?: unknown;
    };
    const dotIdx = msg.type.indexOf('.');
    const action = msg.type.slice(dotIdx + 1);

    switch (action) {
      case 'emit': {
        const topic = m.topic ?? '';
        const payload = m.payload;
        if (!topic) return;

        // Deliver to all subscribers of this topic except sender
        const subscribers = ifcSubscriptions.get(topic);
        if (subscribers) {
          for (const subscriberWindowId of subscribers) {
            if (subscriberWindowId === windowId) continue; // don't echo to sender
            hooks.sendToNapplet(subscriberWindowId, { type: 'ifc.event', topic, payload, sender: windowId } as NappletMessage);
          }
        }
        break;
      }
      case 'subscribe': {
        const topic = m.topic ?? '';
        if (!topic) return;
        let subs = ifcSubscriptions.get(topic);
        if (!subs) { subs = new Set(); ifcSubscriptions.set(topic, subs); }
        subs.add(windowId);
        break;
      }
      case 'unsubscribe': {
        const topic = m.topic ?? '';
        if (!topic) return;
        const subs = ifcSubscriptions.get(topic);
        if (subs) {
          subs.delete(windowId);
          if (subs.size === 0) ifcSubscriptions.delete(topic);
        }
        break;
      }
      default: break;
    }
  }

  function handleMediaMessage(windowId: string, msg: NappletMessage): void {
    const mediaService = serviceRegistry['media'];
    if (mediaService) {
      mediaService.handleMessage(windowId, msg, (resp: NappletMessage) => {
        hooks.sendToNapplet(windowId, resp);
      });
      return;
    }
    // Fallback: emit spec-correct result for media.session.create so napplets
    // get an envelope even without a registered media service. Other media.*
    // actions are fire-and-forget per @napplet/nub-media and silently dropped.
    if (msg.type === 'media.session.create') {
      const m = msg as NappletMessage & { id?: string; sessionId?: string };
      hooks.sendToNapplet(windowId, {
        type: 'media.session.create.result',
        id: m.id ?? '',
        sessionId: m.sessionId ?? '',
      } as NappletMessage);
    }
  }

  function handleKeysMessage(windowId: string, msg: NappletMessage): void {
    const keysService = serviceRegistry['keys'];
    if (keysService) {
      keysService.handleMessage(windowId, msg, (resp: NappletMessage) => {
        hooks.sendToNapplet(windowId, resp);
      });
      return;
    }

    // Fallback: route keys.forward directly to hooks.hotkeys.executeHotkeyFromForward
    // so existing hosts continue to receive forwarded hotkeys even without a registered
    // 'keys' service. Translates wire-shape (ctrl/alt/shift/meta) -> DOM-shape
    // (ctrlKey/altKey/shiftKey/metaKey) to match the HotkeyAdapter contract.
    if (msg.type === 'keys.forward') {
      const m = msg as NappletMessage & {
        key?: string; code?: string;
        ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean;
      };
      hooks.hotkeys.executeHotkeyFromForward({
        key: m.key ?? '',
        code: m.code ?? '',
        ctrlKey: !!m.ctrl,
        altKey: !!m.alt,
        shiftKey: !!m.shift,
        metaKey: !!m.meta,
      });
      return;
    }

    // Fallback: emit spec-correct keys.registerAction.result so napplets see a
    // reply envelope even without a 'keys' service. Echoes the action.defaultKey
    // as the binding hint (stub behavior — real shell-side bindings arrive later
    // via DRIFT-SHELL-06 keys-forwarder / future shell push path).
    if (msg.type === 'keys.registerAction') {
      const m = msg as NappletMessage & {
        id?: string; action?: { id: string; defaultKey?: string };
      };
      hooks.sendToNapplet(windowId, {
        type: 'keys.registerAction.result',
        id: m.id ?? '',
        actionId: m.action?.id ?? '',
        ...(m.action?.defaultKey ? { binding: m.action.defaultKey } : {}),
      } as NappletMessage);
      return;
    }

    // keys.unregisterAction: fire-and-forget per @napplet/nub-keys — nothing to emit.
    // Unknown keys.* sub-actions: silently drop (spec-consistent with default branch).
  }

  function handleNotifyMessage(windowId: string, msg: NappletMessage): void {
    const notifyService = serviceRegistry['notify'];
    if (notifyService) {
      notifyService.handleMessage(windowId, msg, (resp: NappletMessage) => {
        hooks.sendToNapplet(windowId, resp);
      });
      return;
    }
    // Fallback: emit spec-correct result envelopes for notify.send and
    // notify.permission.request so napplets see a reply even without a
    // registered 'notify' service. Other actions (dismiss/badge/channel.register)
    // are fire-and-forget per @napplet/nub-notify and produce no envelope.
    if (msg.type === 'notify.send') {
      const m = msg as NappletMessage & { id?: string };
      hooks.sendToNapplet(windowId, {
        type: 'notify.send.result',
        id: m.id ?? '',
        notificationId: `shell-${Date.now()}`,
      } as NappletMessage);
    } else if (msg.type === 'notify.permission.request') {
      const m = msg as NappletMessage & { id?: string };
      hooks.sendToNapplet(windowId, {
        type: 'notify.permission.result',
        id: m.id ?? '',
        granted: true,
      } as NappletMessage);
    }
  }

  // ─── Main message handler ────────────────────────────────────────────────

  function handleMessage(windowId: string, msg: unknown): void {
    // NIP-5D envelope-only dispatch — no legacy array support (clean break)
    if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;
    const envelope = msg as NappletMessage;
    const dotIdx = envelope.type.indexOf('.');
    if (dotIdx === -1) return; // malformed type — no domain.action

    const domain = envelope.type.slice(0, dotIdx);

    // ACL enforcement: resolve capability requirement, enforce if non-null
    const caps = resolveCapabilitiesNub(envelope);
    if (caps.senderCap) {
      const result = enforceNub(windowId, caps.senderCap as Capability, envelope);
      if (!result.allowed) {
        const id = (envelope as NappletMessage & { id?: string }).id ?? '';
        hooks.sendToNapplet(windowId, { type: `${envelope.type}.error`, id, error: formatDenialReason(result.capability) } as NappletMessage);
        return;
      }
    }

    switch (domain) {
      case 'relay':   return handleRelayMessage(windowId, envelope);
      // DRIFT-RT-06 — Phase 12: remove case 'signer'; canonical NIP-5D has no signer domain (split into identity + shell-internal signing)
      case 'signer':  return handleSignerMessage(windowId, envelope);
      case 'keys':    return handleKeysMessage(windowId, envelope);
      case 'media':   return handleMediaMessage(windowId, envelope);
      case 'notify':  return handleNotifyMessage(windowId, envelope);
      case 'storage': return handleStorageMessage(windowId, envelope);
      case 'ifc':     return handleIfcMessage(windowId, envelope);
      default:        return; // unknown domain — silently drop per NIP-5D spec
    }
  }

  // ─── Public interface ────────────────────────────────────────────────────

  const runtimeInstance: Runtime = {
    handleMessage,

    injectEvent(topic: string, payload: unknown): void {
      const uuid = hooks.crypto.randomUUID().replace(/-/g, '').slice(0, 64).padEnd(64, '0');
      const event: NostrEvent = {
        id: uuid,
        pubkey: '0'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: BusKind.IPC_PEER,
        tags: [['t', topic]],
        content: JSON.stringify(payload),
        sig: '0'.repeat(128),
      };
      eventBuffer.bufferAndDeliver(event, null);
    },

    destroy(): void {
      manifestCache.persist();
      aclState.persist();
      replayDetector.clear();
      subscriptions.clear();
      ifcSubscriptions.clear();
      eventBuffer.clear();
      registeredServices.clear();
      undeclaredServiceConsents.clear();
    },

    registerConsentHandler(handler: ConsentHandler): void {
      _consentHandler = handler;
    },

    registerService(name: string, handler: ServiceHandler): void {
      serviceRegistry[name] = handler;
      // Populate registeredServices Map for compatibility checks (Phase 22)
      registeredServices.set(name, {
        name: handler.descriptor.name,
        version: handler.descriptor.version,
        description: handler.descriptor.description,
      });
    },

    unregisterService(name: string): void {
      delete serviceRegistry[name];
      // Remove from registeredServices Map for compatibility checks (Phase 22)
      registeredServices.delete(name);
    },

    destroyWindow(windowId: string): void {
      // Clean up subscriptions for this window
      for (const [key] of subscriptions) {
        if (key.startsWith(`${windowId}:`)) {
          subscriptions.delete(key);
          hooks.relayPool?.untrackSubscription(key);
        }
      }
      // Clean up IFC subscriptions for this window
      for (const [topic, subs] of ifcSubscriptions) {
        subs.delete(windowId);
        if (subs.size === 0) ifcSubscriptions.delete(topic);
      }
      // Notify service handlers
      notifyServiceWindowDestroyed(windowId, serviceRegistry);
    },

    get sessionRegistry() { return sessionRegistry; },
    get aclState() { return aclState; },
    get manifestCache() { return manifestCache; },
  };

  return runtimeInstance;
}
