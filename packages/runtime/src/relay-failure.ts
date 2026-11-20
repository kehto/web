/**
 * Relay failure reasons for the runtime relay handler.
 *
 * Relays fail from time to time; that is part of Nostr. A transport failure
 * keeps a transport reason and is never reported as an authorization refusal.
 * NAP-RELAY (napplet/naps#2 at `9f30b3505335a52c574ff570576687d6467021ff`)
 * leaves `relay.closed.reason` and result `error` free-form, so only that split
 * is fixed here.
 *
 * @module
 */

import type { ApprovalSignal } from './approval-coordinator.js';

/** Reason for a relay operation whose approval did not execute (or whose authorizer failed). */
const RELAY_AUTHORIZATION_REFUSED = 'relay authorization unavailable or denied';

/** A relay transport failure raised while an approved operation ran. */
class RelayTransportFailure {
  constructor(readonly cause: unknown) {}
}

/**
 * Wrap an approved relay callback so its failures are tagged as transport failures.
 *
 * The async body invokes `execute` synchronously, so no asynchronous boundary
 * is added between final approval and the side effect.
 *
 * @param execute - The approved relay operation.
 * @returns The same operation, rejecting with a transport-tagged failure.
 */
export function guardRelayTransport<T>(execute: (signal: ApprovalSignal) => T | Promise<T>): (signal: ApprovalSignal) => Promise<T> {
  return async (signal) => {
    try {
      return await execute(signal);
    } catch (error) {
      throw new RelayTransportFailure(error);
    }
  };
}

/**
 * Pick the wire reason for a rejected relay authorization.
 *
 * @param error - The rejection from authorizing or running the operation.
 * @param transportReason - Reason to use when a relay transport failed.
 * @returns The transport reason, `invalid relay destination`, or the authorization refusal.
 */
export function relayFailureReason(error: unknown, transportReason: string): string {
  if (error instanceof RelayTransportFailure) return transportReason;
  if (error instanceof Error && error.message === 'invalid relay destination') return error.message;
  return RELAY_AUTHORIZATION_REFUSED;
}
