/**
 * cvm-admission.ts — per-endpoint admission for NAP-CVM operations.
 *
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb, Security Considerations) says shells
 * SHOULD apply per-napplet concurrency limits. The Nostr transport has no
 * caller principal, so the limit lives here, at the service boundary where
 * the runtime has already authenticated the calling endpoint.
 *
 * Each owner (authenticated endpoint) gets its own slots and its own bounded
 * FIFO queue. Nothing is shared between owners, so one endpoint filling its
 * budget cannot consume or delay another endpoint's operations.
 */

/** Host-selected NAP-CVM admission limits, applied per authenticated endpoint. */
export interface CvmConcurrencyOptions {
  /** Operations one endpoint may have running at once. Integer >= 1; default 8. */
  maxInFlight?: number;
  /** Operations one endpoint may have waiting for a slot. Integer >= 0; default 32. */
  maxQueued?: number;
}

/** Default number of concurrently running CVM operations per endpoint. */
export const DEFAULT_CVM_MAX_IN_FLIGHT = 8;
/** Default number of CVM operations waiting for a slot per endpoint. */
export const DEFAULT_CVM_MAX_QUEUED = 32;

/** A held slot or queue position. `release()` is idempotent. */
export interface CvmAdmissionTicket {
  release(): void;
}

/** Per-owner slot accounting. Owners never share state. */
export interface CvmAdmission {
  /**
   * Take a slot or a queue position. `start` runs synchronously when a slot is
   * free, later when a predecessor releases one, and never once released.
   * Returns `undefined` when the owner's slots and queue are both full.
   */
  admit(owner: string, start: () => void): CvmAdmissionTicket | undefined;
  /** Operations currently holding a slot for this owner. */
  inFlight(owner: string): number;
  /** Operations currently waiting for a slot for this owner. */
  queued(owner: string): number;
}

interface Waiter { start: () => void }
interface OwnerState { running: number; waiting: Waiter[] }

function limit(value: number | undefined, fallback: number, minimum: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`createCvmService: concurrency.${name} must be an integer >= ${minimum}`);
  }
  return value;
}

/**
 * Create per-owner admission state.
 *
 * @param options - Slot and queue limits; see {@link CvmConcurrencyOptions}.
 * @returns Admission accounting keyed by owner.
 * @throws RangeError when a limit is not an integer in range.
 * @example
 * ```ts
 * const admission = createCvmAdmission({ maxInFlight: 2, maxQueued: 4 });
 * const ticket = admission.admit('window-1', () => startWork());
 * if (!ticket) rejectAsOverloaded();
 * ```
 */
export function createCvmAdmission(options: CvmConcurrencyOptions = {}): CvmAdmission {
  const maxInFlight = limit(options.maxInFlight, DEFAULT_CVM_MAX_IN_FLIGHT, 1, 'maxInFlight');
  const maxQueued = limit(options.maxQueued, DEFAULT_CVM_MAX_QUEUED, 0, 'maxQueued');
  const owners = new Map<string, OwnerState>();

  function begin(waiter: Waiter): void {
    // A failing start still owns its slot until its ticket is released.
    try { waiter.start(); } catch { /* The caller settles and releases. */ }
  }

  function free(owner: string, state: OwnerState): void {
    state.running--;
    const next = state.waiting.shift();
    if (next) { state.running++; begin(next); }
    else if (state.running === 0) owners.delete(owner);
  }

  return {
    admit(owner, start) {
      let state = owners.get(owner);
      if (!state) { state = { running: 0, waiting: [] }; owners.set(owner, state); }
      const held = state;
      const waiter: Waiter = { start };
      const immediate = held.running < maxInFlight;
      if (!immediate && held.waiting.length >= maxQueued) {
        if (held.running === 0 && held.waiting.length === 0) owners.delete(owner);
        return undefined;
      }
      let released = false;
      const ticket: CvmAdmissionTicket = {
        release() {
          if (released) return;
          released = true;
          const position = held.waiting.indexOf(waiter);
          if (position >= 0) held.waiting.splice(position, 1);
          else free(owner, held);
        },
      };
      if (immediate) { held.running++; begin(waiter); }
      else held.waiting.push(waiter);
      return ticket;
    },
    inFlight: (owner) => owners.get(owner)?.running ?? 0,
    queued: (owner) => owners.get(owner)?.waiting.length ?? 0,
  };
}
