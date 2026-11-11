/**
 * NAP-INTENT value types, re-exported from `@napplet/core` (>= 0.41.0).
 *
 * Checked against napplet/naps PR #128 at 74f9bf85 and PR #106 at fc121fc2: a
 * delivery carries a runtime-attested string sender and no delivery ID. Core
 * 0.41.0 (napplet/web#329) matches that contract, so Kehto no longer keeps a
 * local copy (kehto/web#418).
 */
export type {
  IntentAvailability,
  IntentBehavior,
  IntentCandidate,
  IntentContract,
  IntentDelivery,
  IntentHandlerHint,
  IntentRequest,
  IntentResult,
} from '@napplet/core';
