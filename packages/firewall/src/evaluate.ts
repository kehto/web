/**
 * @kehto/firewall — Pure evaluate function.
 *
 * This module is PURE, SIDE-EFFECT-FREE, and NEVER reads a wall clock.
 * `observation.now` is the only time source — no wall-clock reads, no I/O, no mutations.
 *
 * Designed for deterministic access control decisions that could be compiled to
 * WASM without modification (the WASM-ready boundary).
 */

import type {
  Observation,
  FirewallConfig,
  FirewallState,
  Bucket,
  BurstCounter,
  EvaluateResult,
  Action,
  Decision,
} from './types.js';

/**
 * Compute the token-bucket key from napplet dTag and operation class.
 *
 * Key shape: `${napplet}:${opClass}` — deliberately dTag-only (version-agnostic).
 *
 * DIVERGENCE FROM @kehto/acl: acl uses `dTag:hash` to distinguish napplet
 * versions. The firewall intentionally omits the hash so rate budgets are shared
 * across ALL versions of the same napplet dTag. This is the correct behavior for
 * a behavioral abuse control: we want to track the napplet identity over time,
 * not its specific loaded version.
 *
 * @param napplet - Napplet dTag (version-agnostic identity key)
 * @param opClass - Operation class string (e.g. 'relay:write', 'outbox:publish')
 * @returns Composite key string `napplet:opClass`
 *
 * @example
 * ```ts
 * toKey('chat', 'relay:write')
 * // => 'chat:relay:write'
 * ```
 */
export function toKey(napplet: string, opClass: string): string {
  return `${napplet}:${opClass}`;
}

/**
 * Map a rule Action to the caller-facing Decision.
 *
 * - `'flag'`   → `'pass'` (caller dispatches + emits audit event)
 * - `'block'`  → `'reject'` (caller drops the operation)
 * - `'ignore'` → `'pass'` (caller dispatches silently)
 */
function actionToDecision(action: Action): Decision {
  if (action === 'block') return 'reject';
  return 'pass'; // 'flag' and 'ignore' both pass
}

/**
 * Evaluate a single firewall observation and return the access decision.
 *
 * PURE: no wall-clock reads (no system time APIs), no I/O, no mutation.
 * All time comes from `observation.now`. The original `config` and `state`
 * are NEVER modified — every `newState` is returned via immutable spread.
 *
 * ## Precedence order (A1 — POLICY-03, first-match-wins, most→least specific)
 *
 * 1. **Per-napplet policy** (`allow` / `deny` / `ask`) — hard override for the dTag.
 *    `allow` → pass (bypass everything); `deny` → reject (block); `ask` → prompt.
 *    Policy returns do NOT advance any counters; newState = input state.
 *
 * 2. **Init-burst guard** — if `observation.initElapsedMs` is defined and less than
 *    `config.burstGuard.windowMs`, the burst counter for this napplet is advanced.
 *    If the count exceeds `config.burstGuard.maxOps`, the burst action fires
 *    (default `block`). The advanced burst counter is returned in newState.
 *
 * 3. **Content matchers** — `config.matchers` are evaluated in order; the FIRST
 *    matcher whose declared conditions (opClass, kinds, size, focus, msSinceFocusGain)
 *    ALL hold fires its action. Matchers do NOT advance the token bucket.
 *
 * 4. **Per-napplet × op-class rate limit** (`config.napplets[napplet].rateLimits[opClass]`)
 *    with ruleId `'rate:opclass'`.
 *
 * 5. **Per-napplet global rate fallback** (`config.napplets[napplet].globalRate`)
 *    for op-classes with no specific rateLimits entry. ruleId `'rate:global'`.
 *
 * 6. **Global default rate** (`config.defaultRate`) — applied when no napplet-specific
 *    rule exists. ruleId `'rate:default'`.
 *
 * ## Unfocused multiplier (A2 — FOCUS-02)
 *
 * When `observation.focused === false`, the effective bucket capacity is tightened:
 * `effectiveCapacity = limit.capacity * config.unfocusedMultiplier`.
 * Refill rate is derived as `effectiveCapacity / windowMs` so the drip also tightens
 * proportionally. The bucket KEY stays stable (`napplet:opClass`, no focus suffix).
 * Because the multiplier is always `> 0`, an unfocused napplet's budget is reduced
 * but never zero — **focus alone NEVER hard-blocks**.
 *
 * @param config      - Immutable firewall configuration
 * @param state       - Current ephemeral counter state (never mutated)
 * @param observation - Normalized observation (the sole input surface — CORE-02)
 * @returns Decision result with updated counter state
 *
 * @example
 * ```ts
 * import { evaluate, defaultConfig, createState } from '@kehto/firewall';
 *
 * const config = defaultConfig();
 * const state = createState();
 * const obs = {
 *   napplet: 'chat',
 *   opClass: 'relay:write',
 *   focused: true,
 *   now: injectedTimestamp,  // caller supplies time; evaluate() never reads a clock
 * };
 *
 * const result = evaluate(config, state, obs);
 * // result.decision === 'pass'
 * // result.newState has an updated token bucket for 'chat:relay:write'
 * ```
 */
export function evaluate(
  config: FirewallConfig,
  state: FirewallState,
  observation: Observation,
): EvaluateResult {
  const { napplet, opClass, now } = observation;

  const nappletRules = config.napplets[napplet];
  const policy = nappletRules?.policy;

  if (policy === 'allow') {
    return {
      decision: 'pass',
      action: 'ignore',
      ruleId: 'policy:allow',
      reason: `napplet ${napplet} has allow policy — bypassing all checks`,
      newState: state,
    };
  }

  if (policy === 'deny') {
    return {
      decision: 'reject',
      action: 'block',
      ruleId: 'policy:deny',
      reason: `napplet ${napplet} has deny policy — always rejected`,
      newState: state,
    };
  }

  if (policy === 'ask') {
    return {
      decision: 'prompt',
      action: 'block',
      ruleId: 'policy:ask',
      reason: `napplet ${napplet} has ask policy — prompting for consent`,
      newState: state,
    };
  }

  const { initElapsedMs } = observation;

  if (initElapsedMs !== undefined && initElapsedMs < config.burstGuard.windowMs) {
    // Advance the burst counter for this napplet
    const existingBurst: BurstCounter | undefined = state.bursts[napplet];
    const newBurst: BurstCounter = {
      count: (existingBurst?.count ?? 0) + 1,
      windowStart: existingBurst?.windowStart ?? now,
    };

    const newBursts = { ...state.bursts, [napplet]: newBurst };

    if (newBurst.count > config.burstGuard.maxOps) {
      const burstAction = config.burstGuard.action;
      return {
        decision: actionToDecision(burstAction),
        action: burstAction,
        ruleId: 'burst',
        reason: `napplet ${napplet} exceeded init-burst limit (${newBurst.count} > ${config.burstGuard.maxOps} ops within ${config.burstGuard.windowMs}ms)`,
        newState: { ...state, bursts: newBursts },
      };
    }

    // Burst count advanced but not exceeded — continue to next tier with updated bursts
    // We update state to carry the burst counter forward
    state = { ...state, bursts: newBursts };
  }

  for (const matcher of config.matchers) {
    if (matcher.opClass !== undefined && matcher.opClass !== opClass) continue;

    // Check kinds condition (observation.kind must be in the set)
    if (matcher.kinds !== undefined) {
      if (observation.kind === undefined) continue;
      if (!matcher.kinds.includes(observation.kind)) continue;
    }

    if (matcher.minSize !== undefined) {
      if (observation.size === undefined) continue;
      if (observation.size < matcher.minSize) continue;
    }

    if (matcher.focused !== undefined && matcher.focused !== observation.focused) continue;

    if (matcher.maxMsSinceFocusGain !== undefined) {
      if (observation.msSinceFocusGain === undefined) continue;
      if (observation.msSinceFocusGain > matcher.maxMsSinceFocusGain) continue;
    }

    // All conditions satisfied — this matcher fires
    const matcherAction = matcher.action;
    return {
      decision: actionToDecision(matcherAction),
      action: matcherAction,
      ruleId: `matcher:${matcher.id}`,
      reason: `content matcher '${matcher.id}' fired`,
      newState: state,
    };
  }

  // Resolve the applicable RateLimit (precedence: op-class > global > default)
  let rateLimit = config.defaultRate;
  let rateLimitRuleId = 'rate:default';

  if (nappletRules) {
    const opClassLimit = nappletRules.rateLimits[opClass];
    if (opClassLimit) {
      rateLimit = opClassLimit;
      rateLimitRuleId = 'rate:opclass';
    } else if (nappletRules.globalRate) {
      rateLimit = nappletRules.globalRate;
      rateLimitRuleId = 'rate:global';
    }
  }

  // Apply focus multiplier to capacity (A2 — never zeroes the budget)
  const effectiveCapacity = observation.focused
    ? rateLimit.capacity
    : rateLimit.capacity * config.unfocusedMultiplier;

  // Refill rate derived from effective capacity (drip tightens proportionally with focus)
  const refillRatePerMs = effectiveCapacity / rateLimit.windowMs;

  // Lazy-init bucket: absent key means fresh napplet starting full at `now`
  const bucketKey = toKey(napplet, opClass);
  const existingBucket: Bucket | undefined = state.buckets[bucketKey];

  // RESEARCH Pattern 2 token-bucket math:
  // lazy `lastRefill || now` init — a fresh key starts FULL at effectiveCapacity at now
  const lastRefill = existingBucket?.lastRefill ?? now;
  const initialTokens = existingBucket?.tokens ?? effectiveCapacity;

  // Clamp negative clock skew to 0 (T-80-03 mitigation)
  const elapsed = Math.max(0, now - lastRefill);

  // Refill tokens up to effectiveCapacity, keep fractional tokens
  const tokens = Math.min(effectiveCapacity, initialTokens + elapsed * refillRatePerMs);

  if (tokens >= 1) {
    // Within budget — spend one token and pass
    // ruleId encodes the resolution path so callers and tests can observe which tier resolved
    const nextBucket: Bucket = { tokens: tokens - 1, lastRefill: now };
    return {
      decision: 'pass',
      action: 'ignore',
      ruleId: rateLimitRuleId,
      reason: `within budget (${rateLimitRuleId})`,
      newState: {
        ...state,
        buckets: { ...state.buckets, [bucketKey]: nextBucket },
      },
    };
  } else {
    // Exceeded budget — apply the rule's exceed-action; still update bucket (no token spent)
    const nextBucket: Bucket = { tokens, lastRefill: now };
    const exceedAction = rateLimit.action;
    return {
      decision: actionToDecision(exceedAction),
      action: exceedAction,
      ruleId: rateLimitRuleId,
      reason: `rate limit exceeded (${rateLimitRuleId}): ${tokens.toFixed(4)} tokens available, need 1`,
      newState: {
        ...state,
        buckets: { ...state.buckets, [bucketKey]: nextBucket },
      },
    };
  }
}
