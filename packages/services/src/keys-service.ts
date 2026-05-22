/**
 * keys-service.ts — NIP-5D keys NUB reference document-level listener implementation.
 *
 * Handles the 3 napplet -> shell request types from @napplet/nub/keys:
 *   - keys.forward          -> invokes options.onForward (hotkey passthrough, fire-and-forget)
 *   - keys.registerAction   -> parses action.defaultKey into a chord spec, stores the
 *                              subscription in an in-memory registry keyed by actionId,
 *                              tracks windowId ownership so onWindowDestroyed can auto-
 *                              unsubscribe, and echoes { actionId, binding } as .result
 *   - keys.unregisterAction -> removes the subscription; fire-and-forget (no envelope)
 *
 * Real listener: on service construction the handler attaches a single
 * `keydown` listener to `options.listenerTarget` (default: `document`). Each
 * keydown is matched against the chord-subscription registry; matches invoke
 * `options.onForward` with the DOM-shape payload AND push a canonical
 * `keys.action` envelope back to the owning napplet via the per-window `send`
 * callback captured at `keys.registerAction` time. Subscriptions persist
 * across messages; `onWindowDestroyed(windowId)` drops all subscriptions owned
 * by the destroyed window as well as its cached `send` handle.
 *
 * On each document keydown matching a registered action, the service
 * additionally emits a `keys.action` envelope to the action's owning napplet
 * via the per-window `send` callback — this is the canonical @napplet/nub/keys
 * surface the SDK's `keys.onAction(...)` helper consumes. The shape is a
 * superset of `KeysActionMessage`: `{ type, actionId, chord }` where `chord`
 * is the parsed `{ ctrl, alt, shift, meta, key }` struct (extension field;
 * base shape unchanged, downstream SDKs that only read `{ type, actionId }`
 * ignore `chord` silently).
 *
 * Field-name translation: @napplet/nub/keys uses the compact
 * { ctrl, alt, shift, meta } form on the wire; the shell's HotkeyHooks
 * (packages/shell/src/types.ts) expects the DOM-compatible
 * { ctrlKey, altKey, shiftKey, metaKey } form. This service performs the
 * translation so callers of `onForward` see the DOM shape.
 *
 * Shell -> napplet push envelopes `keys.bindings` remain the shell-side keys
 * forwarder's responsibility (DRIFT-SHELL-06, tracked under Plan 12-11 /
 * future phase); `keys.action` is emitted here per Plan 26-01.
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  KeysForwardMessage,
  KeysRegisterActionMessage,
  KeysRegisterActionResultMessage,
  KeysActionMessage,
} from '@napplet/nub/keys/types';

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
   *   - accept the string chord format documented by @napplet/nub/keys
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
const KEYS_SERVICE_VERSION = '1.2.0';

/**
 * Parsed chord struct — internal, never on the wire. The napplet-facing API
 * (and the `action.defaultKey` field) is a string like `"Ctrl+Shift+K"`;
 * `parseChord` lowers those strings into this struct for efficient matching
 * against `KeyboardEvent` modifier flags.
 */
interface ChordSpec {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** Normalized uppercase single character or DOM key name (e.g. 'K', 'Enter'). */
  key: string;
}

/** Registry entry — maps a registered actionId back to its owning window + chord. */
interface ActionEntry {
  chord: ChordSpec;
  /** Original chord string, preserved for the .result `binding` field. */
  chordString: string;
  windowId: string;
}

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
   * Called on `keys.forward` (napplet-forwarded chord) AND on document keydown
   * matching a registered action. Receives the DOM-style field names
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
   * by `@kehto/shell`'s `createKeysForwarder`.
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
   * Optional set of shell-reserved chords. Strings in the `@napplet/nub/keys`
   * wire format (e.g. `'Ctrl+Shift+K'`, `'Cmd+P'`). When a napplet sends
   * `keys.forward` with a chord matching this set — or when a document
   * keydown matches a reserved chord — the service invokes `onForward`
   * (or the `hostBridge`-registered handler) but suppresses the
   * `keys.action` push to any napplet that registered the same chord via
   * `keys.registerAction`. Precedence: reserved > registered. The shell
   * WANTS the forward — that is why it reserved the chord.
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

/** Modifier-token aliases accepted by `parseChord` (case-insensitive). */
const MODIFIER_ALIASES: Record<string, keyof Pick<ChordSpec, 'ctrl' | 'alt' | 'shift' | 'meta'>> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  win: 'meta',
  super: 'meta',
};

/**
 * Parse a chord string into a `ChordSpec`. Modifier tokens are case-insensitive
 * and recognize common aliases (Cmd/Command/Win/Super → meta, Control → ctrl,
 * Option → alt). Single-character keys are normalized to uppercase so chord
 * matching is case-insensitive; multi-character DOM key names (`Enter`,
 * `ArrowUp`, `F4`) preserve their original casing.
 *
 * Examples:
 *   parseChord('Ctrl+Shift+K') → { ctrl: true, alt: false, shift: true, meta: false, key: 'K' }
 *   parseChord('ctrl+s')       → { ctrl: true, alt: false, shift: false, meta: false, key: 'S' }
 *   parseChord('Cmd+P')        → { ctrl: false, alt: false, shift: false, meta: true, key: 'P' }
 *   parseChord('K')            → { ctrl: false, alt: false, shift: false, meta: false, key: 'K' }
 *   parseChord('Ctrl++')       → { ctrl: true, alt: false, shift: false, meta: false, key: '+' }
 *
 * @throws Error('empty chord') when the input is the empty string.
 * @throws Error(`unknown modifier: ${tok}`) when a non-final token isn't a recognized modifier.
 * @throws Error(`empty key in chord: ${chord}`) when the final token is empty/whitespace.
 */
function parseChord(chord: string): ChordSpec {
  if (chord.length === 0) throw new Error('empty chord');
  const parts = chord.split('+');
  const out: ChordSpec = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
  // The final token is always the key — even if it is literally '+' (chord like 'Ctrl++').
  // All preceding tokens must be modifiers.
  for (let i = 0; i < parts.length - 1; i++) {
    const tok = parts[i].trim().toLowerCase();
    if (tok.length === 0) continue; // tolerate stray whitespace
    const slot = MODIFIER_ALIASES[tok];
    if (!slot) throw new Error(`unknown modifier: ${parts[i]}`);
    out[slot] = true;
  }
  const keyTok = parts[parts.length - 1].trim();
  if (keyTok.length === 0) throw new Error(`empty key in chord: ${chord}`);
  // Single characters normalize to uppercase for case-insensitive comparison;
  // multi-character DOM key names (Enter, ArrowUp, F4) preserve their original casing.
  out.key = keyTok.length === 1 ? keyTok.toUpperCase() : keyTok;
  return out;
}

/**
 * Create a keys service handler.
 *
 * Attaches a single `keydown` listener to `options.listenerTarget`
 * (default `document`). Matching chord subscriptions invoke `options.onForward`
 * with a DOM-shape payload AND push a `keys.action` envelope back to the
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
      ? 'NIP-5D keys NUB reference handler (host-bridge delegated)'
      : 'NIP-5D keys NUB reference handler (document-level chord listener)',
  };

  // ─── Reserved-chord set (KEYS-04/05, Phase 33) ────────────────────────────
  // Shell-reserved chords take precedence over napplet-registered actions.
  // Strings are parsed once via parseChord() then canonicalized to a stable
  // string key so runtime lookups are O(1) hash-set tests.
  //
  // `chordSpecKey` canonical form: `'<ctrl>|<alt>|<shift>|<meta>|<KEY>'`
  // (e.g. 'true|false|true|false|R' for 'Ctrl+Shift+R'). Chosen over
  // JSON.stringify for deterministic ordering across engines.
  function chordSpecKey(spec: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
    key: string;
  }): string {
    return `${spec.ctrl}|${spec.alt}|${spec.shift}|${spec.meta}|${spec.key}`;
  }
  const reservedChordKeys: Set<string> = new Set();
  if (options.reservedChords) {
    for (const chordStr of options.reservedChords) {
      // parseChord throws on malformed input — let it bubble up at construction
      // so misconfigured shells fail loudly at boot, not silently at runtime.
      reservedChordKeys.add(chordSpecKey(parseChord(chordStr)));
    }
  }
  // Canonicalize a wire-shape keys.forward payload into the same key.
  function forwardKey(m: {
    key: string;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  }): string {
    const k = m.key.length === 1 ? m.key.toUpperCase() : m.key;
    return `${m.ctrl}|${m.alt}|${m.shift}|${m.meta}|${k}`;
  }
  // Canonicalize a DOM KeyboardEvent into the same key (for Branch B keydown listener).
  function eventKey(ev: KeyboardEvent): string {
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    return `${ev.ctrlKey}|${ev.altKey}|${ev.shiftKey}|${ev.metaKey}|${k}`;
  }

  // ─── Branch A: host-bridge delegation ────────────────────────────────────
  // KEYS-02 per CONTEXT.md Area 2 — host-bridge override path. Bridge owns
  // chord subscription; service owns per-window bookkeeping so
  // onWindowDestroyed cleanup semantics stay identical to Branch B.
  if (options.hostBridge) {
    const bridge = options.hostBridge;
    // windowId → Set<actionId> — parallels Branch B for scoped cleanup.
    const bridgeWindowActions = new Map<string, Set<string>>();
    // actionId → unsubscribe handle returned from bridge.subscribe.
    const unsubscribeHandles = new Map<string, () => void>();

    return {
      descriptor,

      handleMessage(
        windowId: string,
        message: NappletMessage,
        send: (msg: NappletMessage) => void,
      ): void {
        switch (message.type) {
          case 'keys.forward': {
            // Legacy napplet-forwarded path still works identically — preserves wire contract.
            // Phase 33 / KEYS-04-05: reserved chords take precedence. The Branch-A
            // handler never dispatches keys.action to napplets on forward (bridge
            // owns chord → napplet routing via its own subscribe callback), so
            // reservation here is observationally identical to the base case —
            // but we compute and check the reservation explicitly to document
            // the contract for future edits and keep both branches uniform.
            const m = message as KeysForwardMessage;
            const reserved = reservedChordKeys.has(forwardKey(m));
            options.onForward?.({
              key: m.key,
              code: m.code,
              ctrlKey: m.ctrl,
              altKey: m.alt,
              shiftKey: m.shift,
              metaKey: m.meta,
            });
            if (reserved) {
              // Intent: the shell owns this chord; no napplet fan-out. Branch A
              // achieves that by construction (no keys.action push from forward),
              // but the explicit guard documents the contract for future edits.
              return;
            }
            return;
          }

          case 'keys.registerAction': {
            const m = message as KeysRegisterActionMessage;
            if (m.action.defaultKey) {
              try {
                const unsubscribe = bridge.subscribe(m.action.defaultKey, (ev) => {
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
                  // Canonical shell→napplet push: emit keys.action to the owning
                  // napplet. Shape matches Branch B (superset of KeysActionMessage);
                  // the `chord` extension is omitted here because bridges deliver
                  // pre-parsed chord events without the internal ChordSpec struct.
                  const payload: KeysActionMessage = {
                    type: 'keys.action',
                    actionId: m.action.id,
                  };
                  send(payload as NappletMessage);
                });
                unsubscribeHandles.set(m.action.id, unsubscribe);
                if (!bridgeWindowActions.has(windowId)) bridgeWindowActions.set(windowId, new Set());
                bridgeWindowActions.get(windowId)!.add(m.action.id);
              } catch (err) {
                const id = m.id ?? '';
                send({
                  type: 'keys.registerAction.error',
                  id,
                  error: `bridge subscribe failed: ${(err as Error).message}`,
                } as NappletMessage);
                return;
              }
            }
            const result: KeysRegisterActionResultMessage = {
              type: 'keys.registerAction.result',
              id: m.id,
              actionId: m.action.id,
              ...(m.action.defaultKey ? { binding: m.action.defaultKey } : {}),
            };
            send(result as NappletMessage);
            return;
          }

          case 'keys.unregisterAction': {
            const m = message as NappletMessage & { actionId?: string };
            if (m.actionId) {
              const unsubscribe = unsubscribeHandles.get(m.actionId);
              if (unsubscribe) {
                try {
                  unsubscribe();
                } catch {
                  /* best-effort */
                }
                unsubscribeHandles.delete(m.actionId);
                // Prune the bridgeWindowActions entry that owns this actionId.
                for (const [wid, set] of bridgeWindowActions.entries()) {
                  if (set.delete(m.actionId) && set.size === 0) bridgeWindowActions.delete(wid);
                }
              }
            }
            return;
          }

          default: {
            const id = (message as NappletMessage & { id?: string }).id ?? '';
            send({
              type: `${message.type}.error`,
              id,
              error: `Unknown keys method: ${message.type}`,
            } as NappletMessage);
            return;
          }
        }
      },

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
        }
        bridgeWindowActions.delete(windowId);
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
        bridgeWindowActions.clear();
      },
    };
  }

  // ─── Branch B: default document-listener (Plan 26-01 implementation) ─────
  // Subscription registries
  const actionRegistry = new Map<string, ActionEntry>(); // actionId → {chord, chordString, windowId}
  const windowActions = new Map<string, Set<string>>(); // windowId → Set<actionId>
  // Per-window `send` callback captured at registerAction time. Used to push
  // keys.action envelopes back to the owning napplet on chord match — this is
  // the canonical @napplet/nub/keys surface the SDK's `keys.onAction(...)`
  // helper consumes.
  const sendHandles = new Map<string, (msg: NappletMessage) => void>(); // windowId → send

  // ─── Listener target (SSR / test-safe fallback, mirrors keys-forwarder.ts) ─
  const target: EventTarget =
    options.listenerTarget ??
    (typeof document !== 'undefined' ? (document as unknown as EventTarget) : new EventTarget());

  // ─── Chord match helper ──────────────────────────────────────────────────
  function chordMatches(spec: ChordSpec, ev: KeyboardEvent): boolean {
    if (spec.ctrl !== ev.ctrlKey) return false;
    if (spec.alt !== ev.altKey) return false;
    if (spec.shift !== ev.shiftKey) return false;
    if (spec.meta !== ev.metaKey) return false;
    const evKey = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    return spec.key === evKey;
  }

  // ─── Document keydown listener ───────────────────────────────────────────
  const listener = (rawEv: Event): void => {
    const ev = rawEv as KeyboardEvent;
    if (ev.repeat) return; // ignore OS autorepeat — matches "I pressed it once" intent (CONTEXT Area 1)

    // Phase 33 / KEYS-04-05: reserved chords fire onForward but suppress
    // keys.action fan-out to napplets. Check ONCE up front.
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
      // (1) Host-side onForward hook — preserved from stub era. The demo
      //     uses it for console evidence + any host hotkey dispatcher.
      //     Fires on reserved chords even when no napplet registered the
      //     chord (WM-absolute case).
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

    // (2) Canonical shell→napplet push: emit keys.action to the owning
    //     napplet via its captured send callback. The SDK's keys.onAction
    //     helper subscribes to this envelope. We attach a `chord` extension
    //     field so the demo napplet can display the fired chord without
    //     reconstructing it from the original registration.
    for (const [actionId, entry] of actionRegistry.entries()) {
      if (chordMatches(entry.chord, ev)) {
        const send = sendHandles.get(entry.windowId);
        if (send) {
          const payload: KeysActionMessage & { chord: ChordSpec } = {
            type: 'keys.action',
            actionId,
            chord: entry.chord,
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

  return {
    descriptor,

    handleMessage(
      windowId: string,
      message: NappletMessage,
      send: (msg: NappletMessage) => void,
    ): void {
      switch (message.type) {
        case 'keys.forward': {
          // Legacy passthrough: napplet-forwarded keydown translation.
          // Preserved bit-for-bit from the stub — existing tests + the
          // keys-forwarder.ts -> service.handleMessage path depend on this shape.
          //
          // Phase 33 / KEYS-04-05: Branch B's keys.forward handler does NOT
          // emit keys.action (fan-out happens in the document keydown listener),
          // so reservation is observationally identical to the base case.
          // The explicit guard below pins the contract for future edits.
          const m = message as KeysForwardMessage;
          const reserved = reservedChordKeys.has(forwardKey(m));
          options.onForward?.({
            key: m.key,
            code: m.code,
            ctrlKey: m.ctrl,
            altKey: m.alt,
            shiftKey: m.shift,
            metaKey: m.meta,
          });
          if (reserved) return;
          return;
        }

        case 'keys.registerAction': {
          const m = message as KeysRegisterActionMessage;
          // Capture (or refresh) the per-window send callback. The runtime's
          // service-handler contract guarantees `send` remains valid for this
          // windowId until onWindowDestroyed(windowId) fires — we cache the
          // most recent invocation so the keydown listener can push
          // keys.action envelopes back to the owning napplet.
          sendHandles.set(windowId, send);

          // Register the subscription if a defaultKey is provided. Actions
          // without a defaultKey are registered with no chord (no-op in the
          // keydown listener); this matches stub behaviour where binding is
          // optional.
          if (m.action.defaultKey) {
            try {
              const chord = parseChord(m.action.defaultKey);
              actionRegistry.set(m.action.id, {
                chord,
                chordString: m.action.defaultKey,
                windowId,
              });
              if (!windowActions.has(windowId)) windowActions.set(windowId, new Set());
              windowActions.get(windowId)!.add(m.action.id);
            } catch (err) {
              // Parse failure: respond with .error envelope (unknown-method pattern).
              const id = m.id ?? '';
              send({
                type: 'keys.registerAction.error',
                id,
                error: `invalid chord: ${(err as Error).message}`,
              } as NappletMessage);
              return;
            }
          }
          const result: KeysRegisterActionResultMessage = {
            type: 'keys.registerAction.result',
            id: m.id,
            actionId: m.action.id,
            ...(m.action.defaultKey ? { binding: m.action.defaultKey } : {}),
          };
          send(result as NappletMessage);
          return;
        }

        case 'keys.unregisterAction': {
          // Fire-and-forget per @napplet/nub/keys spec. Remove subscription if present.
          const m = message as NappletMessage & { actionId?: string };
          if (m.actionId && actionRegistry.has(m.actionId)) {
            const entry = actionRegistry.get(m.actionId)!;
            actionRegistry.delete(m.actionId);
            const set = windowActions.get(entry.windowId);
            if (set) {
              set.delete(m.actionId);
              // If the window has no remaining actions, drop its cached send
              // handle too — prevents the listener from emitting to a window
              // that no longer subscribes to anything.
              if (set.size === 0) {
                windowActions.delete(entry.windowId);
                sendHandles.delete(entry.windowId);
              }
            }
          }
          return;
        }

        default: {
          const id = (message as NappletMessage & { id?: string }).id ?? '';
          send({
            type: `${message.type}.error`,
            id,
            error: `Unknown keys method: ${message.type}`,
          } as NappletMessage);
          return;
        }
      }
    },

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
