
import type { ShellEnvironment } from './types.js';
import type { PermissionPrincipal } from '@kehto/runtime';

interface OriginEntry {
  windowId: string;
  dTag?: string;
  aggregateHash?: string;
  permissionPrincipal?: PermissionPrincipal;
  environment?: ShellEnvironment;
  registrationId: number;
  /** The NIP-5D port handed over by this frame's single `napplet.hello`. */
  port?: MessagePort;
}

/**
 * Minimal outbound target for one napplet. NIP-5D carries every NAP message
 * over the port bound by `napplet.hello`, so this never wraps the iframe
 * `Window`.
 *
 * @example
 * ```ts
 * originRegistry.getNappletTarget('napp-1')?.postMessage({ type: 'relay.eose', subId });
 * ```
 */
export interface NappletMessageTarget {
  /** Post one NAP envelope over the bound port. Dropped when no port is bound. */
  postMessage(message: unknown): void;
}

/** NIP-5D identity metadata associated with a registered iframe window. */
export interface OriginIdentity {
  readonly dTag: string;
  readonly aggregateHash: string;
  /** Verified catalog/artifact identity or explicit development target, supplied by the host. */
  readonly permissionPrincipal?: PermissionPrincipal;
}

const registry = new Map<Window, OriginEntry>();
/**
 * Windows whose verified document already handed over (or was revoked before
 * handing over) its NIP-5D port. NIP-5D forbids re-binding a napplet identity
 * to an existing iframe, so a spent Window can never be registered again.
 */
let spentWindows = new WeakSet<Window>();
let nextRegistrationId = 0;

function entryFor(windowId: string): OriginEntry | undefined {
  for (const entry of registry.values()) {
    if (entry.windowId === windowId) return entry;
  }
  return undefined;
}

function closePort(entry: OriginEntry): void {
  const port = entry.port;
  if (!port) return;
  entry.port = undefined;
  port.onmessage = null;
  port.close();
}

/**
 * Registry mapping each shell-created iframe Window to its windowId, verified
 * NIP-5D identity, and the `MessagePort` bound by its single `napplet.hello`.
 * The Window is only used to authenticate the hello; all NAP traffic uses the
 * bound port (NIP-5D, nostr-protocol/nips#2303).
 *
 * @example
 * ```ts
 * import { originRegistry } from '@kehto/shell';
 *
 * originRegistry.register(iframe.contentWindow, 'napp-1');
 * const id = originRegistry.getWindowId(iframe.contentWindow); // 'napp-1'
 * ```
 */
export interface OriginRegistry {
  register(win: Window, windowId: string, identity?: OriginIdentity): void;
  unregister(windowId: string): void;
  bindPort(windowId: string, port: MessagePort): boolean;
  getPort(windowId: string): MessagePort | undefined;
  postToNapplet(windowId: string, message: unknown): boolean;
  getNappletTarget(windowId: string): NappletMessageTarget | null;
  isSpent(win: Window): boolean;
  getWindowId(win: Window): string | undefined;
  getIframeWindow(windowId: string): Window | null;
  getAllWindowIds(): string[];
  getIdentity(win: Window): OriginIdentity | undefined;
  setEnvironment(win: Window, environment: ShellEnvironment): void;
  getEnvironment(win: Window): ShellEnvironment | undefined;
  getRegistrationId(win: Window): number | undefined;
  clear(): void;
}

/** Shell-wide iframe window registry singleton. */
export const originRegistry: OriginRegistry = {
  /**
   * Register a window reference with a windowId and optional identity metadata.
   *
   * @param win - The iframe's contentWindow reference
   * @param windowId - The unique identifier for this napplet window
   * @param identity - Optional NIP-5D identity metadata (dTag and aggregateHash)
   * @throws {Error} When `win` already bound a NIP-5D port. NIP-5D identity is
   *   bound to one document; hosts must create a fresh iframe instead.
   */
  register(win: Window, windowId: string, identity?: OriginIdentity): void {
    if (spentWindows.has(win)) {
      throw new Error('NIP-5D: cannot re-bind a napplet identity to an existing iframe; create a fresh iframe');
    }
    for (const [registeredWin, entry] of registry.entries()) {
      if (registeredWin === win || entry.windowId === windowId) {
        closePort(entry);
        if (registeredWin !== win) spentWindows.add(registeredWin);
        registry.delete(registeredWin);
      }
    }

    registry.set(win, {
      windowId,
      dTag: identity?.dTag,
      aggregateHash: identity?.aggregateHash,
      ...(identity?.permissionPrincipal ? { permissionPrincipal: Object.freeze({ ...identity.permissionPrincipal }) } : {}),
      registrationId: ++nextRegistrationId,
    });
  },

  /**
   * Unregister a window by its windowId, removing the mapping.
   *
   * @param windowId - The window identifier to remove
   */
  unregister(windowId: string): void {
    for (const [win, entry] of registry.entries()) {
      if (entry.windowId === windowId) {
        closePort(entry);
        spentWindows.add(win);
        registry.delete(win);
      }
    }
  },

  /**
   * Bind the NIP-5D port from a frame's single `napplet.hello`.
   *
   * @param windowId - The registered window identifier
   * @param port - The one port transferred with the hello
   * @returns `false` when the window is unknown or already bound
   */
  bindPort(windowId: string, port: MessagePort): boolean {
    for (const [win, entry] of registry.entries()) {
      if (entry.windowId !== windowId) continue;
      if (entry.port || spentWindows.has(win)) return false;
      entry.port = port;
      spentWindows.add(win);
      return true;
    }
    return false;
  },

  /**
   * Look up the bound NIP-5D port for a window.
   *
   * @param windowId - The window identifier
   * @returns The bound port, or undefined before `napplet.hello`
   */
  getPort(windowId: string): MessagePort | undefined {
    return entryFor(windowId)?.port;
  },

  /**
   * Send one NAP envelope to a napplet over its bound port. Never falls back
   * to `iframeWindow.postMessage`.
   *
   * @param windowId - The window identifier
   * @param message - The envelope to send
   * @returns `true` when a bound port carried the message
   */
  postToNapplet(windowId: string, message: unknown): boolean {
    const port = entryFor(windowId)?.port;
    if (!port) return false;
    port.postMessage(message);
    return true;
  },

  /**
   * Return a port-backed outbound target for one napplet window.
   *
   * @param windowId - The window identifier
   * @returns A target that sends through {@link OriginRegistry.postToNapplet}, or null when unregistered
   */
  getNappletTarget(windowId: string): NappletMessageTarget | null {
    if (!entryFor(windowId)) return null;
    return { postMessage: (message: unknown) => { originRegistry.postToNapplet(windowId, message); } };
  },

  /**
   * Whether a Window already handed over (or lost) its one NIP-5D binding.
   *
   * @param win - The iframe `contentWindow`
   * @returns `true` when the Window can never be registered again
   */
  isSpent(win: Window): boolean {
    return spentWindows.has(win);
  },

  /**
   * Look up the windowId for a given Window reference.
   *
   * @param win - The Window reference (typically from event.source)
   * @returns The windowId string, or undefined if not registered
   */
  getWindowId(win: Window): string | undefined {
    return registry.get(win)?.windowId;
  },

  /**
   * Look up the Window reference for a given windowId.
   *
   * @param windowId - The window identifier to look up
   * @returns The Window reference, or null if not found
   */
  getIframeWindow(windowId: string): Window | null {
    for (const [win, entry] of registry.entries()) {
      if (entry.windowId === windowId) return win;
    }
    return null;
  },

  /**
   * Get all registered windowId strings.
   *
   * @returns Array of all registered window identifiers
   */
  getAllWindowIds(): string[] {
    return Array.from(registry.values()).map(entry => entry.windowId);
  },

  /**
   * Get identity metadata for a registered Window.
   *
   * @param win - The Window reference to look up
   * @returns Identity metadata, or undefined if not registered or no identity set
   */
  getIdentity(win: Window): OriginIdentity | undefined {
    const entry = registry.get(win);
    if (typeof entry?.dTag !== 'string' || !entry?.aggregateHash) return undefined;
    return { dTag: entry.dTag, aggregateHash: entry.aggregateHash,
      ...(entry.permissionPrincipal ? { permissionPrincipal: entry.permissionPrincipal } : {}) };
  },

  /** Store the immutable environment captured for this exact frame registration. */
  setEnvironment(win: Window, environment: ShellEnvironment): void {
    const entry = registry.get(win);
    if (!entry) return;
    entry.environment = Object.freeze({
      capabilities: Object.freeze({ domains: Object.freeze([...environment.capabilities.domains]) }),
      services: Object.freeze([...environment.services]),
    });
  },

  /** Return the immutable environment captured before this frame executes. */
  getEnvironment(win: Window): ShellEnvironment | undefined {
    return registry.get(win)?.environment;
  },

  /**
   * Look up the monotonically increasing registration id for a Window.
   *
   * @param win - The Window reference to look up
   * @returns The registration id, or undefined if the Window is not registered
   */
  getRegistrationId(win: Window): number | undefined {
    return registry.get(win)?.registrationId;
  },

  /** Clear all registrations and close every bound port. */
  clear(): void {
    for (const entry of registry.values()) closePort(entry);
    registry.clear();
    spentWindows = new WeakSet<Window>();
  },
};
