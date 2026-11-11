
import type { Action, FirewallConfig, FirewallState } from './types.js';

/**
 * Default exceed-action for rate limits: `flag` (pass + audit).
 *
 * Conservative, allow-and-audit default — operations are never silently blocked
 * on first deployment. The shell hears about violations via audit events without
 * disrupting the napplet experience (CORE-04).
 *
 * @example
 * ```ts
 * const limit: RateLimit = { capacity: 60, windowMs: 60_000, action: DEFAULT_EXCEED_ACTION };
 * ```
 */
export const DEFAULT_EXCEED_ACTION: Action = 'flag';

/**
 * Default action for the init-burst guard: `block`.
 *
 * The burst guard is the one documented exception to the conservative `flag`
 * default. A napplet that fires more than `DEFAULT_BURST_MAX_OPS` operations
 * within its initialization window is almost certainly misbehaving and should
 * be stopped immediately (BURST-02).
 *
 * @example
 * ```ts
 * const guard: BurstGuard = { windowMs: DEFAULT_BURST_WINDOW_MS, maxOps: DEFAULT_BURST_MAX_OPS, action: DEFAULT_BURST_ACTION };
 * ```
 */
export const DEFAULT_BURST_ACTION: Action = 'block';

/**
 * Fractional capacity multiplier applied to unfocused napplets: `0.25`.
 *
 * Scales the effective token-bucket capacity for napplets that are not the
 * currently focused window. Chosen at 1/4 so background napplets can still
 * make legitimate low-rate requests while a sustained high-rate attack from a
 * background napplet is throttled quickly.
 *
 * MUST remain strictly greater than 0 — focus alone must NEVER hard-block a
 * napplet (FOCUS-02 invariant). A value of 0 would be equivalent to an
 * unconditional deny for all unfocused napplets.
 *
 * @example
 * ```ts
 * const effectiveCapacity = limit.capacity * (obs.focused ? 1 : DEFAULT_UNFOCUSED_MULTIPLIER);
 * ```
 */
export const DEFAULT_UNFOCUSED_MULTIPLIER = 0.25;

/**
 * Default token-bucket capacity: 60 operations per window.
 *
 * 60 ops/minute is generous for typical napplet relay interactions (reading
 * profiles, publishing notes) while providing a clear ceiling against rapid
 * automated relay flooding. Conservative without being restrictive for
 * well-behaved napplets (CORE-04).
 *
 * @example
 * ```ts
 * const limit: RateLimit = { capacity: DEFAULT_RATE_CAPACITY, windowMs: DEFAULT_RATE_WINDOW_MS, action: DEFAULT_EXCEED_ACTION };
 * ```
 */
export const DEFAULT_RATE_CAPACITY = 60;

/**
 * Default token-bucket window: 60 000 ms (1 minute).
 *
 * A 1-minute rolling window pairs with `DEFAULT_RATE_CAPACITY` (60 ops) to
 * give each napplet 1 op/second sustained throughput — sufficient for relay
 * reads, publish flows, and intent invocations under normal usage (CORE-04).
 *
 * @example
 * ```ts
 * const refillRatePerMs = DEFAULT_RATE_CAPACITY / DEFAULT_RATE_WINDOW_MS; // 0.001 ops/ms
 * ```
 */
export const DEFAULT_RATE_WINDOW_MS = 60_000;

/**
 * Default init-burst guard window: 3 000 ms (3 seconds).
 *
 * The initialization window covers the first few seconds after a napplet loads.
 * Legitimate napplets bootstrap with a small number of setup requests; a napplet
 * that fires many ops in the first 3 seconds is exhibiting burst-attack behavior
 * (BURST-01, BURST-02).
 *
 * @example
 * ```ts
 * const guard: BurstGuard = { windowMs: DEFAULT_BURST_WINDOW_MS, maxOps: DEFAULT_BURST_MAX_OPS, action: DEFAULT_BURST_ACTION };
 * ```
 */
export const DEFAULT_BURST_WINDOW_MS = 3_000;

/**
 * Default init-burst guard operation cap: 20 operations.
 *
 * 20 ops within the first 3 seconds is more than enough for any legitimate
 * initialization sequence (subscribe, fetch profile, query relays). Exceeding
 * this indicates automated request flooding and triggers the `block` action
 * (BURST-02). Value chosen to tolerate brief SDK setup bursts while stopping
 * malicious behavior.
 *
 * @example
 * ```ts
 * const guard: BurstGuard = { windowMs: DEFAULT_BURST_WINDOW_MS, maxOps: DEFAULT_BURST_MAX_OPS, action: DEFAULT_BURST_ACTION };
 * ```
 */
export const DEFAULT_BURST_MAX_OPS = 20;

/**
 * Assemble the built-in default FirewallConfig.
 *
 * Returns a fresh config applying conservative rate/burst limits to every
 * napplet out of the box. No per-napplet rules or content matchers are
 * pre-configured — those are added via the mutation functions in config.ts.
 *
 * The exceed-action default is `flag` (CORE-04 — allow + audit). The
 * init-burst guard default is `block` (BURST-02 — the documented exception).
 *
 * @returns A new FirewallConfig with conservative built-in limits
 *
 * @example
 * ```ts
 * const config = defaultConfig();
 * // config.defaultRate.action === 'flag'
 * // config.burstGuard.action === 'block'
 * // config.unfocusedMultiplier === 0.25
 * ```
 */
export function defaultConfig(): FirewallConfig {
  return {
    napplets: {},
    matchers: [],
    burstGuard: {
      windowMs: DEFAULT_BURST_WINDOW_MS,
      maxOps: DEFAULT_BURST_MAX_OPS,
      action: DEFAULT_BURST_ACTION,
    },
    defaultRate: {
      capacity: DEFAULT_RATE_CAPACITY,
      windowMs: DEFAULT_RATE_WINDOW_MS,
      action: DEFAULT_EXCEED_ACTION,
    },
    unfocusedMultiplier: DEFAULT_UNFOCUSED_MULTIPLIER,
  };
}

/**
 * Create an empty FirewallState with no token-bucket or burst counters.
 *
 * Returns a fresh ephemeral counter state. Counter state is never persisted
 * (Phase 81 concern) — it is reset on reload and rebuilt as observations arrive.
 *
 * Mirrors the `createState()` factory pattern from @kehto/acl/mutations.ts.
 *
 * @returns A new FirewallState with empty buckets and bursts maps
 *
 * @example
 * ```ts
 * const state = createState();
 * // { buckets: {}, bursts: {} }
 * ```
 */
export function createState(): FirewallState {
  return { buckets: {}, bursts: {} };
}
