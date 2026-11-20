/**
 * policy-denials.ts — per-NAP wire projection of a runtime ACL or Firewall denial.
 *
 * NIP-5D defines no generic `<type>.error` reply, and most NAPs carry failures in
 * the request's own `.result` envelope. Each row below is an exact
 * napplet-to-shell request type whose owning NAP states that shape. A type with
 * no row keeps the runtime's older generic projection; those are listed as spec
 * gaps in docs/policies/NIP-5D-CONFORMANCE.md rather than guessed here.
 *
 * Refs checked (napplet/naps):
 * - NAP-CVM    #31 @ 28cf1bdb — "There are no `cvm.*.error` messages; ACL denial
 *   returns the matching `.result` with `error: "policy denied"`. On a shell
 *   error, success payload fields MUST be omitted."
 * - NAP-RELAY  #2 @ 9f30b350 — "`relay.publish.result` includes `ok: false` and an
 *   `error` string on failure. `relay.closed` indicates the shell terminated a
 *   subscription, with an optional `reason`. `relay.query.result` MAY include an
 *   `error` field instead of `events` if the query fails."
 * - NAP-OUTBOX #32 @ 8865f73d — result rows carry `error?` ("Result messages MAY
 *   include `error`"); `outbox.closed` carries `subId`, `reason?`;
 *   `outbox.query.result` keeps its required `events` (empty on denial).
 * - NAP-UPLOAD #33 @ f5cc981e — "The shell SHOULD return a top-level `error` when
 *   no upload was created."
 *
 * Where the NAP lists only common error strings, the runtime's reason passes
 * through unchanged; a fixed code is used only where the NAP mandates one or
 * defines an enumerated code set.
 */

import type { NappletMessage } from '@napplet/core';

/** Build a denial from the request id, the runtime's reason, and the request. */
type DenialProjection = (id: string, reason: string, message: NappletMessage) => NappletMessage | null;

/** `<type>.result` carrying only `id` and the given (or passed-through) error. */
function resultError(type: string, error?: string, fields: Record<string, unknown> = {}): DenialProjection {
  return (id, reason) => ({ type: `${type}.result`, id, ...fields, error: error ?? reason } as NappletMessage);
}

/** Subscription denials close the napplet's subscription id. */
function closed(type: 'relay.closed' | 'outbox.closed'): DenialProjection {
  return (_id, reason, message) => {
    const subId = (message as NappletMessage & { subId?: unknown }).subId;
    return typeof subId === 'string' ? { type, subId, reason } as NappletMessage : null;
  };
}

/** The NAP defines no reply for this request, so a denial is silent. */
const silent: DenialProjection = () => null;

const CVM_REQUESTS = ['cvm.discover', 'cvm.request', 'cvm.close', 'cvm.registry.list',
  'cvm.registry.has', 'cvm.registry.describe', 'cvm.registry.call'] as const;
const POLICY_DENIALS: Readonly<Record<string, DenialProjection>> = Object.freeze({
  ...Object.fromEntries(CVM_REQUESTS.map((type) => [type, resultError(type, 'policy denied')])),
  'relay.subscribe': closed('relay.closed'),
  'relay.close': silent,
  'relay.publish': resultError('relay.publish', undefined, { ok: false }),
  'relay.publishEncrypted': resultError('relay.publishEncrypted', undefined, { ok: false }),
  'relay.query': resultError('relay.query'),
  'outbox.getEvent': resultError('outbox.getEvent'),
  'outbox.query': resultError('outbox.query', undefined, { events: [] }),
  'outbox.subscribe': closed('outbox.closed'),
  'outbox.close': silent,
  'outbox.publish': resultError('outbox.publish', undefined, { ok: false }),
  'upload.upload': resultError('upload.upload'),
});

/**
 * Project a denied napplet request onto its owning NAP's failure wire.
 *
 * @param message - The denied napplet-to-shell envelope.
 * @param reason - Runtime diagnostic, used only where the NAP has no fixed code.
 * @returns The denial envelope, `null` when the NAP defines no reply, or
 *   `undefined` when no NAP-specific row exists for this type.
 * @example
 * createPolicyDenialResult({ type: 'cvm.request', id: 'denied-1' } as NappletMessage, 'denied: cvm:call');
 * // => { type: 'cvm.request.result', id: 'denied-1', error: 'policy denied' }
 */
export function createPolicyDenialResult(message: NappletMessage, reason: string): NappletMessage | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(POLICY_DENIALS, message.type)) return undefined;
  const rawId = (message as NappletMessage & { id?: unknown }).id;
  return POLICY_DENIALS[message.type](typeof rawId === 'string' ? rawId : '', reason, message);
}

/** Domains whose unlisted request types get no generic `.error` reply. */
const NAP_DEFINED_DOMAINS = new Set(['cvm']);

/**
 * Whether an unlisted type in this domain must stay silent instead of
 * receiving the generic projection.
 *
 * NAP-CVM #31 @ 28cf1bdb: "Truly unknown message types retain the
 * silent-ignore behavior defined by NIP-5D."
 *
 * @param message - The denied envelope.
 * @returns `true` for unknown types in a domain whose NAP forbids invented replies.
 * @example
 * isSilentUnknownDenial({ type: 'cvm.bogus' } as NappletMessage); // => true
 */
export function isSilentUnknownDenial(message: NappletMessage): boolean {
  return NAP_DEFINED_DOMAINS.has(message.type.slice(0, message.type.indexOf('.')));
}
