/**
 * Revocation backstop for the opt-in nested-context lock (kehto/web#381). Under the lock a napplet has no legitimate
 * child browsing context, so a non-zero `window.length` on its Window means some creation path got past the lock
 * (the XSLT path closed in this change was one). The transport checks on events it already handles, the frame's
 * `load` and each envelope from the bound port, so there is no polling and no check for unlocked napplets. Detection,
 * not prevention: a child created and removed between two of those events goes unseen, and one that is seen has
 * already run once.
 *
 * @see docs/policies/NIP-5D-CONFORMANCE.md — "Nested browsing contexts"
 */

const lockedWindows = new Set<string>();

/**
 * Record whether a window was admitted with the nested-context lock. Admission calls this for every document it
 * commits, so a later unlocked admission under the same window id clears the mark.
 *
 * @param windowId - The admitted window
 * @param locked - Whether its document runs with the nested-context lock
 */
export function setNestedContextLocked(windowId: string, locked: boolean): void {
  if (locked) lockedWindows.add(windowId);
  else lockedWindows.delete(windowId);
}

/**
 * Whether a window runs under the nested-context lock.
 *
 * @param windowId - The window to check
 * @returns True when the tripwire applies
 */
export function isNestedContextLocked(windowId: string): boolean {
  return lockedWindows.has(windowId);
}

/**
 * Whether a locked napplet window currently holds a child browsing context. Reading `length` is allowed across
 * origins; a detached or inaccessible Window reports no children.
 *
 * @param win - The napplet's Window
 * @returns True when the napplet holds at least one child frame
 */
export function hasNestedContext(win: Pick<Window, 'length'> | null | undefined): boolean {
  try {
    return typeof win?.length === 'number' && win.length > 0;
  } catch {
    return false;
  }
}
