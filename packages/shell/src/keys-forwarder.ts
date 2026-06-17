/**
 * keys-forwarder.ts — Shell-side host keydown listener that forwards events
 * to registered napplets as `keys.forward` envelopes (Plan 12-11, NUB-05
 * shell-side half).
 *
 * Per `@napplet/nap/keys`, `keys.forward` is fire-and-forget (no result
 * envelope, no correlation id). Field names follow the nub convention:
 * `{ ctrl, alt, shift, meta }` — NOT the DOM-style `ctrlKey`/etc.
 *
 * Capability gate: only forwards to napplets whose ACL grants the
 * `keys:forward` capability (per Plan 12-10 `resolveCapabilitiesNub` 'keys'
 * case). The caller wires the cap-lookup via the `hasKeysForwardCap` dep so
 * this module stays free of any direct ACL-store dependency.
 *
 * Lifecycle: `createShellBridge()` attaches a forwarder on construction and
 * detaches it inside `bridge.destroy()`.
 */

import type { NappletMessage } from '@napplet/core';
import type { SessionEntry } from './types.js';

/**
 * Minimal origin-registry contract used by the forwarder — matches the
 * `@kehto/shell` singleton `originRegistry` and test doubles alike.
 */
export interface KeysForwarderOriginRegistry {
  /** Resolve a registered napplet windowId to its iframe Window, or null. */
  getIframeWindow(windowId: string): Window | null;
}

/**
 * Minimal session-registry contract used by the forwarder — matches the
 * `@kehto/shell` singleton `sessionRegistry` and test doubles alike.
 */
export interface KeysForwarderSessionRegistry {
  /** Return every registered napplet session entry. */
  getAllEntries(): SessionEntry[];
}

/**
 * Dependencies for `createKeysForwarder`.
 *
 * @example
 * ```ts
 * const forwarder = createKeysForwarder({
 *   originRegistry,
 *   sessionRegistry,
 *   hasKeysForwardCap: (pubkey) =>
 *     aclStore.getAclEntry(pubkey)?.capabilities.includes('keys:forward') ?? false,
 * });
 * ```
 */
export interface KeysForwarderDeps {
  /** Origin registry for resolving windowId → iframe Window. */
  originRegistry: KeysForwarderOriginRegistry;
  /** Session registry for enumerating napplets to forward to. */
  sessionRegistry: KeysForwarderSessionRegistry;
  /**
   * Capability check: returns true when the given napplet pubkey holds the
   * `keys:forward` capability. Called per keydown per registered napplet —
   * keep the implementation cheap.
   */
  hasKeysForwardCap(pubkey: string): boolean;
  /**
   * Optional EventTarget to attach to. Defaults to the global `window` when
   * running in a DOM environment. Passing a fresh `new EventTarget()` is
   * useful for unit tests.
   */
  target?: EventTarget;
}

/**
 * Handle returned by `createKeysForwarder`. Call `destroy()` to remove the
 * keydown listener (e.g. inside `bridge.destroy()`).
 */
export interface KeysForwarder {
  /** Detach the keydown listener and release resources. */
  destroy(): void;
}

/**
 * The `keys.forward` envelope shape emitted by this forwarder. Matches
 * `@napplet/nap/keys` `KeysForwardMessage`.
 */
interface KeysForwardEnvelope extends NappletMessage {
  type: 'keys.forward';
  key: string;
  code: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/**
 * Create a host-keydown forwarder that posts `keys.forward` envelopes to
 * every registered napplet granted the `keys:forward` capability.
 *
 * @param deps - Origin registry, session registry, cap checker, optional target
 * @returns A {@link KeysForwarder} — call `destroy()` to detach
 * @example
 * ```ts
 * // Inside createShellBridge():
 * const keysForwarder = createKeysForwarder({
 *   originRegistry,
 *   sessionRegistry,
 *   hasKeysForwardCap: (pubkey) =>
 *     aclStore.getAclEntry(pubkey)?.capabilities.includes('keys:forward') ?? false,
 * });
 * // ...
 * // Inside bridge.destroy():
 * keysForwarder.destroy();
 * ```
 */
export function createKeysForwarder(deps: KeysForwarderDeps): KeysForwarder {
  // Fallback to the global window when running in a DOM environment; when
  // neither a target nor a window is available (SSR / early Node tests),
  // create an isolated EventTarget so addEventListener never throws. The
  // resulting forwarder is effectively inert until the caller dispatches
  // keydowns on the chosen target.
  const target: EventTarget =
    deps.target ?? (typeof window !== 'undefined' ? window : new EventTarget());

  const listener = (ev: Event): void => {
    const ke = ev as Event & {
      key?: string; code?: string;
      ctrlKey?: boolean; altKey?: boolean;
      shiftKey?: boolean; metaKey?: boolean;
    };

    const entries = deps.sessionRegistry.getAllEntries();
    for (const entry of entries) {
      if (!deps.hasKeysForwardCap(entry.pubkey)) continue;
      const iframe = deps.originRegistry.getIframeWindow(entry.windowId);
      if (!iframe) continue;

      const envelope: KeysForwardEnvelope = {
        type: 'keys.forward',
        key: ke.key ?? '',
        code: ke.code ?? '',
        ctrl: ke.ctrlKey ?? false,
        alt: ke.altKey ?? false,
        shift: ke.shiftKey ?? false,
        meta: ke.metaKey ?? false,
      };
      iframe.postMessage(envelope, '*');
    }
  };

  target.addEventListener('keydown', listener);

  return {
    destroy(): void {
      target.removeEventListener('keydown', listener);
    },
  };
}
