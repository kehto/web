/// <reference path="./globals.d.ts" />
/**
 * harness.ts -- Shell test harness boot script.
 *
 * Boots @kehto/shell with mock ShellAdapter, installs a message tap,
 * and exposes control functions for Playwright tests.
 *
 * Playwright API:
 *   await page.waitForFunction(() => window.__SHELL_READY__)
 *   await page.evaluate(() => window.__loadNapplet__('nub-identity'))
 *   const msgs = await page.evaluate(() => window.__TEST_MESSAGES__)
 *   await page.evaluate(() => window.__clearMessages__())
 *
 * Window global types are declared in globals.d.ts (Plan 16-03).
 */

import { createShellBridge, originRegistry } from '@kehto/shell';
import type { Capability, SessionEntry } from '@kehto/shell';
import { createKeysService, createMediaService } from '@kehto/services';
import type { NappletMessage } from '@napplet/core';
import { createMockHooks } from '@test/helpers';
import { createMessageTap } from '@test/helpers';

// --- Initialize ---

const mockResult = createMockHooks();
const tap = createMessageTap();

// ─── NIP-5D envelope log (hoisted) ─────────────────────────────────────────
//
// Declared early so the outbound postMessage proxy (below) and the inbound
// message listener (further down) can both record envelopes into the same
// Map. The proxy's postMessage function runs at call-time (not init-time),
// so forward-reference to this const is safe.
//
// Phase 28 E2E-14: both INBOUND (napplet -> shell) and OUTBOUND (shell ->
// napplet via the service send callback) NIP-5D envelopes are recorded here.
// Keyed by windowId.
const envelopeLog = new Map<string, NappletMessage[]>();

// --- Outbound message interception ---
//
// The ShellBridge sends messages to napplets via:
//   1. originRegistry.getIframeWindow(windowId).postMessage() -- for sendChallenge, deliverToSubscriptions
//   2. sourceWindow.postMessage() -- for handleAuth, handleEvent (sourceWindow = event.source)
//
// For cross-origin sandboxed iframes, we can't monkey-patch Window.prototype.postMessage
// because cross-origin windows use their own prototype chain. Instead, we:
//   1. Wrap originRegistry.getIframeWindow to return a postMessage-intercepting Proxy
//   2. Wrap relay.handleMessage to proxy event.source with postMessage interception
//      while keeping a side-channel so originRegistry.getWindowId still resolves

// Map from proxy to real window for origin registry resolution
const proxyToReal = new WeakMap<object, Window>();

function createPostMessageProxy(realWin: Window): Window {
  const proxy = new Proxy(realWin, {
    get(target, prop) {
      if (prop === 'postMessage') {
        return (msg: unknown, targetOrigin: string, transfer?: Transferable[]) => {
          if (Array.isArray(msg)) {
            tap.recordOutbound(msg);
          }
          return target.postMessage(msg, targetOrigin, transfer);
        };
      }
      // For everything else, return the real property
      try {
        const val = (target as any)[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      } catch {
        // Cross-origin property access can throw -- return undefined
        return undefined;
      }
    },
  });
  proxyToReal.set(proxy, realWin);
  return proxy as unknown as Window;
}

// Wrap originRegistry.getIframeWindow to return proxied windows.
// Phase 28 E2E-14: the wrapper also captures outbound NIP-5D object envelopes
// (shell -> napplet via service send callback) into envelopeLog, keyed by
// windowId. Array-format messages (NIP-01) continue to be captured by tap only.
const _origGetIframeWindow = originRegistry.getIframeWindow.bind(originRegistry);
originRegistry.getIframeWindow = (windowId: string): Window | null => {
  const win = _origGetIframeWindow(windowId);
  if (!win) return null;
  // Create a postMessage-intercepting proxy that additionally records outbound
  // NIP-5D object envelopes (non-array with type: string) into envelopeLog.
  const proxy = new Proxy(win, {
    get(target, prop) {
      if (prop === 'postMessage') {
        return (msg: unknown, targetOrigin: string, transfer?: Transferable[]) => {
          if (Array.isArray(msg)) {
            tap.recordOutbound(msg);
          } else if (
            msg !== null && typeof msg === 'object' &&
            typeof (msg as Record<string, unknown>).type === 'string'
          ) {
            // Outbound NIP-5D envelope (service send callback result).
            // Record into envelopeLog keyed by windowId so __getNubMessage__ can
            // retrieve both inbound requests AND outbound response envelopes.
            const clone = JSON.parse(JSON.stringify(msg)) as NappletMessage;
            const arr = envelopeLog.get(windowId) ?? [];
            arr.push(clone);
            envelopeLog.set(windowId, arr);
          }
          return target.postMessage(msg, targetOrigin, transfer);
        };
      }
      // For everything else, return the real property
      try {
        const val = (target as any)[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      } catch {
        // Cross-origin property access can throw -- return undefined
        return undefined;
      }
    },
  });
  proxyToReal.set(proxy, win);
  return proxy as unknown as Window;
};

// Wrap originRegistry.getWindowId to handle both real and proxied windows
const _origGetWindowId = originRegistry.getWindowId.bind(originRegistry);
originRegistry.getWindowId = (win: Window): string | undefined => {
  // First try the real window
  const result = _origGetWindowId(win);
  if (result) return result;
  // If not found, check if it's a proxy and try the real window
  const real = proxyToReal.get(win);
  if (real) return _origGetWindowId(real);
  return undefined;
};

const relay = createShellBridge(mockResult.hooks);

// Install the message tap (captures napplet->shell messages via addEventListener)
tap.install(window);

// Wrap relay.handleMessage to proxy event.source for outbound capture.
const _origHandleMessage = relay.handleMessage;
relay.handleMessage = (event: MessageEvent) => {
  if (!event.source || !Array.isArray(event.data)) {
    _origHandleMessage(event);
    return;
  }

  // Create a proxied version of event.source for postMessage interception
  const proxiedSource = createPostMessageProxy(event.source as Window);

  // Create a synthetic MessageEvent-like object with the proxied source
  const syntheticEvent = new Proxy(event, {
    get(target, prop) {
      if (prop === 'source') return proxiedSource;
      const val = (target as any)[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  _origHandleMessage(syntheticEvent);
};

// Attach the relay's wrapped message handler
window.addEventListener('message', relay.handleMessage);

// --- Napplet Management ---

let nappletCounter = 0;
const nappletFrames = new Map<string, HTMLIFrameElement>();

/**
 * Load a test napplet into a sandboxed iframe.
 * Returns the windowId assigned to this napplet.
 */
function loadNapplet(name: string, params?: Record<string, string>): string {
  const windowId = `test-napplet-${++nappletCounter}`;

  // Build napplet URL -- served from pre-built dist directories via Vite plugin
  let url = `/napplets/${name}/index.html`;
  if (params && Object.keys(params).length > 0) {
    const search = new URLSearchParams(params).toString();
    url += `?${search}`;
  }

  // Create sandboxed iframe (no allow-same-origin -- matches production security model)
  // NIP-5D TIMING NOTE: Do NOT set iframe.src before registering origins. The napplet
  // shim sends postMessages immediately on script execution — before the parent's 'load'
  // event fires. We must have the origin + session registered BEFORE the napplet scripts run.
  // Sequence: create iframe → append (gets contentWindow) → register → set src (triggers load).
  const iframe = document.createElement('iframe');
  iframe.id = windowId;
  iframe.className = 'napplet-frame';
  iframe.sandbox.add('allow-scripts');
  iframe.width = '400';
  iframe.height = '200';

  // Add to DOM first (contentWindow is available immediately after appendChild).
  const container = document.getElementById('frames');
  if (container) container.appendChild(iframe);
  nappletFrames.set(windowId, iframe);

  // NIP-5D session entry factory. Called immediately + on 'load' (in case
  // contentWindow reference changes across navigations in Chromium).
  // Pattern mirrors apps/playground/src/shell-host.ts registerSessionEntry().
  function registerSessionEntry(): void {
    const entry: SessionEntry = {
      pubkey: '',
      windowId,
      origin: 'null',
      type: 'napplet',
      dTag: name,
      aggregateHash: '',
      registeredAt: Date.now(),
      instanceId: crypto.randomUUID(),
      provenance: 'nip-5d',
    };
    relay.runtime.sessionRegistry.register(windowId, entry);
  }

  // Register origin + session BEFORE setting src so the napplet's first
  // postMessages (storage.set, identity.getPublicKey, ifc.subscribe, etc.)
  // are already routable via originRegistry.getWindowId(event.source).
  if (iframe.contentWindow) {
    originRegistry.register(iframe.contentWindow, windowId);
    registerSessionEntry();
  }

  // Re-register on 'load' in case contentWindow reference changes after navigation.
  iframe.addEventListener('load', () => {
    if (iframe.contentWindow) {
      originRegistry.register(iframe.contentWindow, windowId);
      registerSessionEntry();
      logStatus(`Loaded ${name} as ${windowId}, session re-registered`);
    }
  });

  // Set src LAST — triggers navigation and script execution. By this point,
  // origin + session are in registries, so first-message routing works.
  iframe.src = url;

  return windowId;
}

/**
 * Unload a napplet iframe.
 */
function unloadNapplet(windowId: string): void {
  const iframe = nappletFrames.get(windowId);
  if (iframe) {
    originRegistry.unregister(windowId);
    iframe.remove();
    nappletFrames.delete(windowId);
    logStatus(`Unloaded ${windowId}`);
  }
}

// --- Expose to Playwright ---

window.__SHELL_READY__ = true;
window.__TEST_MESSAGES__ = tap.messages;
window.__loadNapplet__ = loadNapplet;
window.__unloadNapplet__ = unloadNapplet;
window.__clearMessages__ = () => tap.clear();
window.__getRelay__ = () => relay;
window.__getMockHooks__ = () => mockResult;

// --- Protocol Control Functions (Phase 3) ---

/**
 * Inject a raw NIP-01 message as if it came from the specified napplet iframe.
 * Constructs a MessageEvent with the iframe's contentWindow as source.
 */
window.__injectMessage__ = (windowId: string, data: unknown[]) => {
  const iframe = nappletFrames.get(windowId);
  if (!iframe?.contentWindow) throw new Error(`No iframe for windowId: ${windowId}`);
  const event = new MessageEvent('message', {
    data,
    source: iframe.contentWindow,
    origin: 'null',
  });
  window.dispatchEvent(event);
};

/**
 * Shorthand: inject a REQ message from the specified napplet.
 */
window.__createSubscription__ = (windowId: string, subId: string, filters: unknown[]) => {
  window.__injectMessage__(windowId, ['REQ', subId, ...filters]);
};

/**
 * Shorthand: inject an EVENT message from the specified napplet.
 */
window.__publishEvent__ = (windowId: string, event: unknown) => {
  window.__injectMessage__(windowId, ['EVENT', event]);
};

/**
 * Shorthand: inject a CLOSE message from the specified napplet.
 */
window.__closeSubscription__ = (windowId: string, subId: string) => {
  window.__injectMessage__(windowId, ['CLOSE', subId]);
};

/**
 * Get the pending AUTH challenge string for a windowId.
 * Finds challenges from the tap's outbound messages, indexed by napplet load order.
 */
window.__getChallenge__ = (windowId: string): string | undefined => {
  const challenges = tap.messages.filter(
    m => m.verb === 'AUTH' && m.direction === 'shell->napplet'
      && typeof m.raw[1] === 'string'
  );
  // Match challenge to windowId by napplet load order
  const nappletIndex = Array.from(nappletFrames.keys()).indexOf(windowId);
  if (nappletIndex >= 0 && nappletIndex < challenges.length) {
    return challenges[nappletIndex].raw[1] as string;
  }
  // Fallback: return the last challenge
  return challenges.length > 0 ? challenges[challenges.length - 1].raw[1] as string : undefined;
};

/**
 * Get list of all loaded napplet windowIds.
 */
window.__getNappletFrames__ = (): string[] => {
  return Array.from(nappletFrames.keys());
};

// --- Phase 4: Capability Test Control Functions ---

// ACL manipulation globals — use the runtime's ACL state (not the shell singleton)
const runtimeAcl = relay.runtime.aclState;
window.__aclRevoke__ = (pubkey, dTag, hash, cap) => runtimeAcl.revoke(pubkey, dTag, hash, cap as Capability);
window.__aclGrant__ = (pubkey, dTag, hash, cap) => runtimeAcl.grant(pubkey, dTag, hash, cap as Capability);
window.__aclBlock__ = (pubkey, dTag, hash) => runtimeAcl.block(pubkey, dTag, hash);
window.__aclUnblock__ = (pubkey, dTag, hash) => runtimeAcl.unblock(pubkey, dTag, hash);
window.__aclPersist__ = () => runtimeAcl.persist();
window.__aclLoad__ = () => runtimeAcl.load();
window.__aclClear__ = () => runtimeAcl.clear();
window.__aclCheck__ = (pubkey, dTag, hash, cap) => runtimeAcl.check(pubkey, dTag, hash, cap as Capability);
window.__aclGetEntry__ = (pubkey, dTag, hash) => runtimeAcl.getEntry(pubkey, dTag, hash);

// Napplet identity globals — use the runtime's sessionRegistry (not the shell singleton)
const runtimeRegistry = relay.runtime.sessionRegistry;
window.__getNappPubkey__ = (windowId: string) => runtimeRegistry.getPubkey(windowId);
window.__getNappEntry__ = (windowId: string) => {
  const pubkey = runtimeRegistry.getPubkey(windowId);
  if (!pubkey) return undefined;
  const entry = runtimeRegistry.getEntry(pubkey);
  if (!entry) return undefined;
  return { pubkey: entry.pubkey, dTag: entry.dTag, aggregateHash: entry.aggregateHash };
};

// Signer and consent globals
window.__setSigner__ = (signer: unknown) => mockResult.setSigner(signer);
window.__setConsentHandler__ = (mode: 'auto-approve' | 'auto-deny') => {
  relay.registerConsentHandler((request) => {
    request.resolve(mode === 'auto-approve');
  });
};

// Shell event injection
window.__injectShellEvent__ = (topic: string, payload: unknown) => relay.injectEvent(topic, payload);

// localStorage access globals
window.__getLocalStorageKeys__ = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return keys;
};
window.__getLocalStorageItem__ = (key: string) => localStorage.getItem(key);
window.__setLocalStorageItem__ = (key: string, value: string) => localStorage.setItem(key, value);
window.__clearLocalStorage__ = () => localStorage.clear();

// --- Debug Logging ---

function logStatus(msg: string): void {
  const status = document.getElementById('status');
  if (status) status.textContent = msg;
  const log = document.getElementById('log');
  if (log) log.textContent += `[${new Date().toISOString()}] ${msg}\n`;
}

// Log all tapped messages for visual debugging
tap.onMessage((msg) => {
  logStatus(`${msg.direction} ${msg.verb} ${msg.parsed.subId || msg.parsed.eventId || ''}`);
});

logStatus('Shell ready -- waiting for napplet load commands');

// ─── NIP-5D Envelope-Aware Driver API (Plan 16-03) ──────────────────────────
//
// All globals below must return structured-clone-safe values.
// Source of truth: .planning/research/PITFALLS.md (Anti-Pattern 2).

// envelopeLog is declared early in this file (before the proxy setup) so both
// the outbound postMessage proxy and the inbound message listener below can
// record into the same Map. See the hoisted declaration at the top of this file.

/**
 * Shadow registry of service names — tracks initial services from createMockHooks
 * plus any added via __registerService__. Maintained independently of the runtime's
 * internal serviceRegistry because that Map is not publicly enumerable on the
 * Runtime type surface.
 */
const serviceShadow = new Set<string>(
  Object.keys(mockResult.hooks.services ?? {})
);

/**
 * Shadow log of notifications — populated if the mock notification service is wired.
 * If not wired, __getNotifications__ returns an empty array (Phase 19 will extend
 * this when the toaster napplet lands).
 */
const notificationsShadow: Array<{
  id: string;
  title: string;
  body?: string;
  read: boolean;
  windowId?: string;
}> = [];

// ─── Envelope interception ──────────────────────────────────────────────────
//
// Hook a separate window.addEventListener('message') listener alongside the
// existing relay.handleMessage listener. When a non-array plain-object message
// with a `type: string` property arrives from a registered napplet frame,
// record a deep clone in envelopeLog.
window.addEventListener('message', (event: MessageEvent) => {
  if (!event.source || Array.isArray(event.data)) return;
  const windowId = originRegistry.getWindowId(event.source as Window);
  if (!windowId) return;
  const data = event.data;
  if (data && typeof data === 'object' && typeof (data as Record<string, unknown>).type === 'string') {
    const clone = JSON.parse(JSON.stringify(data)) as NappletMessage;
    const arr = envelopeLog.get(windowId) ?? [];
    arr.push(clone);
    envelopeLog.set(windowId, arr);
  }
});

/**
 * Inject a NIP-5D envelope into the runtime as if posted by the given napplet.
 * Synchronous — the envelope passes through relay.handleMessage immediately.
 * @param windowId - Harness-assigned window id for the napplet iframe.
 * @param envelope - A NIP-5D NappletMessage (must include `type: string`).
 */
window.__injectEnvelope__ = (windowId: string, envelope: NappletMessage): void => {
  const iframe = nappletFrames.get(windowId);
  if (!iframe?.contentWindow) throw new Error(`No iframe for windowId: ${windowId}`);
  const event = new MessageEvent('message', {
    data: envelope,
    source: iframe.contentWindow,
    origin: 'null',
  });
  window.dispatchEvent(event);
};

/**
 * Return the most recent NIP-5D envelope recorded for a napplet, optionally
 * filtered by envelope type. Deep-cloned — safe to return from page.evaluate().
 * @param windowId - The harness-assigned window id.
 * @param type - Optional envelope type filter (e.g., "relay.publish").
 * @returns The last matching NappletMessage, or null if none recorded.
 */
window.__getNubMessage__ = (windowId: string, type?: string): NappletMessage | null => {
  const arr = envelopeLog.get(windowId) ?? [];
  const filtered = type ? arr.filter(m => m.type === type) : arr;
  if (filtered.length === 0) return null;
  const last = filtered[filtered.length - 1];
  return JSON.parse(JSON.stringify(last)) as NappletMessage;
};

/**
 * Snapshot of currently registered service names.
 * Returns a plain array — structured-clone-safe by construction.
 * @returns An array of service names (e.g., ["identity", "notifications"]).
 */
window.__getServiceNames__ = (): string[] => [...serviceShadow];

/**
 * Register a service with the runtime by evaluating `handlerScript` in the harness context.
 * `handlerScript` MUST be a JS expression that evaluates to a ServiceHandler
 * (e.g., `({ name: "x", version: "1.0", handleMessage: (w, m, send) => null })`).
 * @param name - The service name to register.
 * @param handlerScript - A JS expression (not a full function body) evaluating to a ServiceHandler.
 * @returns true if registration succeeded; false if the script evaluation threw.
 */
window.__registerService__ = (name: string, handlerScript: string): boolean => {
  try {
    // Phase 28 E2E-14: 'real' factory-key branch swaps in the @kehto/services
    // reference implementation for 'keys' or 'media'. Zero-arg construction
    // yields the canonical document-level / navigator.mediaSession reference
    // backends. Extends __registerService__ with a single new code path; the
    // eval path below is preserved for ad-hoc stub needs (any non-'real' value).
    if (handlerScript === 'real') {
      let handler;
      if (name === 'keys') {
        handler = createKeysService();
      } else if (name === 'media') {
        handler = createMediaService();
      } else {
        return false;
      }
      relay.runtime.registerService(name, handler);
      serviceShadow.add(name);
      return true;
    }
    // eslint-disable-next-line no-new-func -- test-only eval path
    const handler = new Function(`return (${handlerScript});`)();
    if (!handler || typeof handler.handleMessage !== 'function') return false;
    relay.runtime.registerService(name, handler);
    serviceShadow.add(name);
    return true;
  } catch {
    return false;
  }
};

/**
 * Unregister a service by name.
 * @param name - The service name previously registered.
 * @returns true if a service was removed; false if no such service existed.
 */
window.__unregisterService__ = (name: string): boolean => {
  if (!serviceShadow.has(name)) return false;
  relay.runtime.unregisterService(name);
  serviceShadow.delete(name);
  return true;
};

/**
 * Snapshot the notification-service state, filtered by windowId.
 * Returns [] if no notification service is wired (Phase 19 extends this when
 * the toaster napplet lands and notification-service state propagation is wired).
 * @param windowId - Optional filter; if omitted, returns all notifications.
 * @returns An array of serializable notification entries.
 */
window.__getNotifications__ = (windowId?: string) => {
  const filtered = windowId
    ? notificationsShadow.filter(n => n.windowId === windowId)
    : notificationsShadow;
  return filtered.map(n => ({
    id: n.id,
    title: n.title,
    body: n.body,
    read: n.read,
  }));
};

/**
 * Override the mock signer's user pubkey.
 * Delegates to MockHooksResult.setUserPubkey().
 * @param pubkey - 64-char hex pubkey string.
 */
window.__setIdentityPubkey__ = (pubkey: string): void => {
  mockResult.setUserPubkey(pubkey);
};

/**
 * Readiness flag per napplet: true if the runtime has acknowledged this napplet's
 * session (i.e., sessionRegistry has an entry for its pubkey).
 * Consumed by tests/e2e/helpers/wait-for-napplet-ready.ts (Plan 16-04).
 * @param windowId - The napplet's window id.
 * @returns true if the napplet's session is acknowledged; false otherwise.
 */
window.__nappletReady__ = (windowId: string): boolean => {
  // NIP-5D: NIP-5D sessions register with pubkey='' so Boolean(getPubkey(wid))
  // would be false for a valid session. Use isRegistered() which checks
  // the byWindowId Map directly (truthy for any registered windowId, even pubkey='').
  return relay.runtime.sessionRegistry.isRegistered(windowId);
};
