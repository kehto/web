import { assertRateLimitConfig, createRateLimitState, evaluateRateLimit, retireRateLimitLifecycle } from './rate-limit.js';
import type { RateLimitConfig, RateLimitObservation, RateLimitResult } from './rate-limit.js';

/** Explicitly constructed temporal policy with host-owned counters. */
export interface RateLimiter {
  readonly config: RateLimitConfig;
  setConfig(config: RateLimitConfig): void;
  evaluate(observation: RateLimitObservation, mode?: 'enforce' | 'observe'): RateLimitResult;
  retire(subject: string, lifecycle: string): void;
}

function snapshot(config: RateLimitConfig): RateLimitConfig {
  assertRateLimitConfig(config);
  return Object.freeze({ ...config, burst: Object.freeze({ ...config.burst }) });
}

/**
 * Construct an optional limiter; configuration is required and detached.
 * @param initial - Host-selected operation or prompt budget.
 * @returns A limiter retaining counters across configuration updates.
 * @example const limiter = createRateLimiter(defaultRateLimitConfig());
 */
export function createRateLimiter(initial: RateLimitConfig): RateLimiter {
  let config = snapshot(initial);
  let state = createRateLimitState();
  return {
    get config() { return config; },
    setConfig(next) { config = snapshot(next); },
    evaluate(observation, mode = 'enforce') {
      const effective = mode === 'observe' ? { ...config,
        action: config.action === 'block' ? 'flag' as const : config.action,
        burst: { ...config.burst, action: config.burst.action === 'block' ? 'flag' as const : config.burst.action },
      } : config;
      const result = evaluateRateLimit(effective, state, observation);
      state = result.state;
      return result;
    },
    retire(subject, lifecycle) { state = retireRateLimitLifecycle(state, subject, lifecycle); },
  };
}
