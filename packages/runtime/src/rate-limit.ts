/** Pure temporal controls. Permission grants never enter this evaluator. */

/** What to do when an operation exceeds a configured budget. */
export type RateLimitAction = 'flag' | 'block' | 'ignore';

/** Token budget and initialization budget for one operation class. */
export interface RateLimitConfig {
  readonly capacity: number;
  readonly windowMs: number;
  readonly action: RateLimitAction;
  readonly unfocusedMultiplier: number;
  readonly burst: {
    readonly windowMs: number;
    readonly maxOperations: number;
    readonly action: RateLimitAction;
  };
}

/** Host-attested subject, lifecycle and injected clock for one operation. */
export interface RateLimitObservation {
  readonly subject: string;
  readonly operation: string;
  readonly lifecycle: string;
  readonly elapsedSinceStartMs: number;
  readonly focused: boolean;
  readonly now: number;
}

/** Ephemeral token counter; never persisted as an approval. */
export interface RateBucket {
  readonly tokens: number;
  readonly updatedAt: number;
}

/** Initialization counter shared by operations in one endpoint lifecycle. */
export interface RateBurst {
  readonly count: number;
  readonly startedAt: number;
}

/** Immutable counters. Hosts retire lifecycle counters when endpoints close. */
export interface RateLimitState {
  readonly buckets: Readonly<Record<string, RateBucket>>;
  readonly bursts: Readonly<Record<string, RateBurst>>;
}

/** Verdict and advanced counters for the next observation. */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly action: RateLimitAction;
  readonly reason: 'within-budget' | 'rate-exceeded' | 'burst-exceeded';
  readonly state: RateLimitState;
}

/**
 * Create the historical 60/minute, 20/3-second baseline budgets.
 * @returns A fresh configuration, independent of permission policy.
 * @example const config = defaultRateLimitConfig();
 */
export function defaultRateLimitConfig(): RateLimitConfig {
  return {
    capacity: 60,
    windowMs: 60_000,
    action: 'flag',
    unfocusedMultiplier: 0.25,
    burst: { windowMs: 3_000, maxOperations: 20, action: 'block' },
  };
}

/**
 * Bound approval UI independently from ordinary operation audit budgets.
 * @returns Twelve prompts per minute and eight during initial startup.
 * @example const config = defaultPromptRateLimitConfig();
 */
export function defaultPromptRateLimitConfig(): RateLimitConfig {
  return {
    capacity: 12, windowMs: 60_000, action: 'block', unfocusedMultiplier: 1,
    burst: { windowMs: 3_000, maxOperations: 8, action: 'block' },
  };
}

/**
 * Create empty ephemeral counters.
 * @returns A new counter state.
 * @example let counters = createRateLimitState();
 */
export function createRateLimitState(): RateLimitState {
  return { buckets: {}, bursts: {} };
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validAction(value: RateLimitAction): boolean {
  return value === 'flag' || value === 'block' || value === 'ignore';
}

function validate(config: RateLimitConfig, observation: RateLimitObservation): void {
  if (!positive(config.capacity) || !positive(config.windowMs)
    || !positive(config.unfocusedMultiplier) || config.unfocusedMultiplier > 1
    || !positive(config.burst.windowMs) || !Number.isSafeInteger(config.burst.maxOperations)
    || config.burst.maxOperations < 1 || !validAction(config.action) || !validAction(config.burst.action)) {
    throw new RangeError('Rate limits require finite positive budgets and valid actions');
  }
  if (!observation.subject || !observation.operation || !observation.lifecycle
    || !Number.isFinite(observation.now) || !Number.isFinite(observation.elapsedSinceStartMs)
    || observation.elapsedSinceStartMs < 0 || typeof observation.focused !== 'boolean') {
    throw new RangeError('Rate observations require a subject, operation, lifecycle and finite clock');
  }
}

function verdict(state: RateLimitState, reason: RateLimitResult['reason'], action: RateLimitAction): RateLimitResult {
  return { allowed: action !== 'block', action, reason, state };
}

/**
 * Charge one operation against temporal budgets, regardless of its permission.
 * Configuration errors throw before any state is changed. A backwards clock
 * never moves a bucket timestamp backwards or grants an extra refill.
 * @param config - Validated budget policy selected by the host.
 * @param state - Previous counters, never mutated.
 * @param observation - Trusted identity/lifecycle and injected time.
 * @returns Verdict and counters to use for the next call.
 * @example
 * const result = evaluateRateLimit(defaultRateLimitConfig(), createRateLimitState(), {
 *   subject: 'verified-manifest-key', operation: 'link.open', lifecycle: 'frame:1',
 *   elapsedSinceStartMs: 0, focused: true, now: 0,
 * });
 */
export function evaluateRateLimit(
  config: RateLimitConfig,
  state: RateLimitState,
  observation: RateLimitObservation,
): RateLimitResult {
  validate(config, observation);
  const { subject, operation, lifecycle, now } = observation;
  if (observation.elapsedSinceStartMs < config.burst.windowMs) {
    const key = JSON.stringify([subject, lifecycle]);
    const previous = state.bursts[key];
    const active = previous && now - previous.startedAt < config.burst.windowMs ? previous : undefined;
    const burst = { count: (active?.count ?? 0) + 1, startedAt: active?.startedAt ?? now };
    state = { ...state, bursts: { ...state.bursts, [key]: burst } };
    if (burst.count > config.burst.maxOperations) return verdict(state, 'burst-exceeded', config.burst.action);
  }

  const key = JSON.stringify([subject, operation]);
  const capacity = config.capacity * (observation.focused ? 1 : config.unfocusedMultiplier);
  const previous = state.buckets[key];
  const updatedAt = Math.max(now, previous?.updatedAt ?? now);
  const elapsed = updatedAt - (previous?.updatedAt ?? updatedAt);
  const tokens = Math.min(capacity, (previous?.tokens ?? capacity) + elapsed * (capacity / config.windowMs));
  const exceeded = tokens < 1;
  const bucket = { tokens: exceeded ? tokens : tokens - 1, updatedAt };
  state = { ...state, buckets: { ...state.buckets, [key]: bucket } };
  return verdict(state, exceeded ? 'rate-exceeded' : 'within-budget', exceeded ? config.action : 'ignore');
}

/**
 * Retire initialization counters without resetting the subject's rate budgets.
 * @param state - Current ephemeral counters.
 * @param subject - Host-owned subject key.
 * @param lifecycle - Endpoint generation that has ended.
 * @returns A fresh state when the lifecycle existed, otherwise the original.
 * @example counters = retireRateLimitLifecycle(counters, 'app', 'frame:1');
 */
export function retireRateLimitLifecycle(state: RateLimitState, subject: string, lifecycle: string): RateLimitState {
  const key = JSON.stringify([subject, lifecycle]);
  if (!Object.hasOwn(state.bursts, key)) return state;
  const bursts = { ...state.bursts };
  delete bursts[key];
  return { ...state, bursts };
}
