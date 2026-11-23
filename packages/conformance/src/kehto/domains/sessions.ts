/**
 * kehto/domains/sessions.ts — Deterministic session bookkeeping for device-style backends.
 *
 * Serial, BLE and WebRTC sessions are runtime-assigned. A fixture cannot read a
 * reply value back into a later request, so these backends hand out the lowest
 * free `<prefix>-<n>` id: the first open session is always `<prefix>-1`, and a
 * closed id is reused. Each session keeps the `emit` its open context gave it,
 * which host controls use to push device events.
 */

/** One open session and the event emitter its open context received. */
export interface TrackedSession<E> {
  readonly id: string;
  readonly windowId: string;
  readonly emit: (event: E) => void;
}

/** Session table for one backend instance. */
export interface SessionTable<E> {
  /** Allocate the lowest free id and remember its emitter. */
  open(windowId: string, emit: (event: E) => void): string;
  close(id: string): void;
  /** Forget every session of a window. */
  dropWindow(windowId: string): void;
  /** Open sessions, oldest id first. */
  list(): readonly TrackedSession<E>[];
  /**
   * Every session opened by a live window, closed ones included. A host control
   * simulating the device emits on these, so delivery after close is the
   * runtime's decision to drop, not the backend's.
   */
  everOpened(): readonly TrackedSession<E>[];
}

/**
 * Create a session table whose ids are `<prefix>-1`, `<prefix>-2`, ...
 *
 * @param prefix - Id prefix, e.g. `serial`.
 * @returns The table.
 * @example
 * ```ts
 * const table = createSessionTable<SerialEvent>('serial');
 * table.open('win-1', emit); // 'serial-1'
 * ```
 */
export function createSessionTable<E>(prefix: string): SessionTable<E> {
  const sessions = new Map<string, TrackedSession<E>>();
  let history: TrackedSession<E>[] = [];
  return {
    open(windowId, emit) {
      let n = 1;
      while (sessions.has(`${prefix}-${n}`)) n += 1;
      const id = `${prefix}-${n}`;
      const session = { id, windowId, emit };
      sessions.set(id, session);
      history.push(session);
      return id;
    },
    close(id) { sessions.delete(id); },
    dropWindow(windowId) {
      for (const [id, session] of sessions) if (session.windowId === windowId) sessions.delete(id);
      history = history.filter((session) => session.windowId !== windowId);
    },
    list: () => [...sessions.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })),
    everOpened: () => [...history],
  };
}
