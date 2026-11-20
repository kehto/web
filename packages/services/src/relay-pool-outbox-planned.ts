/**
 * Planned (approval-bound) execution for the relay-pool outbox router.
 *
 * These functions run a relay plan that was already resolved and approved.
 * They never rediscover or expand the plan. Relay failures are part of Nostr,
 * so a relay that cannot be attached, never sends EOSE, or refuses a publish
 * produces a NAP-OUTBOX network reason or `incomplete: true`, never a denial.
 *
 * Authority: NAP-OUTBOX draft napplet/naps#32 at
 * `8865f73d52a4864afee145f28d26520476273927`, Error Handling: "If the shell
 * returns partial results because some relay lists or relay connections
 * failed, it SHOULD set `incomplete: true` and still return events it found."
 *
 * @module
 */

import type { EventTemplate, NostrEvent, NostrFilter } from '@napplet/core';
import { createRelayEventResultWithHints, type ApprovalSignal } from '@kehto/runtime';
import { deriveAuthors, resolvePublishTargets } from './relay-pool-outbox-planning.js';
import {
  OUTBOX_POLICY_DENIED,
  OUTBOX_PUBLISH_DENIED,
  OUTBOX_RELAY_LIST_UNAVAILABLE,
  OUTBOX_RELAY_TIMEOUT,
  outboxPublishFailureReason,
} from './outbox-reasons.js';
import type {
  OutboxPublishOptions,
  OutboxPublishResult,
  OutboxQueryOptions,
  OutboxRelayPlan,
  OutboxResult,
  OutboxRouterSubscription,
  OutboxSubscriptionSink,
} from './outbox-service.js';
import type { OutboxRelayOrigin, RouterCtx } from './relay-pool-outbox-types.js';

// Timer globals available in all JS runtimes.
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;

function planOrigin(plan: OutboxRelayPlan): OutboxRelayOrigin {
  return plan.source === 'nip65' ? 'nip65' : plan.source === 'fallback' ? 'fallback' : 'hint';
}

/** Mutable bookkeeping for one planned bounded read. */
interface PlannedRead {
  readonly seen: Map<string, NostrEvent>;
  readonly admitted: Set<string>;
  readonly active: Set<string>;
  readonly eosed: Set<string>;
  readonly handles: { unsubscribe(): void }[];
  pending: number;
  incomplete: boolean;
}

/** Aggregate a planned read; a deadline before every relay's EOSE is partial. */
function plannedReadResult(read: PlannedRead, plan: OutboxRelayPlan, timedOut: boolean): OutboxResult {
  const events = [...read.seen.values()].map((event) => createRelayEventResultWithHints(event, plan.relays));
  const result: OutboxResult = { events };
  if (timedOut && read.eosed.size < read.active.size) read.incomplete = true;
  if (read.incomplete) result.incomplete = true;
  if (timedOut && read.eosed.size === 0 && events.length === 0) result.error = OUTBOX_RELAY_TIMEOUT;
  return result;
}

/**
 * Execute an approved read plan as a bounded query.
 *
 * The read settles when every attached relay sent EOSE (and pending signature
 * checks finished) or at the deadline. A relay whose subscribe throws is
 * skipped and the result is marked `incomplete`; when no relay attaches the
 * result is `relay list unavailable`. Abort means the approval was withdrawn
 * and stays `policy denied`.
 *
 * @param ctx - Router dependencies.
 * @param filters - NIP-01 filters for every relay in the plan.
 * @param options - Query options; only `timeoutMs` and `authors` are read.
 * @param plan - The approved, frozen relay plan.
 * @param signal - Approval cancellation signal.
 * @returns The collected, verified results.
 */
export function queryPlanImpl(
  ctx: RouterCtx,
  filters: NostrFilter[],
  options: OutboxQueryOptions | undefined,
  plan: OutboxRelayPlan,
  signal?: ApprovalSignal,
): Promise<OutboxResult> {
  if (signal?.aborted) return Promise.resolve({ events: [], error: OUTBOX_POLICY_DENIED });
  if (!ctx.relayPool.isAvailable() || plan.relays.length === 0) {
    return Promise.resolve({ events: [], incomplete: true, error: OUTBOX_RELAY_LIST_UNAVAILABLE });
  }
  const origin = planOrigin(plan);
  // A frozen plan keeps no per-relay owners, so it reports the requested routing authors.
  const routingAuthors = deriveAuthors(filters, options?.authors);
  const read: PlannedRead = {
    seen: new Map(), admitted: new Set(), active: new Set(), eosed: new Set(), handles: [],
    pending: 0, incomplete: (plan.missingAuthors?.length ?? 0) > 0,
  };
  return new Promise((resolve) => {
    let settled = false;
    let attaching = true;
    const finish = (result: OutboxResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      for (const handle of read.handles) {
        try { handle.unsubscribe(); } catch { /* release the remaining subscriptions */ }
      }
      resolve(result);
    };
    const maybeFinish = (): void => {
      if (attaching || settled || read.pending > 0 || read.eosed.size < read.active.size) return;
      finish(plannedReadResult(read, plan, false));
    };
    const abort = (): void => finish({ events: [], error: OUTBOX_POLICY_DENIED });
    const timer = setTimeout(() => finish(plannedReadResult(read, plan, true)), options?.timeoutMs ?? ctx.defaultTimeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    for (const relayUrl of plan.relays) {
      if (settled) break;
      read.active.add(relayUrl);
      try {
        const handle = ctx.relayPool.subscribe(filters, [relayUrl], (item) => {
          if (settled) return;
          if (item === 'EOSE') { read.eosed.add(relayUrl); maybeFinish(); return; }
          if (read.admitted.has(item.id)) return;
          read.admitted.add(item.id);
          read.pending += 1;
          void ctx.verify(item).then((ok) => { if (ok && !settled) read.seen.set(item.id, item); })
            .finally(() => { read.pending -= 1; maybeFinish(); });
        }, origin, routingAuthors);
        if (settled) handle.unsubscribe(); else read.handles.push(handle);
      } catch {
        // One unreachable relay makes the read partial, not failed.
        read.active.delete(relayUrl);
        read.eosed.delete(relayUrl);
        read.incomplete = true;
      }
    }
    attaching = false;
    if (read.active.size === 0) finish({ events: [], incomplete: true, error: OUTBOX_RELAY_LIST_UNAVAILABLE });
    else maybeFinish();
  });
}

/**
 * Open a live subscription over an approved plan.
 *
 * A relay whose subscribe throws is skipped; the stream continues on the rest.
 * When no relay attaches, the stream closes with `relay list unavailable`,
 * matching the unplanned router path.
 *
 * @param ctx - Router dependencies.
 * @param filters - NIP-01 filters for every relay in the plan.
 * @param plan - The approved, frozen relay plan.
 * @param sink - Lifecycle sink for events and upstream close.
 * @returns A handle that releases every attached relay.
 */
export function subscribePlanImpl(
  ctx: RouterCtx,
  filters: NostrFilter[],
  plan: OutboxRelayPlan,
  sink: OutboxSubscriptionSink,
): OutboxRouterSubscription {
  let closed = false;
  const handles: { unsubscribe(): void }[] = [];
  const origin = planOrigin(plan);
  const authors = deriveAuthors(filters);
  if (ctx.relayPool.isAvailable()) {
    for (const relayUrl of plan.relays) {
      try {
        handles.push(ctx.relayPool.subscribe(filters, [relayUrl], (item) => {
          if (closed || item === 'EOSE') return;
          void ctx.verify(item).then((ok) => { if (ok && !closed) sink.event(createRelayEventResultWithHints(item, [relayUrl])); });
        }, origin, authors));
      } catch {
        // Keep the stream alive on the relays that did attach.
      }
    }
  }
  if (handles.length === 0) {
    closed = true;
    sink.closed(OUTBOX_RELAY_LIST_UNAVAILABLE);
  }
  return {
    close(): void {
      if (closed) return;
      closed = true;
      for (const handle of handles) {
        try { handle.unsubscribe(); } catch { /* release the remaining subscriptions */ }
      }
    },
  };
}

/**
 * Resolve the publish plan from the signer identity before any signature.
 *
 * The plan names every destination up front: own outbox (host fallback when
 * the signer has no NIP-65 list), every `toInboxes` recipient's inbox, and
 * caller hints. Own and inbox relays are carried as host-only
 * `requiredRelays`. A relay-gate refusal of a required author rejects with
 * `policy denied`; a recipient without a relay list rejects with
 * `relay list unavailable`.
 *
 * @param ctx - Router dependencies.
 * @param publishOptions - Publish fanout options.
 * @returns The relay plan, carrying the captured signing identity.
 */
export async function planPublishImpl(ctx: RouterCtx, publishOptions?: OutboxPublishOptions): Promise<OutboxRelayPlan> {
  if (!ctx.getSignerPubkey) return { relays: [], source: 'policy' };
  const pubkey = await ctx.getSignerPubkey();
  const targets = await resolvePublishTargets(ctx, { pubkey }, publishOptions, true);
  if (targets.error) throw new Error(targets.error);
  return { relays: targets.relayUrls, requiredRelays: targets.requiredRelayUrls, source: 'policy', author: pubkey };
}

/** Normalize a pool publish return into a per-relay success map. */
export function normalizePublishResult(
  res: Record<string, boolean> | void,
  relayUrls: string[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (res && typeof res === 'object') {
    for (const url of relayUrls) out[url] = res[url] ?? false;
  } else {
    // void return → optimistic success on every targeted relay.
    for (const url of relayUrls) out[url] = true;
  }
  return out;
}

/**
 * Sign once and publish to an approved plan.
 *
 * Approval cancellation is checked before signing and again after the
 * asynchronous signer returns; either is `policy denied`. An empty plan is a
 * discovery outcome (`relay list unavailable`). A signer failure or a pool
 * error naming `publish denied` (consent refused) is `publish denied`. With
 * `requiredRelays`, every required relay must accept, so successful hint
 * fanout cannot hide a failed inbox; a required relay that did not accept is
 * a relay failure, `relay timeout`, never a denial (NAP-OUTBOX draft
 * napplet/naps#32 at `8865f73d`, Error Handling; see `outbox-reasons.ts`).
 *
 * @param ctx - Router dependencies.
 * @param template - Event template to sign.
 * @param plan - The approved, frozen relay plan.
 * @param signal - Approval cancellation signal.
 * @returns The publish result.
 */
export async function publishWithPlanImpl(
  ctx: RouterCtx,
  template: EventTemplate,
  plan: OutboxRelayPlan,
  signal?: ApprovalSignal,
): Promise<OutboxPublishResult> {
  if (signal?.aborted) return { ok: false, error: OUTBOX_POLICY_DENIED };
  if (!ctx.signEvent) return { ok: false, error: OUTBOX_PUBLISH_DENIED };
  if (plan.relays.length === 0) return { ok: false, error: OUTBOX_RELAY_LIST_UNAVAILABLE };
  let event: NostrEvent;
  try {
    event = await ctx.signEvent(template);
  } catch {
    // The signer or the user declined: a shell refusal, not a relay failure.
    return { ok: false, error: OUTBOX_PUBLISH_DENIED };
  }
  if (signal?.aborted) return { ok: false, error: OUTBOX_POLICY_DENIED };
  if (plan.author && event.pubkey !== plan.author) return { ok: false, event, eventId: event.id, error: 'signing identity changed' };
  let relays: Record<string, boolean>;
  try {
    relays = normalizePublishResult(await ctx.relayPool.publish(event, [...plan.relays]), [...plan.relays]);
  } catch (error) {
    return { ok: false, event, eventId: event.id, error: outboxPublishFailureReason(error) };
  }
  const ok = plan.requiredRelays?.length
    ? plan.requiredRelays.every((url) => relays[url] === true)
    : Object.values(relays).some(Boolean);
  return ok ? { ok, event, eventId: event.id, relays } : { ok, event, eventId: event.id, relays, error: OUTBOX_RELAY_TIMEOUT };
}
