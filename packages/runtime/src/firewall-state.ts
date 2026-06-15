/**
 * firewall-state.ts — Firewall state container with persistence hooks.
 *
 * Wraps @kehto/firewall's pure functions with persistence via
 * FirewallPersistence. No localStorage or DOM references.
 *
 * Two independent `let`-bound cells:
 *   - `config`   — immutable FirewallConfig; persisted on each mutation.
 *   - `counters` — ephemeral FirewallState (token-buckets + burst counters);
 *                  in-memory only, reset on reload (RUNTIME-03).
 *
 * CRITICAL: `evaluate` reassigns `counters = result.newState` on every call.
 * Without this, token buckets never advance and flood events never escalate
 * from 'flag' to 'block'.
 */

import type {
  Observation,
  FirewallConfig,
  FirewallState,
  NappletPolicy,
  RateLimit,
  ContentMatcher,
  EvaluateResult,
} from '@kehto/firewall';
import {
  evaluate,
  defaultConfig,
  createState,
  serialize,
  deserialize,
  setPolicy,
  setRateLimit,
  setGlobalRate,
  addMatcher,
} from '@kehto/firewall';
import type { FirewallPersistence } from './types.js';

/**
 * Stateful firewall container — wraps @kehto/firewall's pure functions
 * with persistence and a convenient imperative API.
 *
 * Mirrors AclStateContainer from acl-state.ts in structure and naming.
 *
 * @example
 * ```ts
 * const firewall = createFirewallState(persistence);
 * firewall.load();
 * const result = firewall.evaluate({ napplet: 'chat', opClass: 'relay:write', focused: true, now: Date.now() });
 * ```
 */
export interface FirewallStateContainer {
  /**
   * Evaluate an observation against the current firewall config and counters.
   * CRITICAL: advances the in-memory counter state on each call.
   *
   * @param observation - Normalized observation extracted from the napplet message envelope.
   * @returns The full EvaluateResult (decision, action, ruleId, reason, newState).
   */
  evaluate(observation: Observation): EvaluateResult;
  /**
   * Set a per-napplet policy override (allow / deny / ask).
   *
   * @param napplet - The napplet dTag (version-agnostic identity key).
   * @param policy  - Hard policy override for this napplet.
   */
  setPolicy(napplet: string, policy: NappletPolicy): void;
  /**
   * Set a per-(napplet, opClass) token-bucket rate limit.
   *
   * @param napplet  - The napplet dTag.
   * @param opClass  - The operation class string.
   * @param limit    - The rate limit to apply.
   */
  setRateLimit(napplet: string, opClass: string, limit: RateLimit): void;
  /**
   * Set a global rate limit applied to all op-classes that have no specific entry.
   *
   * @param napplet - The napplet dTag.
   * @param limit   - The global fallback rate limit.
   */
  setGlobalRate(napplet: string, limit: RateLimit): void;
  /**
   * Add a content matcher to the firewall config.
   *
   * @param matcher - The content matcher to append.
   */
  addMatcher(matcher: ContentMatcher): void;
  /** Return the current firewall config. */
  getConfig(): FirewallConfig;
  /** Persist the current firewall config via the persistence hook. Best-effort. */
  persist(): void;
  /** Load previously persisted firewall config. Counters are NOT restored. */
  load(): void;
  /** Reset config to defaultConfig() and counters to createState(), then persist empty. */
  clear(): void;
}

/**
 * Create a firewall state container backed by @kehto/firewall and optionally
 * persisted via the given persistence hooks.
 *
 * When `persistence` is absent (or undefined), firewall config is in-memory
 * only and resets on container recreation. This is safe for hosts that do not
 * need durable per-napplet policies.
 *
 * @param persistence - Optional storage backend for firewall config.
 * @returns A FirewallStateContainer instance.
 *
 * @example
 * ```ts
 * const firewall = createFirewallState(persistence);
 * firewall.load();
 * firewall.setPolicy('chat', 'allow');
 * firewall.persist();
 * ```
 */
export function createFirewallState(
  persistence?: FirewallPersistence,
): FirewallStateContainer {
  let config: FirewallConfig = defaultConfig();
  let counters: FirewallState = createState();

  return {
    evaluate(observation: Observation): EvaluateResult {
      const result = evaluate(config, counters, observation);
      counters = result.newState;   // CRITICAL: advance ephemeral counter state
      return result;
    },

    setPolicy(napplet: string, policy: NappletPolicy): void {
      config = setPolicy(config, napplet, policy);
    },

    setRateLimit(napplet: string, opClass: string, limit: RateLimit): void {
      config = setRateLimit(config, napplet, opClass, limit);
    },

    setGlobalRate(napplet: string, limit: RateLimit): void {
      config = setGlobalRate(config, napplet, limit);
    },

    addMatcher(matcher: ContentMatcher): void {
      config = addMatcher(config, matcher);
    },

    getConfig(): FirewallConfig {
      return config;
    },

    persist(): void {
      try {
        persistence?.persist(serialize(config));
      } catch { /* persistence is best-effort */ }
    },

    load(): void {
      try {
        const raw = persistence?.load() ?? null;
        if (!raw) return;
        config = deserialize(raw);
        // counters are deliberately NOT restored (RUNTIME-03: ephemeral)
      } catch {
        config = defaultConfig();
      }
    },

    clear(): void {
      config = defaultConfig();
      counters = createState();
      try { persistence?.persist(''); } catch { /* best-effort */ }
    },
  };
}
