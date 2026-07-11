/**
 * keys-service.ts — NIP-5D keys NAP reference document-level listener implementation.
 *
 * Handles the 3 napplet -> shell request types from @napplet/nap/keys:
 *   - keys.forward          -> invokes options.onForward (hotkey passthrough, fire-and-forget)
 *   - keys.registerAction   -> parses action.defaultKey into a normalized chord binding,
 *                              stores bound subscriptions in an in-memory registry keyed
 *                              by actionId, tracks windowId ownership so onWindowDestroyed
 *                              can auto-unsubscribe, echoes { actionId, binding } as .result
 *                              when a binding is assigned, and pushes the window's complete
 *                              keys.bindings list
 *   - keys.unregisterAction -> removes the subscription and pushes the window's
 *                              updated keys.bindings list
 *
 * Real listener: on service construction the handler attaches a single
 * `keydown` listener to `options.listenerTarget` (default: `document`). Each
 * keydown is matched against the chord-subscription registry; matches invoke
 * `options.onForward` with the DOM-shape payload and push a canonical
 * `keys.action` envelope back to the owning napplet via the per-window `send`
 * callback captured at `keys.registerAction` time. Subscriptions persist
 * across messages; `onWindowDestroyed(windowId)` drops all subscriptions owned
 * by the destroyed window as well as its cached `send` handle.
 *
 * On each document keydown matching a registered action, the service emits a
 * `keys.action` envelope to the action's owning napplet via the per-window
 * `send` callback — this is the canonical @napplet/nap/keys surface the SDK's
 * `keys.onAction(...)` helper consumes. Forwarded keydowns do not trigger
 * `keys.action`; the active napplet suppresses bound keys locally from the
 * `keys.bindings` list before forwarding.
 *
 * Field-name translation: @napplet/nap/keys uses the compact
 * { ctrl, alt, shift, meta } form on the wire; the shell's HotkeyHooks
 * (packages/shell/src/types.ts) expects the DOM-compatible
 * { ctrlKey, altKey, shiftKey, metaKey } form. This service performs the
 * translation so callers of `onForward` see the DOM shape.
 *
 * Shell -> napplet push envelopes `keys.bindings` are emitted here whenever
 * the registered bindings for a window change. The injected shim consumes
 * that complete list to suppress locally-bound keydowns before forwarding.
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  KeysForwardMessage,
  KeysRegisterActionMessage,
  KeysRegisterActionResultMessage,
  KeysActionMessage,
} from '@napplet/nap/keys/types';
import {
  chordSpecKey,
  eventKey,
  formatChord,
  forwardPayload,
  isReservedKeyChord,
  parseChord,
  pushBindings,
  removeActionFromWindowIndex,
  type ActionEntry,
  type ChordSpec,
} from './keys-service-internals.js';

/**
 * Minimal structural subset of the DOM `KeyboardEvent` exposed to
 * `HostKeysBridge` subscribe callbacks. DOM `KeyboardEvent` satisfies this
 * structurally with no adapter needed. OS-bridge impls (Electron, Tauri —
 * out of v1.4 scope) synthesize this from native key events.
 */
export interface HostKeyEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  /** True for OS autorepeat; the service filters these by default. */
  repeat?: boolean;
}

/**
 * Host-bridge contract for pluggable keyboard backends.
 *
 * The browser reference implementation (the default {@link createKeysService}
 * behaviour when `hostBridge` is omitted) registers a `document`-level keydown
 * listener and satisfies this interface structurally — it exposes
 * `subscribe(chord, callback) => unsubscribe` semantics but omits the two
 * OS-level optional fields (browsers cannot register global hotkeys without
 * privileged APIs).
 *
 * Host apps (Electron, Tauri) implement this interface in their own code and
 * pass it via `createKeysService({ hostBridge: myBridge })` — the service
 * then delegates subscription lifecycle to the bridge and remains browser-free.
 *
 * Reference implementations for Electron / Tauri are explicitly out of v1.4
 * scope and live in host-app examples / follow-up milestones (see
 * REQUIREMENTS.md "Future Requirements").
 *
 * @example
 * ```ts
 * // Host-app pseudocode (Electron main-process relay):
 * const electronBridge: HostKeysBridge = {
 *   subscribe(chord, cb) {
 *     const handle = globalShortcut.register(chord, () => cb({ key: '', code: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }));
 *     return () => globalShortcut.unregister(chord);
 *   },
 *   registerGlobalHotkey: (chord) => globalShortcut.register(chord, () => {}),
 *   onGlobalHotkey: (cb) => globalHotkeyBridge.on('global-hotkey', (_, chord) => cb(chord)),
 * };
 *
 * const keys = createKeysService({ hostBridge: electronBridge });
 * runtime.registerService('keys', keys);
 * ```
 */
export interface HostKeysBridge {
  /**
   * Subscribe a callback to a chord. Returns an unsubscribe handle.
   *
   * Implementations MUST:
   *   - invoke `callback` exactly once per matching chord event (implementations
   *     are responsible for any OS-autorepeat filtering)
   *   - invoke `callback` synchronously during the event delivery
   *   - accept the string chord format documented by @napplet/nap/keys
   *     (e.g. `'Ctrl+Shift+K'`, `'Cmd+P'`)
   */
  subscribe(chord: string, callback: (event: KeyboardEvent | HostKeyEvent) => void): () => void;

  /**
   * Optional: register an OS-level global hotkey (works even when the host
   * window is not focused). Returns true on success, false if the chord
   * cannot be registered (e.g. already claimed by another app).
   *
   * Omitted by the browser reference implementation — browsers cannot
   * register OS-level global hotkeys without privileged APIs. Electron
   * (`globalShortcut`) and Tauri (`GlobalShortcut`) provide this.
   */
  registerGlobalHotkey?(chord: string): boolean;

  /**
   * Optional: subscribe to OS-level global hotkey events (regardless of
   * focus). Returns an unsubscribe handle.
   *
   * Omitted by the browser reference implementation. See
   * {@link HostKeysBridge.registerGlobalHotkey}.
   */
  onGlobalHotkey?(callback: (chord: string) => void): () => void;
}

/** Keys service version — follows semver. */
const KEYS_SERVICE_VERSION = '1.3.0';

/**
 * Options for creating a keys service via createKeysService().
 *
 * @example
 * ```ts
 * const keys = createKeysService({
 *   onForward: (event) => {
 *     // event has DOM-compatible field names: ctrlKey, altKey, etc.
 *     hotkeyDispatcher.dispatch(event);
 *   },
 * });
 * ```
 */
export interface KeysServiceOptions {
  /**
   * Called on `keys.forward` (napplet-forwarded chord) and on document keydown
   * handled by the reference listener. Receives the DOM-style field names
   * (ctrlKey/altKey/shiftKey/metaKey) to match the shell's HotkeyHooks
   * contract. The service translates from the wire shape
   * ({ ctrl, alt, shift, meta }) before invoking this callback.
   */
  onForward?: (event: {
    key: string;
    code: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
  }) => void;
  /**
   * EventTarget to attach the default keydown listener to. Defaults to the
   * global `document` when running in a DOM environment, else an isolated
   * `new EventTarget()` (SSR / Node-test safe). Passing a fresh
   * `new EventTarget()` is useful for unit tests. Mirrors the pattern used
   * by the shell and service test harnesses.
   *
   * Ignored when `hostBridge` is provided — the bridge owns subscription
   * lifecycle and no document listener is attached.
   */
  listenerTarget?: EventTarget;
  /**
   * Optional pluggable backend for chord subscription. When provided, the
   * service delegates `keys.registerAction` → `bridge.subscribe(chord, cb)`
   * and stores the returned unsubscribe handle keyed on `actionId`. The
   * default document-listener path is NOT attached when `hostBridge` is
   * provided — the bridge is authoritative. See {@link HostKeysBridge}.
   */
  hostBridge?: HostKeysBridge;
  /**
   * Optional set of shell-reserved chords. Strings in the `@napplet/nap/keys`
   * wire format (e.g. `'Ctrl+Shift+K'`, `'Cmd+P'`). Reserved chords are not
   * assigned as napplet action bindings; document keydowns that match them
   * invoke `onForward` but do not push `keys.action`.
   *
   * Normalized once at service construction via the same chord parser used
   * for `action.defaultKey` — `'Ctrl+K'` / `'Control+k'` / `'ctrl+K'` all
   * match. Static; no runtime mutation. For dynamic reservation see the
   * deferred `HostKeysBridge.reserveAbsolute(chords)` extension.
   *
   * @example
   * ```ts
   * const keys = createKeysService({
   *   reservedChords: ['Ctrl+Alt+T', 'Super+Space'],
   *   onForward: (event) => wm.dispatch(event),
   * });
   * ```
   */
  reservedChords?: ReadonlyArray<string>;
}

type SendNappletMessage = (msg: NappletMessage) => void;

function rememberActionForWindow(
  windowIndex: Map<string, Set<string>>,
  windowId: string,
  actionId: string,
): void {
  if (!windowIndex.has(windowId)) windowIndex.set(windowId, new Set());
  windowIndex.get(windowId)!.add(actionId);
}

function bindActionEntry(
  registry: Map<string, ActionEntry>,
  windowIndex: Map<string, Set<string>>,
  actionId: string,
  windowId: string,
  chord: ChordSpec,
  chordString: string,
): void {
  registry.set(actionId, { chord, chordString, windowId });
  rememberActionForWindow(windowIndex, windowId, actionId);
}

function bindActionAndMarkChanged(
  registry: Map<string, ActionEntry>,
  windowIndex: Map<string, Set<string>>,
  changedWindowIds: Set<string>,
  actionId: string,
  windowId: string,
  chord: ChordSpec,
  chordString: string,
): string {
  bindActionEntry(registry, windowIndex, actionId, windowId, chord, chordString);
  changedWindowIds.add(windowId);
  return chordString;
}

function handleForwardMessage(
  message: NappletMessage,
  onForward?: KeysServiceOptions['onForward'],
): void {
  onForward?.(forwardPayload(message as KeysForwardMessage));
}

type KeysUnregisterActionMessage = NappletMessage & { actionId?: string };
type RegisterActionHandler = (
  windowId: string,
  message: KeysRegisterActionMessage,
  send: SendNappletMessage,
) => void;
type UnregisterActionHandler = (
  windowId: string,
  message: KeysUnregisterActionMessage,
  send: SendNappletMessage,
) => void;

function sendUnknownKeysMethod(send: SendNappletMessage, message: NappletMessage): void {
  const id = (message as NappletMessage & { id?: string }).id ?? '';
  send({
    type: `${message.type}.error`,
    id,
    error: `Unknown keys method: ${message.type}`,
  } as NappletMessage);
}

function createKeysMessageHandler(options: {
  onForward?: KeysServiceOptions['onForward'];
  onRegisterAction: RegisterActionHandler;
  onUnregisterAction: UnregisterActionHandler;
}): (windowId: string, message: NappletMessage, send: SendNappletMessage) => void {
  return (windowId, message, send): void => {
    switch (message.type) {
      case 'keys.forward':
        handleForwardMessage(message, options.onForward);
        return;
      case 'keys.registerAction':
        options.onRegisterAction(windowId, message as KeysRegisterActionMessage, send);
        return;
      case 'keys.unregisterAction':
        options.onUnregisterAction(windowId, message as KeysUnregisterActionMessage, send);
        return;
      default:
        sendUnknownKeysMethod(send, message);
    }
  };
}

function sendRegisterActionResult(
  send: SendNappletMessage,
  message: KeysRegisterActionMessage,
  binding?: string,
  error?: string,
): void {
  const result: KeysRegisterActionResultMessage & { error?: string } = {
    type: 'keys.registerAction.result',
    id: message.id,
    actionId: message.action.id,
    ...(binding ? { binding } : {}),
    ...(error ? { error } : {}),
  };
  send(result as NappletMessage);
}

function pushChangedBindings(
  changedWindowIds: Iterable<string>,
  registry: ReadonlyMap<string, ActionEntry>,
  windowIndex: ReadonlyMap<string, ReadonlySet<string>>,
  sendHandles: Map<string, SendNappletMessage>,
  fallbackSend: SendNappletMessage,
): void {
  for (const changedWindowId of changedWindowIds) {
    const ownerSend = sendHandles.get(changedWindowId) ?? fallbackSend;
    pushBindings(changedWindowId, registry, windowIndex, ownerSend);
    if (!windowIndex.has(changedWindowId)) sendHandles.delete(changedWindowId);
  }
}

/**
 * Create a keys service handler.
 *
 * Attaches a single `keydown` listener to `options.listenerTarget`
 * (default `document`). Matching chord subscriptions invoke `options.onForward`
 * with a DOM-shape payload and push a `keys.action` envelope back to the
 * owning napplet via the per-window `send` callback captured at
 * `keys.registerAction` time. Returns a `ServiceHandler` augmented with a
 * `destroy()` method that detaches the listener and clears all registries.
 *
 * @param options - Optional configuration (onForward callback, listenerTarget)
 * @returns A ServiceHandler (with `destroy()`) to register with the runtime
 *
 * @example
 * ```ts
 * import { createKeysService } from '@kehto/services';
 *
 * const keys = createKeysService({
 *   onForward: (event) => shellHotkeyDispatcher.execute(event),
 * });
 *
 * runtime.registerService('keys', keys);
 * // Later, on shell teardown:
 * keys.destroy();
 * ```
 */
export function createKeysService(
  options: KeysServiceOptions = {},
): ServiceHandler & { destroy(): void } {
  const descriptor: ServiceDescriptor = {
    name: 'keys',
    version: KEYS_SERVICE_VERSION,
    description: options.hostBridge
      ? 'NIP-5D keys NAP reference handler (host-bridge delegated)'
      : 'NIP-5D keys NAP reference handler (document-level chord listener)',
  };

  const reservedChordKeys: Set<string> = new Set();
  if (options.reservedChords) {
    for (const chordStr of options.reservedChords) {
      // parseChord throws on malformed input — let it bubble up at construction
      // so misconfigured shells fail loudly at boot, not silently at runtime.
      reservedChordKeys.add(chordSpecKey(parseChord(chordStr)));
    }
  }

  const isUnavailableBinding = (chord: ChordSpec): boolean =>
    reservedChordKeys.has(chordSpecKey(chord)) || isReservedKeyChord(chord);

  if (options.hostBridge) {
    const bridge = options.hostBridge;
    // windowId → Set<actionId> — parallels Branch B for scoped cleanup.
    const bridgeWindowActions = new Map<string, Set<string>>();
    const bridgeActionRegistry = new Map<string, ActionEntry>();
    const bridgeSendHandles = new Map<string, (msg: NappletMessage) => void>();
    // actionId → unsubscribe handle returned from bridge.subscribe.
    const unsubscribeHandles = new Map<string, () => void>();

    const handleBridgeRegisterAction: RegisterActionHandler = (windowId, m, send) => {
      bridgeSendHandles.set(windowId, send);
      let binding: string | undefined;
      const changedWindowIds = new Set<string>();

      if (m.action.defaultKey) {
        try {
          const chord = parseChord(m.action.defaultKey);
          const normalizedChord = formatChord(chord);
          const existingEntry = bridgeActionRegistry.get(m.action.id);
          const existing = unsubscribeHandles.get(m.action.id);
          let nextUnsubscribe: (() => void) | undefined;

          if (!isUnavailableBinding(chord)) {
            nextUnsubscribe = bridge.subscribe(normalizedChord, (ev) => {
              // Normalize either KeyboardEvent or HostKeyEvent to the DOM-shape onForward payload.
              const e = ev as KeyboardEvent | HostKeyEvent;
              // Bridges may not filter autorepeat — we do, matching Branch B semantics.
              if ('repeat' in e && e.repeat) return;
              options.onForward?.({
                key: e.key,
                code: e.code,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
                metaKey: e.metaKey,
              });
              const payload: KeysActionMessage = {
                type: 'keys.action',
                actionId: m.action.id,
              };
              send(payload as NappletMessage);
            });
          }

          if (existing) {
            try {
              existing();
            } catch {
              /* best-effort */
            }
            unsubscribeHandles.delete(m.action.id);
          }
          if (existingEntry) changedWindowIds.add(existingEntry.windowId);
          removeActionFromWindowIndex(m.action.id, bridgeWindowActions);
          bridgeActionRegistry.delete(m.action.id);

          if (nextUnsubscribe) {
            unsubscribeHandles.set(m.action.id, nextUnsubscribe);
            binding = bindActionAndMarkChanged(
              bridgeActionRegistry,
              bridgeWindowActions,
              changedWindowIds,
              m.action.id,
              windowId,
              chord,
              normalizedChord,
            );
          }
        } catch (err) {
          sendRegisterActionResult(
            send,
            m,
            undefined,
            `bridge subscribe failed: ${(err as Error).message}`,
          );
          return;
        }
      }
      sendRegisterActionResult(send, m, binding);
      pushChangedBindings(
        changedWindowIds,
        bridgeActionRegistry,
        bridgeWindowActions,
        bridgeSendHandles,
        send,
      );
    };

    const handleBridgeUnregisterAction: UnregisterActionHandler = (_windowId, m, send) => {
      if (!m.actionId) return;
      const unsubscribe = unsubscribeHandles.get(m.actionId);
      const entry = bridgeActionRegistry.get(m.actionId);
      if (!unsubscribe) return;
      try {
        unsubscribe();
      } catch {
        /* best-effort */
      }
      unsubscribeHandles.delete(m.actionId);
      bridgeActionRegistry.delete(m.actionId);
      removeActionFromWindowIndex(m.actionId, bridgeWindowActions);
      if (entry) {
        const ownerSend = bridgeSendHandles.get(entry.windowId) ?? send;
        pushBindings(entry.windowId, bridgeActionRegistry, bridgeWindowActions, ownerSend);
        if (!bridgeWindowActions.has(entry.windowId)) {
          bridgeSendHandles.delete(entry.windowId);
        }
      }
    };

    return {
      descriptor,

      handleMessage: createKeysMessageHandler({
        onForward: options.onForward,
        onRegisterAction: handleBridgeRegisterAction,
        onUnregisterAction: handleBridgeUnregisterAction,
      }),

      onWindowDestroyed(windowId: string): void {
        const actions = bridgeWindowActions.get(windowId);
        if (!actions) return;
        for (const actionId of actions) {
          const unsubscribe = unsubscribeHandles.get(actionId);
          if (unsubscribe) {
            try {
              unsubscribe();
            } catch {
              /* best-effort */
            }
          }
          unsubscribeHandles.delete(actionId);
          bridgeActionRegistry.delete(actionId);
        }
        bridgeWindowActions.delete(windowId);
        bridgeSendHandles.delete(windowId);
      },

      destroy(): void {
        for (const unsubscribe of unsubscribeHandles.values()) {
          try {
            unsubscribe();
          } catch {
            /* best-effort */
          }
        }
        unsubscribeHandles.clear();
        bridgeActionRegistry.clear();
        bridgeWindowActions.clear();
        bridgeSendHandles.clear();
      },
    };
  }

  const actionRegistry = new Map<string, ActionEntry>(); // actionId → {chord, chordString, windowId}
  const windowActions = new Map<string, Set<string>>(); // windowId → Set<actionId>
  // Per-window `send` callback captured at registerAction time. Used to push
  // keys.action envelopes back to the owning napplet on chord match — this is
  // the canonical @napplet/nap/keys surface the SDK's `keys.onAction(...)`
  // helper consumes.
  const sendHandles = new Map<string, (msg: NappletMessage) => void>(); // windowId → send

  // ─── Listener target (SSR / test-safe fallback) ─
  const target: EventTarget =
    options.listenerTarget ??
    (typeof document !== 'undefined' ? document : new EventTarget());

  function chordMatches(spec: ChordSpec, ev: KeyboardEvent): boolean {
    if (spec.ctrl !== ev.ctrlKey) return false;
    if (spec.alt !== ev.altKey) return false;
    if (spec.shift !== ev.shiftKey) return false;
    if (spec.meta !== ev.metaKey) return false;
    const evKey = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    return spec.key === evKey;
  }

  const listener = (rawEv: Event): void => {
    const ev = rawEv as KeyboardEvent;
    if (ev.repeat) return; // ignore OS autorepeat — matches "I pressed it once" intent (CONTEXT Area 1)

    // Reserved chords fire onForward but suppress keys.action fan-out to napplets.
    const isReserved = reservedChordKeys.has(eventKey(ev));

    // Determine if any registered action would match — needed to decide
    // whether to fire onForward on a non-reserved keydown (legacy parity).
    // A reserved chord fires onForward regardless of napplet registration
    // (WM-launcher case: shell declares chord, no napplet registers it).
    let anyMatch = false;
    for (const entry of actionRegistry.values()) {
      if (chordMatches(entry.chord, ev)) {
        anyMatch = true;
        break;
      }
    }

    if (isReserved || anyMatch) {
      options.onForward?.({
        key: ev.key,
        code: ev.code,
        ctrlKey: ev.ctrlKey,
        altKey: ev.altKey,
        shiftKey: ev.shiftKey,
        metaKey: ev.metaKey,
      });
    }

    if (isReserved) return; // reserved → no napplet fan-out

    // Canonical shell→napplet push: emit keys.action to the owning napplet via
    // its captured send callback. The SDK's keys.onAction helper subscribes to
    // this envelope.
    for (const [actionId, entry] of actionRegistry.entries()) {
      if (chordMatches(entry.chord, ev)) {
        const send = sendHandles.get(entry.windowId);
        if (send) {
          const payload: KeysActionMessage = {
            type: 'keys.action',
            actionId,
          };
          send(payload as NappletMessage);
        }
        // Intentionally no `break` — two actions subscribing to the same chord
        // both receive the event. Conflict resolution is an explicit v1.5+
        // concern per CONTEXT.md Deferred Ideas.
      }
    }
  };

  target.addEventListener('keydown', listener);

  const handleDocumentRegisterAction: RegisterActionHandler = (windowId, m, send) => {
    // Capture (or refresh) the per-window send callback. The runtime's service
    // handler contract keeps `send` valid until onWindowDestroyed(windowId).
    sendHandles.set(windowId, send);
    let binding: string | undefined;
    const changedWindowIds = new Set<string>();

    if (m.action.defaultKey) {
      try {
        const chord = parseChord(m.action.defaultKey);
        const normalizedChord = formatChord(chord);
        const existing = actionRegistry.get(m.action.id);
        if (existing) {
          changedWindowIds.add(existing.windowId);
          removeActionFromWindowIndex(m.action.id, windowActions);
          actionRegistry.delete(m.action.id);
        }
        if (!isUnavailableBinding(chord)) {
          binding = bindActionAndMarkChanged(actionRegistry, windowActions, changedWindowIds, m.action.id, windowId, chord, normalizedChord);
        }
      } catch (err) {
        sendRegisterActionResult(
          send,
          m,
          undefined,
          `invalid chord: ${(err as Error).message}`,
        );
        return;
      }
    }
    sendRegisterActionResult(send, m, binding);
    pushChangedBindings(changedWindowIds, actionRegistry, windowActions, sendHandles, send);
  };

  const handleDocumentUnregisterAction: UnregisterActionHandler = (_windowId, m, send) => {
    if (!m.actionId || !actionRegistry.has(m.actionId)) return;
    const entry = actionRegistry.get(m.actionId)!;
    actionRegistry.delete(m.actionId);
    const set = windowActions.get(entry.windowId);
    if (set) {
      set.delete(m.actionId);
      // If the window has no remaining actions, drop its cached send that no
      // longer subscribes to anything.
      if (set.size === 0) windowActions.delete(entry.windowId);
    }
    const ownerSend = sendHandles.get(entry.windowId) ?? send;
    pushBindings(entry.windowId, actionRegistry, windowActions, ownerSend);
    if (!windowActions.has(entry.windowId)) sendHandles.delete(entry.windowId);
  };

  return {
    descriptor,

    handleMessage: createKeysMessageHandler({
      onForward: options.onForward,
      onRegisterAction: handleDocumentRegisterAction,
      onUnregisterAction: handleDocumentUnregisterAction,
    }),

    onWindowDestroyed(windowId: string): void {
      const actions = windowActions.get(windowId);
      if (actions) {
        for (const actionId of actions) actionRegistry.delete(actionId);
        windowActions.delete(windowId);
      }
      sendHandles.delete(windowId);
    },

    destroy(): void {
      target.removeEventListener('keydown', listener);
      actionRegistry.clear();
      windowActions.clear();
      sendHandles.clear();
    },
  };
}
