
interface OriginEntry {
  windowId: string;
  dTag?: string;
  aggregateHash?: string;
}

const registry = new Map<Window, OriginEntry>();

/**
 * Bidirectional registry mapping Window references to windowId strings.
 * Optionally stores NIP-5D identity metadata (dTag and aggregateHash) per window.
 *
 * @example
 * ```ts
 * import { originRegistry } from '@kehto/shell';
 *
 * originRegistry.register(iframe.contentWindow, 'napp-1');
 * const id = originRegistry.getWindowId(iframe.contentWindow); // 'napp-1'
 * ```
 */
export const originRegistry = {
  /**
   * Register a window reference with a windowId and optional identity metadata.
   *
   * @param win - The iframe's contentWindow reference
   * @param windowId - The unique identifier for this napplet window
   * @param identity - Optional NIP-5D identity metadata (dTag and aggregateHash)
   */
  register(win: Window, windowId: string, identity?: { dTag: string; aggregateHash: string }): void {
    registry.set(win, {
      windowId,
      dTag: identity?.dTag,
      aggregateHash: identity?.aggregateHash,
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
        registry.delete(win);
      }
    }
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
  getIdentity(win: Window): { dTag: string; aggregateHash: string } | undefined {
    const entry = registry.get(win);
    if (!entry?.dTag || !entry?.aggregateHash) return undefined;
    return { dTag: entry.dTag, aggregateHash: entry.aggregateHash };
  },

  /** Clear all registrations. */
  clear(): void {
    registry.clear();
  },
};
