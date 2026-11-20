/**
 * Approval-bound execution for the NAP-OUTBOX service.
 *
 * Each operation runs in three stages that fail differently:
 *
 * 1. Planning (relay-list lookup, discovery, an unusable plan) fails with
 *    `relay list unavailable`, or the network reason the router named.
 * 2. Approval that does not execute is `policy denied`.
 * 3. A transport failure inside the approved callback is a network reason.
 *
 * Relays fail from time to time; that is part of Nostr and never reported as a
 * denial. Authority: NAP-OUTBOX draft napplet/naps#32 at
 * `8865f73d52a4864afee145f28d26520476273927`, Error Handling (codes and
 * `incomplete` semantics); see `outbox-reasons.ts` for the spec-gap mapping.
 *
 * @module
 */

import type { EventTemplate, NappletMessage, NostrFilter } from '@napplet/core';
import type { ApprovalOutcome, PermissionRequirement, ServiceRuntimeContext } from '@kehto/runtime';
import {
  OUTBOX_POLICY_DENIED,
  OUTBOX_RELAY_LIST_UNAVAILABLE,
  outboxNetworkReason,
  outboxPublishFailureReason,
} from './outbox-reasons.js';
import type {
  OutboxPublishOptions,
  OutboxPublishResult,
  OutboxQueryOptions,
  OutboxRelayPlan,
  OutboxResult,
  OutboxRouter,
  OutboxRouterSubscription,
  OutboxSubscribeOptions,
  OutboxSubscriptionSink,
  StreamingOutboxRouter,
} from './outbox-service.js';

/**
 * Freeze a router plan so the approved destinations cannot change before execution.
 *
 * @param plan - The router's relay plan.
 * @returns A frozen copy with a frozen relay list.
 */
export function capturePlan(plan: OutboxRelayPlan): OutboxRelayPlan {
  const captured = { ...plan, relays: [...plan.relays] };
  Object.freeze(captured.relays);
  return Object.freeze(captured);
}

/** Interface plus per-relay network requirements for one approved OUTBOX operation. */
function outboxRequirements(operation: string, plan: OutboxRelayPlan): PermissionRequirement[] {
  return [
    { category: 'interface', domain: 'outbox', operation: 'access', scope: { kind: 'exact', value: 'outbox' } },
    ...plan.relays.map((url) => ({ category: 'network' as const, domain: 'outbox', operation, scope: { kind: 'origin' as const, value: new URL(url).origin } })),
  ];
}

/** A relay failure raised inside an approved callback, kept apart from approval outcomes. */
class OutboxTransportFailure {
  constructor(readonly reason: string) {}
}

/**
 * Shell policy, not a relay failure: with approvals configured, the shell
 * refuses to run an operation it cannot plan and approve up front
 * (FW-OUTBOX-LEGACY-001). The draft has no "unsupported" code, so this is the
 * shell's fail-closed `policy denied`.
 */
export const UNPLANNABLE_ROUTER_REASON = OUTBOX_POLICY_DENIED;

/**
 * Plan, approve, and execute one bounded OUTBOX read.
 *
 * @param router - The read router selected for the source.
 * @param runtime - Runtime context carrying `authorizeOperation`.
 * @param windowId - The authenticated source window.
 * @param operation - Approval operation name, e.g. `outbox.query`.
 * @param filters - NIP-01 filters.
 * @param options - Sanitized query options.
 * @returns The query result; failures carry a NAP-OUTBOX reason.
 */
export async function queryApproved(
  router: OutboxRouter,
  runtime: ServiceRuntimeContext,
  windowId: string,
  operation: string,
  filters: NostrFilter[],
  options: OutboxQueryOptions | undefined,
): Promise<OutboxResult> {
  const planned = router as StreamingOutboxRouter;
  if (!planned.planRead || !planned.queryWithPlan) return { events: [], error: UNPLANNABLE_ROUTER_REASON };
  let plan: OutboxRelayPlan;
  let requirements: PermissionRequirement[];
  try {
    plan = capturePlan(await planned.planRead(filters, options));
    requirements = outboxRequirements(operation, plan);
  } catch (error) {
    return { events: [], incomplete: true, error: outboxNetworkReason(error) };
  }
  const outcome = await runtime.authorizeOperation!(windowId, operation, requirements, async (signal) => {
    if (signal.aborted) return { events: [], error: OUTBOX_POLICY_DENIED };
    let result: OutboxResult;
    try {
      result = await planned.queryWithPlan!(filters, options, plan, signal);
    } catch (error) {
      return { events: [], incomplete: true, error: outboxNetworkReason(error) };
    }
    return signal.aborted ? { events: [], error: OUTBOX_POLICY_DENIED } : result;
  });
  return outcome.status === 'executed' && outcome.value ? outcome.value : { events: [], error: OUTBOX_POLICY_DENIED };
}

/** One live subscription request handed to {@link subscribeApproved}. */
export interface ApprovedSubscribe {
  readonly windowId: string;
  readonly subId: string;
  readonly subKey: string;
  readonly filters: NostrFilter[];
  readonly options: OutboxSubscribeOptions | undefined;
  readonly sink: OutboxSubscriptionSink;
  readonly send: (msg: NappletMessage) => void;
}

/**
 * Plan, approve, and open one live OUTBOX subscription.
 *
 * Planning and transport failures close the stream with a network reason;
 * only a non-executed approval outcome closes it with `policy denied`. A
 * subscription opened before a late cancellation is released, and a router
 * that closes the stream synchronously is never re-registered.
 *
 * @param subscriptions - The service's live subscriptions by `windowId:subId`.
 * @param planned - The read router, which must implement `planRead` and `subscribeWithPlan`.
 * @param runtime - Runtime context carrying `authorizeOperation`.
 * @param request - The validated subscribe request.
 */
export function subscribeApproved(
  subscriptions: Map<string, OutboxRouterSubscription>,
  planned: StreamingOutboxRouter,
  runtime: ServiceRuntimeContext,
  request: ApprovedSubscribe,
): void {
  const { windowId, subId, subKey, filters, sink, send } = request;
  let ended = false;
  let opened: OutboxRouterSubscription | undefined;
  const trackedSink: OutboxSubscriptionSink = {
    event: (result) => { if (!ended) sink.event(result); },
    closed: (reason) => { if (ended) return; ended = true; sink.closed(reason); },
  };
  const end = (reason: string): void => {
    const announced = ended;
    ended = true;
    if (opened && subscriptions.get(subKey) === opened) subscriptions.delete(subKey);
    try { opened?.close(); } catch { /* already released */ }
    if (!announced) send({ type: 'outbox.closed', subId, reason } as NappletMessage);
  };
  void (async () => {
    let plan: OutboxRelayPlan;
    let requirements: PermissionRequirement[];
    try {
      plan = capturePlan(await planned.planRead!(filters, request.options));
      requirements = outboxRequirements('outbox.subscribe', plan);
    } catch (error) {
      end(outboxNetworkReason(error));
      return;
    }
    let outcome: ApprovalOutcome<void>;
    try {
      outcome = await runtime.authorizeOperation!(windowId, 'outbox.subscribe', requirements, (signal) => {
        if (signal.aborted) return;
        try {
          opened = planned.subscribeWithPlan!(filters, plan, trackedSink);
        } catch (error) {
          throw new OutboxTransportFailure(outboxNetworkReason(error));
        }
        if (signal.aborted) { try { opened.close(); } catch { /* released by end() */ } } else if (!ended) subscriptions.set(subKey, opened);
      });
    } catch (error) {
      // A throw from the authorizer itself, not the transport, stays fail-closed.
      end(error instanceof OutboxTransportFailure ? error.reason : OUTBOX_POLICY_DENIED);
      return;
    }
    if (outcome.status !== 'executed') end(OUTBOX_POLICY_DENIED);
  })();
}

/**
 * Plan, approve, and execute one OUTBOX publish.
 *
 * A signer failure while planning rejects with its own message (it is not a
 * relay failure); relay discovery cannot reject here because the router
 * degrades it to fallback. A transport failure inside the approved callback is
 * a network reason, and only a non-executed approval outcome is `policy denied`.
 *
 * @param planned - Router implementing `planPublish` and `publishWithPlan`.
 * @param runtime - Runtime context carrying `authorizeOperation`.
 * @param windowId - The authenticated source window.
 * @param template - The event template to sign.
 * @param options - Sanitized publish options.
 * @returns The publish result; failures carry a NAP-OUTBOX reason.
 */
export async function publishApproved(
  planned: StreamingOutboxRouter,
  runtime: ServiceRuntimeContext,
  windowId: string,
  template: EventTemplate,
  options: OutboxPublishOptions | undefined,
): Promise<OutboxPublishResult> {
  const plan = capturePlan(await planned.planPublish!(options));
  let requirements: PermissionRequirement[];
  try {
    requirements = outboxRequirements('outbox.publish', plan);
  } catch {
    return { ok: false, error: OUTBOX_RELAY_LIST_UNAVAILABLE };
  }
  const outcome = await runtime.authorizeOperation!(windowId, 'outbox.publish', requirements, async (signal) => {
    if (signal.aborted) return { ok: false, error: OUTBOX_POLICY_DENIED };
    try {
      return await planned.publishWithPlan!(template, plan);
    } catch (error) {
      return { ok: false, error: outboxPublishFailureReason(error) };
    }
  });
  return outcome.status === 'executed' && outcome.value ? outcome.value : { ok: false, error: OUTBOX_POLICY_DENIED };
}
