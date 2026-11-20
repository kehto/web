/**
 * Classify Paja message-log rows as a denial or a failure.
 *
 * Shell replies report failures in several shapes: a `*.error` envelope, a
 * `*.result` with `error` or `ok: false`, and a `*.closed` with a `reason`.
 * The log highlights all of them, and separates a real refusal (shell policy,
 * firewall, consent) from a relay or transport failure. Relays fail from time
 * to time on Nostr, and the user must not be told the firewall blocked
 * something it did not.
 *
 * Denial codes follow the NAP error tables, e.g. NAP-OUTBOX (napplet/naps#32
 * `8865f73d`) `policy denied` / `publish denied`, NAP-COUNT (#69 `9353a0c6`)
 * `policy-denied`, and Kehto's runtime ACL replies `denied: <capability>`.
 * Anything else that signals failure, such as `relay list unavailable`,
 * `relay timeout`, or `count-unavailable`, is a failure, not a denial.
 *
 * @module
 */

/** Outcome highlighted on a message-log row. */
export type PajaMessageOutcome = 'denied' | 'failed';

/**
 * Reasons that mean the shell, firewall, or user refused the request.
 * Matched case-insensitively against the start of the failure text.
 */
const DENIAL_PATTERN = /^(?:policy[ -]denied|publish[ -]denied|permission[ -]denied|user[ -]denied|blocked-by-policy|denied(?:$|[:\s])|relay authorization unavailable or denied)/iu;

function failureText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.length > 0 ? value : undefined;
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as { code?: unknown; message?: unknown };
  if (typeof record.code === 'string' && record.code.length > 0) return record.code;
  if (typeof record.message === 'string' && record.message.length > 0) return record.message;
  return undefined;
}

/** Return failure text for one payload level, or `''` when it failed without text. */
function payloadFailure(type: string, payload: Record<string, unknown>): string | undefined {
  const error = failureText(payload.error);
  if (error !== undefined) return error;
  if (type.endsWith('.closed')) {
    const reason = failureText(payload.reason);
    if (reason !== undefined) return reason;
  }
  return payload.ok === false ? failureText(payload.reason) ?? '' : undefined;
}

/**
 * Classify a logged message.
 *
 * `*.error` envelopes are classified in every direction. Payload fields are
 * read only for shell -> napplet rows, plus one nested `result` object
 * (e.g. `{ result: { ok: false, error } }`). A plain `*.closed` with no reason
 * is a normal close and is not highlighted.
 *
 * @param direction - The row's message direction.
 * @param raw - The logged message payload.
 * @returns `denied`, `failed`, or `undefined` when the row is not a failure.
 * @example
 * ```ts
 * classifyPajaMessageOutcome('shell->napplet', { type: 'outbox.closed', subId: 's', reason: 'relay timeout' }); // 'failed'
 * classifyPajaMessageOutcome('shell->napplet', { type: 'outbox.query.result', id: 'q', events: [], error: 'denied: outbox:read' }); // 'denied'
 * ```
 */
export function classifyPajaMessageOutcome(direction: string, raw: unknown): PajaMessageOutcome | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const payload = raw as Record<string, unknown>;
  const type = typeof payload.type === 'string' ? payload.type : '';
  let failure: string | undefined;
  if (direction === 'shell->napplet') {
    failure = payloadFailure(type, payload);
    const nested = payload.result;
    if (failure === undefined && typeof nested === 'object' && nested !== null && !Array.isArray(nested)) {
      failure = payloadFailure(type, nested as Record<string, unknown>);
    }
  }
  if (failure === undefined && type.endsWith('.error')) {
    failure = failureText(payload.error) ?? failureText(payload.reason) ?? failureText(payload.message) ?? '';
  }
  if (failure === undefined) return undefined;
  return DENIAL_PATTERN.test(failure.trim()) ? 'denied' : 'failed';
}
