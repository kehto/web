/**
 * @kehto/firewall — Pure, WASM-ready behavioral firewall engine for the napplet protocol.
 *
 * Zero dependencies. Zero side effects. All functions are pure:
 * config + state + observation in, decision + next-state out.
 * Designed for deterministic rate-limiting decisions that could be compiled to
 * WASM without modification (the WASM-ready boundary).
 *
 * @example
 * ```ts
 * import { evaluate, defaultConfig, createState } from '@kehto/firewall';
 *
 * // Create default config with conservative built-in limits
 * const config = defaultConfig();
 * // config.defaultRate.action === 'flag'    (allow + audit)
 * // config.burstGuard.action === 'block'    (stop init floods)
 * // config.unfocusedMultiplier === 0.25     (tighten background napplets)
 *
 * // Create empty ephemeral counter state (reset on reload)
 * let state = createState();
 *
 * // Build the observation from the protocol envelope (Phase 81 concern)
 * const obs = {
 *   napplet: 'chat',
 *   opClass: 'relay:write',
 *   kind: 1,
 *   focused: true,
 *   now: 1_000_000, // injected — evaluate() never reads a wall clock
 * };
 *
 * // Evaluate — pure, no side effects
 * const result = evaluate(config, state, obs);
 * // result.decision === 'pass' | 'reject' | 'prompt'
 * // result.action  === 'flag' | 'block' | 'ignore'
 * // result.ruleId  === 'rate:default' | 'burst' | 'policy:deny' | ...
 * // result.reason  === human-readable reason string
 * // result.newState — updated token-bucket state; advance for next call
 * state = result.newState;
 * ```
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  Observation,
  FirewallConfig,
  NappletRules,
  RateLimit,
  BurstGuard,
  ContentMatcher,
  NappletPolicy,
  FirewallState,
  Bucket,
  BurstCounter,
  Decision,
  Action,
  EvaluateResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Pure decision engine
// ---------------------------------------------------------------------------

export { evaluate, toKey } from './evaluate.js';

// ---------------------------------------------------------------------------
// Config mutations + serialization
// ---------------------------------------------------------------------------

export {
  setPolicy,
  setRateLimit,
  setGlobalRate,
  addMatcher,
  serialize,
  deserialize,
} from './config.js';

// ---------------------------------------------------------------------------
// Defaults + factories
// ---------------------------------------------------------------------------

export {
  defaultConfig,
  createState,
  DEFAULT_EXCEED_ACTION,
  DEFAULT_BURST_ACTION,
  DEFAULT_UNFOCUSED_MULTIPLIER,
  DEFAULT_RATE_CAPACITY,
  DEFAULT_RATE_WINDOW_MS,
  DEFAULT_BURST_WINDOW_MS,
  DEFAULT_BURST_MAX_OPS,
} from './defaults.js';
