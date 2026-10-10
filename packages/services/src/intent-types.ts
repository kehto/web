/** Canonical NAP-INTENT contracts pending upstream @napplet/nap publication. */

/** Lifecycle hints that remain subject to host workspace policy. */
export interface IntentBehavior {
  readonly focus?: boolean;
  readonly reuse?: boolean;
}

/** A verified named-manifest recommendation; relay URLs are discovery hints only. */
export interface IntentHandlerHint {
  readonly address: string;
  readonly relays?: readonly string[];
}

/** One advertised stable convention and its ordered, untyped parameter names. */
export interface IntentContract {
  readonly convention: string;
  readonly params: readonly string[];
}

/** Normalized runtime request. `action` and `convention` are always URI-derived. */
export interface IntentRequest {
  readonly archetype: string;
  readonly action: string;
  readonly convention: string;
  readonly payload?: unknown;
  readonly handler?: string;
  readonly handlerHint?: IntentHandlerHint;
  readonly behavior?: IntentBehavior;
}

/** Runtime-assigned catalog candidate; its ID is never a bare manifest d-tag. */
export interface IntentCandidate {
  readonly id: string;
  readonly title?: string;
  readonly actions: readonly string[];
  readonly conventions: readonly string[];
  readonly contracts: readonly IntentContract[];
  readonly isDefault?: boolean;
}

/** Candidate availability for one manifest-advertised role. */
export interface IntentAvailability {
  readonly archetype: string;
  readonly available: boolean;
  readonly candidates: readonly IntentCandidate[];
  readonly hasDefault: boolean;
}

/** Successful results mean retained delivery responsibility, never completion. */
export type IntentResult =
  | { readonly ok: true; readonly archetype: string; readonly action: string; readonly convention: string; readonly handler: string }
  | { readonly ok: false; readonly error: string };

/** Runtime-attested target delivery after it becomes ready. */
export interface IntentDelivery {
  readonly sender: string;
  readonly archetype: string;
  readonly action: string;
  readonly convention: string;
  readonly payload?: unknown;
}
