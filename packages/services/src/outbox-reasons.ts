/**
 * NAP-OUTBOX failure reasons shared by the service and the relay-pool router.
 *
 * Authority: NAP-OUTBOX draft napplet/naps#32 at
 * `8865f73d52a4864afee145f28d26520476273927`, Error Handling: "Common errors
 * include `"not found"`, `"no authors"`, `"relay list unavailable"`,
 * `"relay timeout"`, `"policy denied"`, `"publish denied"`, and
 * `"invalid filter"`."
 *
 * Relays fail as a matter of course on Nostr, so relay discovery, connection,
 * and transport failures always map to the network reasons below. Only an
 * approval outcome that did not execute (or a shell relay-gate refusal) is a
 * `policy denied`.
 *
 * Spec gap: the draft has no separate code for "no relay could be reached" or
 * "every relay refused the publish". The closest defined codes are used:
 * no usable relay set → `relay list unavailable`; relays that never answered
 * or accepted → `relay timeout`.
 *
 * Spec gap: a publish whose required own/inbox relays span more origins than
 * one approval can name cannot be approved or trimmed (Shell Behavior: the
 * shell "MUST include every resolved, policy-allowed `toInboxes` relay ... or
 * report failure"). The list above starts "Common errors include", so it is
 * open; that failure gets its own non-denial reason, `too many relays`
 * (kehto/web#455). Reads never use it: they are trimmed and marked `incomplete`.
 *
 * @module
 */

import { APPROVAL_CAPACITY } from './approval-failure.js';

/** No usable relay set: discovery failed, or no planned relay could be attached. */
export const OUTBOX_RELAY_LIST_UNAVAILABLE = 'relay list unavailable';
/** Planned relays did not answer or accept within the request budget. */
export const OUTBOX_RELAY_TIMEOUT = 'relay timeout';
/** An approval outcome that was not executed, or a shell relay-gate refusal. */
export const OUTBOX_POLICY_DENIED = 'policy denied';
/** The shell (signer or user consent) refused to sign or publish. */
export const OUTBOX_PUBLISH_DENIED = 'publish denied';
/**
 * The Firewall grant table is full (`maxGrants`). Host capacity, not policy, so
 * not a denial (kehto/web#513, spec gap: the draft has no capacity code).
 */
export const OUTBOX_APPROVAL_CAPACITY = APPROVAL_CAPACITY;
/** A publish's required relays span more origins than one approval can name; not a denial. */
export const OUTBOX_TOO_MANY_RELAYS = 'too many relays';

/** Spec-defined reasons a planning or transport failure may carry through unchanged. */
const NETWORK_REASONS: ReadonlySet<string> = new Set([OUTBOX_RELAY_LIST_UNAVAILABLE, OUTBOX_RELAY_TIMEOUT]);

/**
 * Map a relay planning or transport failure to a NAP-OUTBOX network reason.
 *
 * A failure that already names `relay list unavailable` or `relay timeout`
 * keeps it. Anything else, including a router that throws `policy denied`
 * from discovery, becomes `fallback`: a relay failure is never a denial.
 *
 * @param error - The rejection or thrown value from planning or transport.
 * @param fallback - Reason used when `error` does not name a network reason.
 * @returns A spec-defined network reason.
 */
export function outboxNetworkReason(error: unknown, fallback: string = OUTBOX_RELAY_LIST_UNAVAILABLE): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return NETWORK_REASONS.has(message) ? message : fallback;
}

/**
 * Map a publish transport failure, keeping a signer or consent refusal as
 * `publish denied` and turning everything else into a network reason.
 *
 * @param error - The rejection or thrown value from signing or relay publish.
 * @returns `publish denied` for a refusal, otherwise a network reason.
 */
export function outboxPublishFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message === OUTBOX_PUBLISH_DENIED ? message : outboxNetworkReason(error, OUTBOX_RELAY_TIMEOUT);
}
