import type { PajaRelayConnectionSummary } from './runtime-resolver.js';
import { getPajaSetting } from './settings.js';

/** Close reason nostr-tools reports for a relay that answered with `EOSE`. */
export const PAJA_RELAY_EOSE_REASON = 'closed automatically on eose';

/**
 * How the queried relays settled when a pointer query ended without a match.
 *
 * @example
 * ```ts
 * const tally: PajaPointerRelayTally = {
 *   answered: 4,
 *   failed: [{ url: 'wss://down.example', reason: 'connection failed' }],
 * };
 * ```
 */
export interface PajaPointerRelayTally {
  /** Relays that sent `EOSE` without a matching event. */
  readonly answered: number;
  /** Relays that could not be asked, with the transport or `CLOSED` reason. */
  readonly failed: readonly { readonly url?: string; readonly reason: string }[];
}

/**
 * Thrown when every relay that could be asked answered `EOSE` without the
 * pointer's manifest event. Relays that were down are counted, not reported as
 * the cause: one unreachable relay does not turn a clean miss into a failure.
 *
 * @example
 * ```ts
 * try {
 *   await resolvePajaPointer(pointer);
 * } catch (error) {
 *   if (error instanceof PajaPointerNotFoundError) console.log(error.answered, error.failed.length);
 * }
 * ```
 */
export class PajaPointerNotFoundError extends Error {
  /** Stable discriminator for hosts that cannot rely on `instanceof` across bundles. */
  readonly code = 'pointer-not-found' as const;
  /** Relays that sent `EOSE` without the event. */
  readonly answered: number;
  /** Relays that could not be asked, with their reasons. */
  readonly failed: PajaPointerRelayTally['failed'];

  constructor(
    /** Pointer type that was looked up. */
    readonly pointerType: 'naddr' | 'nevent',
    tally: PajaPointerRelayTally,
    /** Relay URLs the lookup queried, in query order. */
    readonly relays: readonly string[],
  ) {
    super(describePointerNotFound(pointerType, tally));
    this.name = 'PajaPointerNotFoundError';
    this.answered = tally.answered;
    this.failed = tally.failed;
  }
}

/** Inputs the classifier needs from one settled pointer relay query. */
export interface PajaPointerMissInput {
  /** Relay URLs queried, in the order handed to the pool. */
  readonly relays: readonly string[];
  /** Per-relay close reasons; empty when the pool cannot report them. */
  readonly reasons: readonly string[];
  /** Whether Paja's shared deadline expired before every relay settled. */
  readonly timedOut: boolean;
  /** Error thrown by the pool itself, if any. */
  readonly error?: unknown;
  /** Connection outcomes, when the pool exposes `ensureRelay`. */
  readonly connections?: PajaRelayConnectionSummary;
}

/** Classified reason a pointer query produced no matching event. */
export type PajaPointerMissOutcome =
  | { readonly kind: 'unreachable'; readonly connections: PajaRelayConnectionSummary }
  | { readonly kind: 'timed-out' }
  | { readonly kind: 'query-failed'; readonly detail: string }
  | { readonly kind: 'not-found'; readonly tally: PajaPointerRelayTally };

/**
 * Classify a pointer query that ended without a matching event.
 *
 * Order matters: zero opened sockets is reported first so a deadline expiry
 * cannot disguise it; any relay that answered `EOSE` makes the result a "not
 * found" even when other relays failed; only when no relay answered do relay
 * failures become the reported cause.
 *
 * @param input - Settled query state.
 * @returns The outcome the resolver reports.
 * @example
 * ```ts
 * classifyPointerMiss({
 *   relays: ['wss://a.example', 'wss://b.example'],
 *   reasons: [PAJA_RELAY_EOSE_REASON, 'connection failed'],
 *   timedOut: false,
 * }); // { kind: 'not-found', tally: { answered: 1, failed: [...] } }
 * ```
 */
export function classifyPointerMiss(input: PajaPointerMissInput): PajaPointerMissOutcome {
  const { connections } = input;
  if (connections && connections.total > 0 && connections.connected.length === 0) {
    return { kind: 'unreachable', connections };
  }
  if (input.timedOut) return { kind: 'timed-out' };
  if (input.error !== undefined) {
    return { kind: 'query-failed', detail: input.error instanceof Error ? input.error.message : String(input.error) };
  }
  // Pools without per-relay reasons (querySync) only resolve once every relay
  // settled, so the legacy reading of an empty result is "all reached EOSE".
  if (input.reasons.length === 0) {
    return { kind: 'not-found', tally: { answered: input.relays.length, failed: [] } };
  }
  const tally = tallyPointerRelayReasons(input.relays, input.reasons);
  if (tally.answered > 0) return { kind: 'not-found', tally };
  return { kind: 'query-failed', detail: distinctReasons(tally.failed.map((entry) => entry.reason)).join('; ') };
}

/**
 * Split per-relay close reasons into answered and failed relays. Reasons are
 * paired with URLs only when the pool reported exactly one reason per relay.
 *
 * @param relays - Relay URLs in query order.
 * @param reasons - Per-relay close reasons from the pool.
 * @returns Answered count and failed relays.
 * @example
 * ```ts
 * tallyPointerRelayReasons(['wss://a.example'], ['connection failed']);
 * // { answered: 0, failed: [{ url: 'wss://a.example', reason: 'connection failed' }] }
 * ```
 */
export function tallyPointerRelayReasons(
  relays: readonly string[],
  reasons: readonly string[],
): PajaPointerRelayTally {
  const paired = relays.length === reasons.length;
  let answered = 0;
  const failed: { url?: string; reason: string }[] = [];
  reasons.forEach((raw, index) => {
    const reason = raw.trim();
    if (reason === PAJA_RELAY_EOSE_REASON) {
      answered += 1;
      return;
    }
    const text = (reason || 'connection failed').slice(0, getPajaSetting('target.failureReasonChars'));
    failed.push(paired ? { url: relays[index], reason: text } : { reason: text });
  });
  return { answered, failed };
}

/**
 * Human-readable "not found" message with relay counts.
 *
 * @param pointerType - Pointer type that was looked up.
 * @param tally - Answered and failed relays.
 * @returns Status text for the Paja pointer panel.
 * @example
 * ```ts
 * describePointerNotFound('nevent', { answered: 4, failed: [{ reason: 'connection failed' }] });
 * ```
 */
export function describePointerNotFound(pointerType: string, tally: PajaPointerRelayTally): string {
  const head = `Napplet manifest not found (${tally.answered} answered, ${tally.failed.length} failed):`
    + ` ${tally.answered} ${tally.answered === 1 ? 'relay' : 'relays'} reached EOSE without a matching ${pointerType} napplet manifest event.`;
  if (tally.failed.length === 0) return head;
  const shown = getPajaSetting('target.failureReasonCount');
  const details = tally.failed.slice(0, shown).map((entry) => entry.url ? `${entry.url}: ${entry.reason}` : entry.reason);
  const more = tally.failed.length > shown ? `; +${tally.failed.length - shown} more` : '';
  return `${head} ${tally.failed.length === 1 ? 'One relay' : `${tally.failed.length} relays`} could not be asked (${details.join('; ')}${more}).`;
}

function distinctReasons(reasons: readonly string[]): string[] {
  return [...new Set(reasons)].slice(0, getPajaSetting('target.failureReasonCount'));
}
