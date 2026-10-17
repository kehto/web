import { describe, expect, it } from 'vitest';
import {
  createRateLimitState, defaultRateLimitConfig, evaluateRateLimit, retireRateLimitLifecycle,
  type RateLimitConfig, type RateLimitObservation,
} from './rate-limit.js';

const observation: RateLimitObservation = {
  subject: '35129:publisher:app', operation: 'link.open', lifecycle: 'frame:1',
  elapsedSinceStartMs: 4_000, focused: true, now: 4_000,
};
const config: RateLimitConfig = { ...defaultRateLimitConfig(), action: 'block' };

describe('independent temporal budgets', () => {
  it('allows 60 operations and refills one token per second', () => {
    let state = createRateLimitState();
    for (let i = 0; i < 60; i++) {
      const result = evaluateRateLimit(config, state, observation);
      expect(result.allowed).toBe(true);
      state = result.state;
    }
    const denied = evaluateRateLimit(config, state, observation);
    expect(denied).toMatchObject({ allowed: false, reason: 'rate-exceeded' });
    const half = evaluateRateLimit(config, denied.state, { ...observation, now: 4_500 });
    expect(half.allowed).toBe(false);
    expect(evaluateRateLimit(config, half.state, { ...observation, now: 5_000 }).allowed).toBe(true);
  });

  it.each(['flag', 'ignore'] as const)('reports exceeded %s budgets without blocking', (action) => {
    const budget = { ...config, capacity: 1, action };
    const first = evaluateRateLimit(budget, createRateLimitState(), observation);
    expect(evaluateRateLimit(budget, first.state, observation)).toMatchObject({ allowed: true, action, reason: 'rate-exceeded' });
  });

  it('blocks operation 21 in the same startup lifecycle across operation classes', () => {
    let state = createRateLimitState();
    for (let i = 0; i < 20; i++) {
      const result = evaluateRateLimit(config, state, { ...observation, elapsedSinceStartMs: 0, operation: `operation:${i}` });
      expect(result.allowed).toBe(true);
      state = result.state;
    }
    expect(evaluateRateLimit(config, state, { ...observation, elapsedSinceStartMs: 0 })).toMatchObject({ reason: 'burst-exceeded', allowed: false });
    expect(evaluateRateLimit(config, state, { ...observation, elapsedSinceStartMs: 0, lifecycle: 'frame:2' }).allowed).toBe(true);
  });

  it('retiring a lifecycle preserves the shared operation budget', () => {
    const budget = { ...config, capacity: 1 };
    const first = evaluateRateLimit(budget, createRateLimitState(), { ...observation, elapsedSinceStartMs: 0 });
    const next = retireRateLimitLifecycle(first.state, observation.subject, observation.lifecycle);
    expect(next.bursts).toEqual({});
    expect(next.buckets).toBe(first.state.buckets);
    expect(evaluateRateLimit(budget, next, { ...observation, lifecycle: 'frame:2' }).allowed).toBe(false);
  });

  it('shares tokens across focus changes and tightens background capacity to 15', () => {
    let state = createRateLimitState();
    for (let i = 0; i < 15; i++) {
      const next = evaluateRateLimit(config, state, { ...observation, focused: false });
      expect(next.allowed).toBe(true);
      state = next.state;
    }
    expect(evaluateRateLimit(config, state, observation).allowed).toBe(false);
    expect(evaluateRateLimit(config, state, { ...observation, focused: false, now: 8_000 }).allowed).toBe(true);
  });

  it('does not refill twice when the injected clock moves backwards', () => {
    const budget = { ...config, capacity: 1, windowMs: 1_000 };
    let state = evaluateRateLimit(budget, createRateLimitState(), observation).state;
    state = evaluateRateLimit(budget, state, { ...observation, now: 3_000 }).state;
    expect(evaluateRateLimit(budget, state, observation).allowed).toBe(false);
    expect(evaluateRateLimit(budget, state, { ...observation, now: 5_000 }).allowed).toBe(true);
  });

  it('isolates subjects and operations even when colon concatenation collides', () => {
    const budget = { ...config, capacity: 1 };
    const first = evaluateRateLimit(budget, createRateLimitState(), { ...observation, subject: 'a:b', operation: 'c' });
    expect(evaluateRateLimit(budget, first.state, { ...observation, subject: 'a', operation: 'b:c' }).allowed).toBe(true);
    expect(evaluateRateLimit(budget, first.state, { ...observation, subject: 'a:b', operation: 'd' }).allowed).toBe(true);
  });

  it('does not accept a permission override and never mutates its inputs', () => {
    const budget = Object.freeze({ ...config, capacity: 1, policy: 'allow' });
    const initial = Object.freeze({ buckets: Object.freeze({}), bursts: Object.freeze({}) });
    const input = Object.freeze({ ...observation, approved: true });
    const first = evaluateRateLimit(budget, initial, input);
    expect(evaluateRateLimit(budget, first.state, input).allowed).toBe(false);
    expect(initial).toEqual({ buckets: {}, bursts: {} });
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid capacity %s before changing counters', (capacity) => {
    const state = createRateLimitState();
    expect(() => evaluateRateLimit({ ...config, capacity }, state, observation)).toThrow(RangeError);
    expect(state).toEqual({ buckets: {}, bursts: {} });
  });

  it.each([
    { windowMs: 0 }, { unfocusedMultiplier: 0 }, { unfocusedMultiplier: 2 },
    { burst: { ...config.burst, maxOperations: 1.5 } },
  ])('rejects an invalid configuration %j', (override) => {
    expect(() => evaluateRateLimit({ ...config, ...override }, createRateLimitState(), observation)).toThrow(RangeError);
  });

  it('rejects nonfinite clocks', () => {
    expect(() => evaluateRateLimit(config, createRateLimitState(), { ...observation, now: NaN })).toThrow(RangeError);
  });
});
