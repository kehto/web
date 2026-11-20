/**
 * cvm-local-cancel.ts — a napplet's `notifications/cancelled` for its own
 * NAP-CVM request (kehto/web#510).
 *
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb, Message handling): "`notifications/cancelled`
 * may refer only to this napplet's requests", and a shell that maps request
 * ids "consistently maps request references such as cancellation". Error
 * Handling: every request gets "exactly one corresponding `.result`". Timeouts:
 * "A late response MUST NOT produce a second result or be redelivered as
 * `cvm.event`." MCP 2025-11-25 cancellation: the sender "SHOULD ignore any
 * response to the request that arrives afterward".
 *
 * So a cancellation ends the napplet's own request in the shell, whatever
 * stage it has reached:
 * - Queued for admission or awaiting approval: it is dropped before
 *   publication. Nothing reaches the transport and no approval is asked.
 * - Handed to the transport: the cancellation is published through
 *   `CvmTransport.cancel` (#509), then the request is settled locally. A
 *   transport still preparing the request sees its signal abort and never
 *   sends it.
 * - Already settled, or already being cancelled: acknowledged once policy
 *   allows it, nothing published.
 *
 * The cancellation itself never takes an admission slot: it only ever ends
 * work that was already admitted. Except for a local drop, which publishes
 * nothing and withdraws the target's own prompt, it runs under the same
 * policy and approval every `cvm.request` gets, keeps its own deadline, and ends
 * on close or teardown like any operation.
 *
 * Spec-gap decision: the draft's error table names no error for a request
 * its own napplet cancelled. The request settles with {@link CANCELLED_REQUEST_ERROR}.
 */
import type { CvmOperation, CvmOperations } from './cvm-operations.js';
import type { CvmCorrelations, CvmRequestHandle } from './cvm-correlation.js';
import type { CvmServerRef } from './cvm-types.js';

/**
 * Result error of a request its own napplet cancelled. NAP-CVM #31 @ 28cf1bdb
 * defines no cancellation error; `session closed` ("The calling endpoint
 * released the session while work was pending") is the only code for pending
 * work the calling endpoint ended itself. `relay timeout` would claim a
 * deadline passed, and `policy denied` an ACL decision.
 */
export const CANCELLED_REQUEST_ERROR = 'session closed';

/** Where one napplet request is in its lifecycle, as cancellation needs it. */
export interface CvmRequestState {
  /** The tracked operation, set once admission accepts it. */
  operation?: CvmOperation;
  /** Set synchronously right before the request is handed to the transport. */
  dispatched: boolean;
  /** Set by the first cancellation, so a repeat publishes nothing. */
  cancelling: boolean;
}

/** What the cancellation path needs from the CVM service. */
export interface CvmCancelDeps {
  readonly operations: CvmOperations;
  readonly correlations: CvmCorrelations;
  readonly requests: WeakMap<CvmRequestHandle, CvmRequestState>;
  /** Run `execute` under the policy and approval every `cvm.request` to this server gets. */
  readonly authorize: (work: CvmOperation, execute: () => Promise<void>) => Promise<void>;
  /** Publish the mapped cancellation; see `CvmTransport.cancel`. */
  readonly publish: (work: CvmOperation, handle: CvmRequestHandle) => Promise<void>;
  readonly ack: () => void;
  readonly fail: (error: unknown) => void;
}

/** One cancellation envelope, already validated. */
export interface CvmCancelEnvelope {
  readonly windowId: string;
  readonly generation: symbol;
  readonly server: CvmServerRef;
  readonly requestId: unknown;
  /** The cancellation's own accepted duration. */
  readonly duration: number;
}

/**
 * Handle a napplet's `notifications/cancelled`. Exactly one of `ack` or `fail`
 * is called; when the target is settled here, its own result goes out first.
 *
 * @param deps - Service state and reply callbacks.
 * @param envelope - The validated cancellation.
 * @example
 * ```ts
 * handleCvmCancellation(deps, { windowId, generation, server, requestId: 2, duration: 30_000 });
 * ```
 */
export function handleCvmCancellation(deps: CvmCancelDeps, envelope: CvmCancelEnvelope): void {
  const { operations, correlations, requests, ack, fail } = deps;
  const { windowId, generation, server, requestId } = envelope;
  const target = correlations.cancelTarget(windowId, generation, server.pubkey, requestId);
  // Spec-gap decision (#509): naming no request of this napplet in this
  // session is `invalid message`, never published.
  if (target.state === 'foreign') { fail('invalid message'); return; }
  const handle = target.state === 'in-flight' ? target.handle : undefined;
  const request = handle ? requests.get(handle) : undefined;
  const live = handle && request && !request.cancelling ? request : undefined;
  const settleTarget = () => operations.cancel(windowId, CANCELLED_REQUEST_ERROR, (operation) => operation === live?.operation);
  if (live) live.cancelling = true;
  // Not handed to the transport yet: dropped here, so there is nothing to approve.
  if (live && !live.dispatched) { void settleTarget().then(ack); return; }
  // Settled or already being cancelled: nothing to publish, but still under
  // the policy every cvm.request gets, so a denied napplet stays denied.
  operations.run(windowId, envelope.duration, [server.pubkey], (work) => deps.authorize(work, async () => {
    // It may have settled while this cancellation awaited approval.
    if (live && handle && correlations.cancelTarget(windowId, generation, server.pubkey, requestId).state === 'in-flight') await deps.publish(work, handle);
  }), () => { void settleTarget().then(ack); }, (error) => {
    // Not published: the request keeps running and may still be cancelled.
    if (live) live.cancelling = false;
    fail(error);
  }, { admit: false });
}
