/**
 * cvm-operations.ts — lifecycle of admitted NAP-CVM operations.
 *
 * One operation is one napplet-to-shell envelope that can reach the transport
 * (`cvm.discover`, `cvm.request`, `cvm.registry.*`). Each one holds a single
 * admission ticket from receipt until it settles, whatever the reason: result,
 * error, deadline, `cvm.close`, window teardown, permission revocation, or
 * service disposal.
 *
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb, Timeouts): the accepted duration runs
 * "from receipt through queueing, initialization, consent, payment, and final
 * response". The deadline timer therefore starts before admission, so time
 * spent waiting for a slot is spent from the same budget.
 */

import { createCvmAdmission, type CvmAdmissionTicket, type CvmConcurrencyOptions } from './cvm-admission.js';

/** What a running operation can see of its own lifecycle. */
export interface CvmOperation {
  /** Aborts on deadline, close, teardown, revocation, or disposal. */
  readonly signal: AbortSignal;
  /** Server pubkeys this operation contacts; `cvm.close` matches against it. */
  readonly servers: Set<string>;
  /** Milliseconds left before the deadline. Throws `relay timeout` at zero. */
  remaining(): number;
  /** Settle this operation with a top-level NAP-CVM error string. */
  abort(reason: string): void;
}

interface Tracked {
  readonly handle: CvmOperation;
  settled: Promise<void>;
}

/** How {@link CvmOperations.run} admits an operation. */
export interface CvmRunOptions {
  /**
   * `false` runs at once without a slot or queue position. Only for work that
   * acts on an operation already admitted, such as the `notifications/cancelled`
   * that ends it; it keeps its deadline and still ends on close or teardown.
   * Default `true`.
   */
  readonly admit?: boolean;
}

/** Tracker returned by {@link createCvmOperations}. */
export interface CvmOperations {
  /**
   * Admit and run one operation for an authenticated endpoint. Exactly one of
   * `resolve` or `reject` is called. A full queue rejects with `policy denied`
   * without running `body`.
   *
   * @returns The tracked operation, also while it is still queued, or
   * `undefined` when admission refused it.
   */
  run<T>(owner: string, durationMs: number, servers: readonly string[],
    body: (operation: CvmOperation) => Promise<T>,
    resolve: (value: T) => void, reject: (error: unknown) => void,
    options?: CvmRunOptions): CvmOperation | undefined;
  /**
   * Abort the matching operations and resolve once each has delivered its
   * terminal result and released its slot. Omit `owner` to match every endpoint.
   */
  cancel(owner: string | undefined, reason: string, match?: (operation: CvmOperation) => boolean): Promise<void>;
  /** Operations currently holding a slot for this endpoint. */
  inFlight(owner: string): number;
  /** Operations currently queued for this endpoint. */
  queued(owner: string): number;
}

/** Start at once, holding nothing. */
function unadmitted(begin: () => void): CvmAdmissionTicket {
  begin();
  return { release() {} };
}

/**
 * Create the operation tracker for one CVM service instance.
 *
 * @param concurrency - Per-endpoint admission limits.
 * @returns A tracker whose slots are never shared between endpoints.
 * @example
 * ```ts
 * const operations = createCvmOperations({ maxInFlight: 4 });
 * operations.run('window-1', 30_000, [], async (op) => fetchSomething(op.signal), onValue, onError);
 * ```
 */
export function createCvmOperations(concurrency?: CvmConcurrencyOptions): CvmOperations {
  const admission = createCvmAdmission(concurrency);
  const tracked = new Map<string, Set<Tracked>>();

  return {
    run(owner, durationMs, servers, body, resolve, reject, options = {}) {
      const controller = new AbortController();
      const deadline = Date.now() + durationMs;
      const handle: CvmOperation = {
        signal: controller.signal,
        servers: new Set(servers),
        remaining() {
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw new Error('relay timeout');
          return remaining;
        },
        abort(reason) { controller.abort(new Error(reason)); },
      };
      let begin!: () => void;
      const work = new Promise<unknown>((done, fail) => {
        begin = () => { try { done(body(handle)); } catch (error) { fail(error); } };
      });
      const ticket = options.admit === false ? unadmitted(begin) : admission.admit(owner, begin);
      if (!ticket) {
        // Spec gap: NAP-CVM #31 @ 28cf1bdb has no load-shedding error. Admission
        // is shell policy, so overflow reuses `policy denied`, matching how a
        // busy approval budget already surfaces for this domain.
        reject(new Error('policy denied'));
        return undefined;
      }
      const timer = setTimeout(() => handle.abort('relay timeout'), durationMs);
      const aborted = new Promise<never>((_done, fail) => {
        controller.signal.addEventListener('abort', () => fail(controller.signal.reason), { once: true });
      });
      let operations = tracked.get(owner);
      if (!operations) { operations = new Set(); tracked.set(owner, operations); }
      const owned = operations;
      const entry: Tracked = { handle, settled: Promise.resolve() };
      owned.add(entry);
      entry.settled = Promise.race([work, aborted])
        .then((value) => resolve(value as never), reject)
        .catch(() => undefined)
        .finally(() => {
          clearTimeout(timer);
          ticket.release();
          owned.delete(entry);
          if (owned.size === 0 && tracked.get(owner) === owned) tracked.delete(owner);
        });
      return handle;
    },
    cancel(owner, reason, match) {
      const settled: Promise<void>[] = [];
      for (const [candidate, operations] of tracked) {
        if (owner !== undefined && candidate !== owner) continue;
        // Entries leave the set asynchronously, after their terminal result.
        for (const entry of operations) {
          if (match && !match(entry.handle)) continue;
          entry.handle.abort(reason);
          settled.push(entry.settled);
        }
      }
      return Promise.all(settled).then(() => undefined);
    },
    inFlight: admission.inFlight,
    queued: admission.queued,
  };
}
