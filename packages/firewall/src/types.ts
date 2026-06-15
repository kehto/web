/**
 * @kehto/firewall — Pure, side-effect-free type surface.
 *
 * All types are immutable (readonly members, Readonly<Record<>> for maps).
 * No runtime logic lives here — defaults and constants with values live in defaults.ts.
 * This module has zero imports: it is the leaf dependency of the package.
 */

/**
 * Normalized observation — the sole input surface of the pure firewall engine.
 *
 * The pure core NEVER parses protocol envelopes. Phase 81 is responsible for
 * extracting these fields from raw message envelopes before calling evaluate().
 *
 * @param napplet - dTag — version-agnostic identity key ("any version").
 *                  Keyed by dTag only (not dTag:hash) so rate limits are
 *                  shared across all versions of the same napplet.
 * @param opClass - Operation class string, e.g. 'relay:write', 'outbox:publish',
 *                  'intent:invoke'. Treated as an opaque key by the engine.
 * @param kind    - Nostr event kind (5 = delete). Present for publish-style ops.
 * @param size    - Payload byte size. Present when known (e.g. relay:write).
 * @param initElapsedMs - Milliseconds since this napplet window initialized.
 *                        Used by the init-burst guard (BURST-01).
 * @param focused - Whether this napplet is the currently focused window.
 *                  Shell-owned and forge-proof; never self-reported.
 * @param msSinceFocusGain - Milliseconds since this napplet last gained focus.
 *                           Used by content matchers (CONTENT-02).
 * @param now     - Injected timestamp (Unix ms). evaluate() MUST never read a
 *                  wall clock — this field makes the function pure and deterministic.
 */
export interface Observation {
  readonly napplet: string;
  readonly opClass: string;
  readonly kind?: number;
  readonly size?: number;
  readonly initElapsedMs?: number;
  readonly focused: boolean;
  readonly msSinceFocusGain?: number;
  readonly now: number;
}

/**
 * Action taken when a firewall rule is exceeded.
 *
 * - `'flag'`   — pass the operation but emit an audit event (default for rate limits).
 * - `'block'`  — reject the operation (default for burst guard).
 * - `'ignore'` — pass silently without any audit event.
 */
export type Action = 'flag' | 'block' | 'ignore';

/**
 * Decision returned by evaluate() for the caller to act on.
 *
 * - `'pass'`   — caller dispatches the operation (action may be `'flag'`).
 * - `'reject'` — caller drops the operation and returns an error.
 * - `'prompt'` — caller rejects current message and fires an async consent prompt.
 */
export type Decision = 'pass' | 'reject' | 'prompt';

/**
 * Per-napplet policy posture — hard override for a specific dTag.
 *
 * - `'allow'` — always pass, bypassing rate/burst/content checks.
 * - `'deny'`  — always reject, regardless of budgets.
 * - `'ask'`   — always prompt for user consent.
 */
export type NappletPolicy = 'allow' | 'deny' | 'ask';

/**
 * Token-bucket rate limit for a single (napplet, opClass) pair.
 *
 * The engine computes `refillRatePerMs = capacity / windowMs` lazily on
 * each evaluate() call — it is never stored in state.
 *
 * @param capacity  - Maximum tokens (operations) allowed per window.
 * @param windowMs  - Window duration in milliseconds.
 * @param action    - Exceed-action: what to do when the bucket is empty.
 */
export interface RateLimit {
  readonly capacity: number;
  readonly windowMs: number;
  readonly action: Action;
}

/**
 * Init-burst guard — caps the number of operations fired within the
 * initialization window (initElapsedMs below windowMs).
 *
 * Modeled as a first-class field on NappletRules / FirewallConfig, NOT as
 * a ContentMatcher (research Open Question 2 — resolved in favor of first-class).
 *
 * @param windowMs - The initialization window in milliseconds.
 * @param maxOps   - Maximum operations allowed inside the init window.
 * @param action   - Exceed-action; default is `'block'` (BURST-02).
 */
export interface BurstGuard {
  readonly windowMs: number;
  readonly maxOps: number;
  readonly action: Action;
}

/**
 * Declarative content matcher — matched against an Observation before rate checks.
 *
 * All fields except `id` and `action` are optional predicates; a matcher fires
 * when ALL present predicates are satisfied (AND semantics).
 *
 * @param id                  - Stable unique identifier for this matcher rule.
 * @param opClass             - Restrict match to a specific operation class.
 * @param kinds               - Match if observation.kind is in this set (e.g. [5] for delete-spam).
 * @param minSize             - Match if observation.size >= minSize.
 * @param focused             - Match if observation.focused equals this value.
 * @param maxMsSinceFocusGain - Match if observation.msSinceFocusGain <= maxMsSinceFocusGain.
 * @param action              - Action to apply when this matcher fires.
 */
export interface ContentMatcher {
  readonly id: string;
  readonly opClass?: string;
  readonly kinds?: readonly number[];
  readonly minSize?: number;
  readonly focused?: boolean;
  readonly maxMsSinceFocusGain?: number;
  readonly action: Action;
}

/**
 * Per-napplet firewall rules — keyed by dTag in FirewallConfig.napplets.
 *
 * @param policy     - Optional hard policy override for this dTag.
 * @param rateLimits - Map from opClass string to a per-op token-bucket limit.
 * @param globalRate - Optional fallback rate limit applied to all op-classes
 *                     that lack a specific entry in rateLimits (RATE-03).
 */
export interface NappletRules {
  readonly policy?: NappletPolicy;
  readonly rateLimits: Readonly<Record<string, RateLimit>>;
  readonly globalRate?: RateLimit;
}

/**
 * Complete firewall configuration — immutable container.
 *
 * All mutations (setPolicy, setRateLimit, addMatcher) return a new FirewallConfig;
 * the original is never modified. Mirrors AclState's immutable-container shape.
 *
 * @param napplets            - Per-napplet rule map keyed by dTag.
 * @param matchers            - Ordered list of content matchers (first-match wins).
 * @param burstGuard          - Global init-burst guard applied to all napplets.
 * @param defaultRate         - Global default token-bucket rate applied when no
 *                              napplet-specific rule matches.
 * @param unfocusedMultiplier - Fractional multiplier (e.g. 0.25) that tightens
 *                              rate budgets for unfocused napplets (FOCUS-02).
 *                              Focus alone NEVER hard-blocks; it only scales tokens.
 */
export interface FirewallConfig {
  readonly napplets: Readonly<Record<string, NappletRules>>;
  readonly matchers: readonly ContentMatcher[];
  readonly burstGuard: BurstGuard;
  readonly defaultRate: RateLimit;
  readonly unfocusedMultiplier: number;
}

/**
 * Token-bucket counter for a single (napplet, opClass) pair.
 *
 * The bucket is stored in FirewallState.buckets keyed as `napplet:opClass`.
 * The refill math is lazy: tokens are only recomputed when evaluate() is called.
 *
 * @param tokens     - Current available token count (may be fractional).
 * @param lastRefill - Timestamp (Unix ms) of the last token-refill computation.
 */
export interface Bucket {
  readonly tokens: number;
  readonly lastRefill: number;
}

/**
 * Init-burst operation counter for a single napplet.
 *
 * Stored in FirewallState.bursts keyed by napplet dTag.
 *
 * @param count       - Number of operations observed within the current burst window.
 * @param windowStart - Timestamp (Unix ms) when the current burst window began.
 */
export interface BurstCounter {
  readonly count: number;
  readonly windowStart: number;
}

/**
 * Ephemeral firewall counter state — immutable snapshot.
 *
 * Counter state is never persisted (Phase 81 concern). It is reset on reload.
 * All mutations return a new FirewallState via spread; the original is never modified.
 *
 * Mirrors AclState's Readonly<Record<string, AclEntry>> map shape.
 *
 * @param buckets - Token-bucket counters keyed as `napplet:opClass`.
 * @param bursts  - Init-burst counters keyed by napplet dTag.
 */
export interface FirewallState {
  readonly buckets: Readonly<Record<string, Bucket>>;
  readonly bursts: Readonly<Record<string, BurstCounter>>;
}

/**
 * Result returned by evaluate() — the complete output of one firewall check.
 *
 * The caller uses `decision` to determine what to do:
 * - `'pass'`   → dispatch (action may be `'flag'` → also emit audit event).
 * - `'reject'` → drop + return error.
 * - `'prompt'` → reject now + fire consent prompt.
 *
 * @param decision  - Primary disposition for the caller.
 * @param action    - The matched rule's exceed-action (informational for `'pass'`).
 * @param ruleId    - Identifier of the rule that made the decision (or 'default').
 * @param reason    - Human-readable reason string for logging/audit.
 * @param newState  - The updated FirewallState after this observation (original unchanged).
 */
export interface EvaluateResult {
  readonly decision: Decision;
  readonly action: Action;
  readonly ruleId: string;
  readonly reason: string;
  readonly newState: FirewallState;
}
