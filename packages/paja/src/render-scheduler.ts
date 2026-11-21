/**
 * Coalesce Paja's developer-panel renders to one per frame.
 *
 * The message log and the Events panel used to re-render synchronously for
 * every message and every relay receipt. A feed reading from hundreds of relays
 * produces thousands of those in a few seconds. Each render rebuilt every row
 * and forced a layout, which froze the host for close to a minute. The data
 * still updates synchronously; only the DOM work is deferred, and repeated
 * requests within one frame collapse into one render of the latest state.
 *
 * @module
 */

type FrameScheduler = (callback: () => void) => void;

function defaultScheduler(): FrameScheduler {
  if (typeof requestAnimationFrame === 'function') return (callback) => { requestAnimationFrame(() => callback()); };
  return (callback) => { setTimeout(callback, 0); };
}

/**
 * Wrap a render so that any number of calls within one frame run it once.
 *
 * @param render - The render to coalesce.
 * @param schedule - Frame scheduler; defaults to `requestAnimationFrame`, or a
 *   zero-delay timeout where that is unavailable.
 * @returns A function that requests a render of the latest state.
 * @example
 * ```ts
 * const requestRender = coalescePajaRender(() => renderPajaMessageLog(state));
 * for (const message of burst) { state.messageLog.push(message); requestRender(); }
 * ```
 */
export function coalescePajaRender(render: () => void, schedule: FrameScheduler = defaultScheduler()): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    schedule(() => {
      pending = false;
      render();
    });
  };
}
