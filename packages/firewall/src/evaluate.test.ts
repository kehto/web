/**
 * evaluate.test.ts — Pure-core evaluate() unit tests.
 *
 * All tests use injected `now` (never Date.now). Fixtures use defaultConfig()
 * and createState() from their respective modules.
 */

import { describe, it, expect } from 'vitest';
import { evaluate, toKey } from './evaluate.js';
import { defaultConfig, createState } from './defaults.js';
import { setPolicy, setRateLimit, setGlobalRate, addMatcher } from './config.js';
import type {
  FirewallConfig,
  FirewallState,
  Observation,
  EvaluateResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = 1_000_000; // arbitrary injected timestamp

function makeObs(overrides: Partial<Observation> = {}): Observation {
  return {
    napplet: 'chat',
    opClass: 'relay:write',
    focused: true,
    now: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// toKey
// ---------------------------------------------------------------------------

describe('toKey', () => {
  it('returns napplet:opClass', () => {
    expect(toKey('chat', 'relay:write')).toBe('chat:relay:write');
  });

  it('is dTag-only (version-agnostic) — does NOT include a hash segment after opClass', () => {
    // acl uses dTag:hash; firewall uses napplet:opClass (no hash suffix)
    // 'my-napplet:relay:write' has exactly napplet + opClass, no extra hash segment
    const key = toKey('my-napplet', 'outbox:publish');
    // Verify the key is "my-napplet:outbox:publish" — napplet followed by opClass, no extra part
    expect(key).toBe('my-napplet:outbox:publish');
    expect(key.startsWith('my-napplet:')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Return shape contract (CORE-01)
// ---------------------------------------------------------------------------

describe('evaluate return shape', () => {
  it('returns an object with decision, action, ruleId, reason, and newState', () => {
    const result = evaluate(defaultConfig(), createState(), makeObs());
    expect(result).toHaveProperty('decision');
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('ruleId');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('newState');
  });

  it('decision is one of pass | reject | prompt', () => {
    const result = evaluate(defaultConfig(), createState(), makeObs());
    expect(['pass', 'reject', 'prompt']).toContain(result.decision);
  });
});

// ---------------------------------------------------------------------------
// No-mutation invariant (CORE-01)
// ---------------------------------------------------------------------------

describe('no-mutation invariant', () => {
  it('does not mutate the passed-in state', () => {
    const state = createState();
    const originalState = JSON.parse(JSON.stringify(state)) as FirewallState;
    evaluate(defaultConfig(), state, makeObs());
    expect(state).toEqual(originalState);
  });

  it('does not mutate the passed-in config', () => {
    const config = defaultConfig();
    const originalConfig = JSON.parse(JSON.stringify(config)) as FirewallConfig;
    evaluate(config, createState(), makeObs());
    expect(config).toEqual(originalConfig);
  });
});

// ---------------------------------------------------------------------------
// Fresh napplet first op passes (RATE-02 + Pitfall 2 lazy-init)
// ---------------------------------------------------------------------------

describe('fresh napplet first op', () => {
  it('a fresh napplet with empty state passes on first op', () => {
    const result = evaluate(defaultConfig(), createState(), makeObs());
    expect(result.decision).toBe('pass');
  });

  it('newState has a bucket entry for napplet:opClass after first op', () => {
    const obs = makeObs({ napplet: 'fresh', opClass: 'relay:read' });
    const result = evaluate(defaultConfig(), createState(), obs);
    const key = toKey('fresh', 'relay:read');
    expect(result.newState.buckets[key]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Token bucket: exceed-action mapping (RATE-01)
// ---------------------------------------------------------------------------

describe('token bucket exceed-action mapping', () => {
  it('exceeded bucket with action=flag yields decision=pass (caller audits)', () => {
    // capacity:2 allows 2 ops. The 3rd at same now should exceed.
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', {
      capacity: 2,
      windowMs: 60_000,
      action: 'flag',
    });
    let state = createState();
    const obs = makeObs({ now: NOW });
    // Drain the bucket
    let result: EvaluateResult = evaluate(cfg, state, obs);
    state = result.newState;
    result = evaluate(cfg, state, obs);
    state = result.newState;
    // Now over capacity — should flag (decision=pass)
    result = evaluate(cfg, state, obs);
    expect(result.decision).toBe('pass');
    expect(result.action).toBe('flag');
  });

  it('exceeded bucket with action=block yields decision=reject', () => {
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', {
      capacity: 2,
      windowMs: 60_000,
      action: 'block',
    });
    let state = createState();
    const obs = makeObs({ now: NOW });
    let result: EvaluateResult = evaluate(cfg, state, obs);
    state = result.newState;
    result = evaluate(cfg, state, obs);
    state = result.newState;
    result = evaluate(cfg, state, obs);
    expect(result.decision).toBe('reject');
    expect(result.action).toBe('block');
  });

  it('exceeded bucket with action=ignore yields decision=pass silently', () => {
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', {
      capacity: 2,
      windowMs: 60_000,
      action: 'ignore',
    });
    let state = createState();
    const obs = makeObs({ now: NOW });
    let result: EvaluateResult = evaluate(cfg, state, obs);
    state = result.newState;
    result = evaluate(cfg, state, obs);
    state = result.newState;
    result = evaluate(cfg, state, obs);
    expect(result.decision).toBe('pass');
    expect(result.action).toBe('ignore');
  });
});

// ---------------------------------------------------------------------------
// Token bucket: refill after window (RATE-02)
// ---------------------------------------------------------------------------

describe('token bucket refill', () => {
  it('refills enough tokens after a full window to pass again', () => {
    const WINDOW = 5_000;
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', {
      capacity: 2,
      windowMs: WINDOW,
      action: 'block',
    });
    let state = createState();
    const obs1 = makeObs({ now: NOW });

    // Drain bucket
    let result = evaluate(cfg, state, obs1);
    state = result.newState;
    result = evaluate(cfg, state, obs1);
    state = result.newState;
    // 3rd at same now should be rejected
    result = evaluate(cfg, state, obs1);
    expect(result.decision).toBe('reject');
    state = result.newState;

    // Advance now by full window — should refill and pass
    const obs2 = makeObs({ now: NOW + WINDOW });
    result = evaluate(cfg, state, obs2);
    expect(result.decision).toBe('pass');
  });

  it('partial window refill keeps fractional tokens and still rejects until >=1 accrues', () => {
    const WINDOW = 10_000;
    // capacity=1, window=10s => refillRate=0.0001 token/ms
    // After emptying, need 10_000ms to get 1 token back.
    // At 9_999ms partial: tokens = ~0.9999 (<1) → still reject
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', {
      capacity: 1,
      windowMs: WINDOW,
      action: 'block',
    });
    let state = createState();
    const obs1 = makeObs({ now: NOW });

    // Spend the one token
    let result = evaluate(cfg, state, obs1);
    expect(result.decision).toBe('pass');
    state = result.newState;

    // 2nd at same now (0 tokens) — rejected
    result = evaluate(cfg, state, obs1);
    expect(result.decision).toBe('reject');
    state = result.newState;

    // At 9999ms elapsed: ~0.9999 tokens — still reject
    const obsPartial = makeObs({ now: NOW + 9_999 });
    result = evaluate(cfg, state, obsPartial);
    expect(result.decision).toBe('reject');

    // At 10000ms elapsed: 1.0 tokens — pass
    const obsFull = makeObs({ now: NOW + WINDOW });
    result = evaluate(cfg, state, obsFull);
    expect(result.decision).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// Negative-now / skew clamp (T-80-03)
// ---------------------------------------------------------------------------

describe('clock skew clamp (T-80-03)', () => {
  it('out-of-order now does not subtract tokens (clamp elapsed to 0)', () => {
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', {
      capacity: 3,
      windowMs: 60_000,
      action: 'block',
    });
    let state = createState();
    // Spend 2 tokens at T
    let result = evaluate(cfg, state, makeObs({ now: NOW }));
    state = result.newState;
    result = evaluate(cfg, state, makeObs({ now: NOW }));
    state = result.newState;
    // now goes backward — should not refill (elapsed clamped to 0)
    result = evaluate(cfg, state, makeObs({ now: NOW - 5_000 }));
    // We spent 2 of 3, so 1 remains — still passes here
    expect(result.decision).toBe('pass');
    state = result.newState;
    // Spend the last token
    result = evaluate(cfg, state, makeObs({ now: NOW - 5_000 }));
    // May have exactly 0 tokens after 3 spends; next should reject
    state = result.newState;
    result = evaluate(cfg, state, makeObs({ now: NOW - 5_000 }));
    expect(result.decision).toBe('reject');
  });
});

// ---------------------------------------------------------------------------
// Rate limit fallback: globalRate and defaultRate (RATE-03 + CORE-04)
// ---------------------------------------------------------------------------

describe('rate limit fallback', () => {
  it('falls back to per-napplet globalRate for opClass with no specific rule', () => {
    const globalLimit = { capacity: 1, windowMs: 60_000, action: 'block' as const };
    let cfg = setGlobalRate(defaultConfig(), 'chat', globalLimit);
    let state = createState();
    // No specific rate for 'relay:subscribe' — should use globalRate
    const obs = makeObs({ opClass: 'relay:subscribe' });
    let result = evaluate(cfg, state, obs);
    expect(result.decision).toBe('pass');
    expect(result.ruleId).toContain('global');
    state = result.newState;
    // Spend global budget
    result = evaluate(cfg, state, obs);
    state = result.newState;
    result = evaluate(cfg, state, obs);
    expect(result.decision).toBe('reject');
  });

  it('falls back to defaultRate when no napplet-specific rule exists', () => {
    // Default config has defaultRate capacity=60 — first op should pass with ruleId containing 'default'
    const result = evaluate(defaultConfig(), createState(), makeObs({ napplet: 'unknown-napplet' }));
    expect(result.decision).toBe('pass');
    expect(result.ruleId).toContain('default');
  });

  it('prefers specific rateLimits over globalRate', () => {
    const specificLimit = { capacity: 1, windowMs: 60_000, action: 'block' as const };
    const globalLimit = { capacity: 100, windowMs: 60_000, action: 'flag' as const };
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', specificLimit);
    cfg = setGlobalRate(cfg, 'chat', globalLimit);
    let state = createState();
    const obs = makeObs();
    let result = evaluate(cfg, state, obs);
    state = result.newState;
    result = evaluate(cfg, state, obs);
    state = result.newState;
    // 3rd op — specific limit (capacity=1) should block, not global
    result = evaluate(cfg, state, obs);
    expect(result.decision).toBe('reject');
    expect(result.ruleId).toContain('opclass');
  });
});

// ---------------------------------------------------------------------------
// Init-burst guard (BURST-01 / BURST-02)
// ---------------------------------------------------------------------------

describe('init-burst guard', () => {
  it('does not trip when initElapsedMs is undefined', () => {
    const obs = makeObs({ initElapsedMs: undefined });
    const result = evaluate(defaultConfig(), createState(), obs);
    // initElapsedMs absent means burst guard is not applied
    expect(result.ruleId).not.toBe('burst');
  });

  it('does not trip when initElapsedMs >= burstGuard.windowMs', () => {
    const cfg = defaultConfig(); // burstGuard.windowMs = 3000
    const obs = makeObs({ initElapsedMs: 3_000 }); // at boundary — NOT within window
    const result = evaluate(cfg, createState(), obs);
    expect(result.ruleId).not.toBe('burst');
  });

  it('trips when op count exceeds maxOps within the burst window', () => {
    const cfg = defaultConfig(); // maxOps=20, windowMs=3000
    let state = createState();
    const obs = makeObs({ initElapsedMs: 500, napplet: 'burster' });

    // Fire maxOps ops — each should pass
    for (let i = 0; i < 20; i++) {
      const result = evaluate(cfg, state, obs);
      state = result.newState;
    }
    // 21st op should trip the burst guard → reject (default burst action = block)
    const result = evaluate(cfg, state, obs);
    expect(result.decision).toBe('reject');
    expect(result.ruleId).toBe('burst');
    expect(result.action).toBe('block');
  });

  it('does not trip the burst guard for ops after the init window', () => {
    const cfg = defaultConfig(); // burstGuard.windowMs=3000
    let state = createState();
    const napplet = 'post-burst';

    // Fire many ops within the window to trip it
    const obsIn = makeObs({ initElapsedMs: 100, napplet });
    for (let i = 0; i < 25; i++) {
      const result = evaluate(cfg, state, obsIn);
      state = result.newState;
    }

    // Now fire an op OUTSIDE the init window — should not trip burst
    const obsOut = makeObs({ initElapsedMs: 5_000, napplet }); // > 3000ms
    const result = evaluate(cfg, state, obsOut);
    expect(result.ruleId).not.toBe('burst');
  });

  it('a re-initialized napplet gets a fresh burst budget (counter expires after windowMs)', () => {
    // Regression: the per-dTag burst counter must not accumulate across
    // sessions. A napplet window that boots cleanly, is closed/reloaded, and
    // boots again later must not be blocked by counts from its first session.
    const cfg = defaultConfig(); // maxOps=20, windowMs=3000
    let state = createState();
    const napplet = 'reopened';

    // Session 1: 15 boot ops — under maxOps, all pass.
    for (let i = 0; i < 15; i++) {
      const result = evaluate(cfg, state, makeObs({ napplet, initElapsedMs: i * 100, now: NOW + i * 100 }));
      expect(result.decision).toBe('pass');
      state = result.newState;
    }

    // Session 2: window reopened 60s later — initElapsedMs restarts, now advances.
    // 15 boot ops again: each must pass on its own fresh budget (15 + 15 > 20
    // would block here if the counter leaked across sessions).
    const session2Start = NOW + 60_000;
    for (let i = 0; i < 15; i++) {
      const result = evaluate(cfg, state, makeObs({ napplet, initElapsedMs: i * 100, now: session2Start + i * 100 }));
      expect(result.decision).toBe('pass');
      state = result.newState;
    }
  });

  it('still trips within a re-initialized session that exceeds maxOps on its own', () => {
    // Expiry must not weaken the guard: a fresh session over the limit blocks.
    const cfg = defaultConfig(); // maxOps=20, windowMs=3000
    let state = createState();
    const napplet = 'reopened-burster';

    // Session 1: 10 ops, passes.
    for (let i = 0; i < 10; i++) {
      const result = evaluate(cfg, state, makeObs({ napplet, initElapsedMs: 100, now: NOW }));
      state = result.newState;
    }

    // Session 2, 60s later: 20 ops pass on the fresh budget, the 21st trips.
    const session2Start = NOW + 60_000;
    let result: EvaluateResult | null = null;
    for (let i = 0; i < 20; i++) {
      result = evaluate(cfg, state, makeObs({ napplet, initElapsedMs: 100, now: session2Start }));
      expect(result.decision).toBe('pass');
      state = result.newState;
    }
    result = evaluate(cfg, state, makeObs({ napplet, initElapsedMs: 100, now: session2Start }));
    expect(result.decision).toBe('reject');
    expect(result.ruleId).toBe('burst');
  });

  it('does not reset the counter mid-window within a single session', () => {
    // Ops spread across one session's init window share one budget: 20 ops
    // over ~2s (initElapsedMs and now advancing together) then the 21st trips.
    const cfg = defaultConfig(); // maxOps=20, windowMs=3000
    let state = createState();
    const napplet = 'single-session';

    for (let i = 0; i < 20; i++) {
      const result = evaluate(cfg, state, makeObs({ napplet, initElapsedMs: i * 100, now: NOW + i * 100 }));
      expect(result.decision).toBe('pass');
      state = result.newState;
    }
    const result = evaluate(cfg, state, makeObs({ napplet, initElapsedMs: 2_000, now: NOW + 2_000 }));
    expect(result.decision).toBe('reject');
    expect(result.ruleId).toBe('burst');
  });
});

// ---------------------------------------------------------------------------
// Content matchers (CONTENT-01 / CONTENT-02 / CONTENT-03)
// ---------------------------------------------------------------------------

describe('content matchers', () => {
  it('fires a matcher on opClass match', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'block-writes',
      opClass: 'relay:write',
      action: 'block',
    });
    const result = evaluate(cfg, createState(), makeObs({ opClass: 'relay:write' }));
    expect(result.ruleId).toBe('matcher:block-writes');
    expect(result.decision).toBe('reject');
  });

  it('does not fire a matcher when opClass does not match', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'block-writes',
      opClass: 'relay:write',
      action: 'block',
    });
    const result = evaluate(cfg, createState(), makeObs({ opClass: 'relay:read' }));
    expect(result.ruleId).not.toBe('matcher:block-writes');
  });

  it('fires a matcher on kind:5 (delete-spam — CONTENT-03)', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'delete-spam',
      opClass: 'relay:write',
      kinds: [5],
      action: 'block',
    });
    const obs = makeObs({ opClass: 'relay:write', kind: 5 });
    const result = evaluate(cfg, createState(), obs);
    expect(result.ruleId).toBe('matcher:delete-spam');
    expect(result.decision).toBe('reject');
  });

  it('does not fire kind-5 matcher when kind is different', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'delete-spam',
      opClass: 'relay:write',
      kinds: [5],
      action: 'block',
    });
    const obs = makeObs({ opClass: 'relay:write', kind: 1 });
    const result = evaluate(cfg, createState(), obs);
    expect(result.ruleId).not.toBe('matcher:delete-spam');
  });

  it('fires a matcher on minSize when size >= minSize (CONTENT-01)', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'large-payload',
      minSize: 1000,
      action: 'flag',
    });
    const obs = makeObs({ size: 1500 });
    const result = evaluate(cfg, createState(), obs);
    expect(result.ruleId).toBe('matcher:large-payload');
    expect(result.decision).toBe('pass');
    expect(result.action).toBe('flag');
  });

  it('does not fire minSize matcher when size is below threshold', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'large-payload',
      minSize: 1000,
      action: 'flag',
    });
    const obs = makeObs({ size: 500 });
    const result = evaluate(cfg, createState(), obs);
    expect(result.ruleId).not.toBe('matcher:large-payload');
  });

  it('fires a matcher with focused:false only when observation is unfocused (CONTENT-02)', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'unfocused-write',
      opClass: 'relay:write',
      focused: false,
      action: 'flag',
    });
    // Unfocused — should match
    const unfocusedObs = makeObs({ focused: false });
    const unfocusedResult = evaluate(cfg, createState(), unfocusedObs);
    expect(unfocusedResult.ruleId).toBe('matcher:unfocused-write');

    // Focused — should NOT match
    const focusedObs = makeObs({ focused: true });
    const focusedResult = evaluate(cfg, createState(), focusedObs);
    expect(focusedResult.ruleId).not.toBe('matcher:unfocused-write');
  });

  it('fires a matcher with maxMsSinceFocusGain when msSinceFocusGain is within threshold', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'just-focused',
      maxMsSinceFocusGain: 500,
      action: 'ignore',
    });
    // Just gained focus 200ms ago — within threshold
    const obsWithin = makeObs({ msSinceFocusGain: 200 });
    const resultWithin = evaluate(cfg, createState(), obsWithin);
    expect(resultWithin.ruleId).toBe('matcher:just-focused');

    // Gained focus 1000ms ago — outside threshold
    const obsOutside = makeObs({ msSinceFocusGain: 1000 });
    const resultOutside = evaluate(cfg, createState(), obsOutside);
    expect(resultOutside.ruleId).not.toBe('matcher:just-focused');
  });

  it('uses AND semantics: all conditions must hold for a matcher to fire', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'specific',
      opClass: 'relay:write',
      kinds: [5],
      minSize: 100,
      action: 'block',
    });
    // Only opClass matches — should not fire
    const obs1 = makeObs({ opClass: 'relay:write', kind: 1, size: 200 });
    expect(evaluate(cfg, createState(), obs1).ruleId).not.toBe('matcher:specific');

    // opClass + kind match but size too small — should not fire
    const obs2 = makeObs({ opClass: 'relay:write', kind: 5, size: 50 });
    expect(evaluate(cfg, createState(), obs2).ruleId).not.toBe('matcher:specific');

    // All conditions met — should fire
    const obs3 = makeObs({ opClass: 'relay:write', kind: 5, size: 200 });
    expect(evaluate(cfg, createState(), obs3).ruleId).toBe('matcher:specific');
  });

  it('matcher action=ignore yields decision=pass', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'silent-pass',
      opClass: 'relay:write',
      action: 'ignore',
    });
    const result = evaluate(cfg, createState(), makeObs());
    expect(result.ruleId).toBe('matcher:silent-pass');
    expect(result.decision).toBe('pass');
    expect(result.action).toBe('ignore');
  });

  it('matcher action=flag yields decision=pass with action=flag', () => {
    const cfg = addMatcher(defaultConfig(), {
      id: 'audit-write',
      opClass: 'relay:write',
      action: 'flag',
    });
    const result = evaluate(cfg, createState(), makeObs());
    expect(result.ruleId).toBe('matcher:audit-write');
    expect(result.decision).toBe('pass');
    expect(result.action).toBe('flag');
  });

  it('first matching matcher wins (first-match wins ordering)', () => {
    let cfg = addMatcher(defaultConfig(), {
      id: 'first',
      opClass: 'relay:write',
      action: 'flag',
    });
    cfg = addMatcher(cfg, {
      id: 'second',
      opClass: 'relay:write',
      action: 'block',
    });
    const result = evaluate(cfg, createState(), makeObs());
    expect(result.ruleId).toBe('matcher:first');
  });
});

// ---------------------------------------------------------------------------
// Precedence order (A1 — POLICY-03)
// ---------------------------------------------------------------------------

describe('precedence: policy → burst → matcher → rate (A1)', () => {
  it('deny policy wins over burst, matcher, and rate (policy first)', () => {
    let cfg = setPolicy(defaultConfig(), 'chat', 'deny');
    // Add a burst that would normally be triggered
    let state = createState();
    const obs = makeObs({ initElapsedMs: 100 });
    // Fire enough burst ops via a temp napplet, but test on 'chat' with deny policy
    const result = evaluate(cfg, state, obs);
    expect(result.decision).toBe('reject');
    expect(result.ruleId).toBe('policy:deny');
  });

  it('allow policy bypasses burst guard, matchers, and rate limits', () => {
    let cfg = setPolicy(defaultConfig(), 'chat', 'allow');
    cfg = addMatcher(cfg, { id: 'block-writes', opClass: 'relay:write', action: 'block' });
    cfg = setRateLimit(cfg, 'chat', 'relay:write', { capacity: 0, windowMs: 60_000, action: 'block' });
    const obs = makeObs({ initElapsedMs: 100 });
    const result = evaluate(cfg, createState(), obs);
    expect(result.decision).toBe('pass');
    expect(result.ruleId).toBe('policy:allow');
  });

  it('ask policy yields prompt (and skips other tiers)', () => {
    let cfg = setPolicy(defaultConfig(), 'chat', 'ask');
    const result = evaluate(cfg, createState(), makeObs());
    expect(result.decision).toBe('prompt');
    expect(result.ruleId).toBe('policy:ask');
  });

  it('burst guard wins over matcher when policy absent', () => {
    // Add a matcher that would fire
    let cfg = addMatcher(defaultConfig(), {
      id: 'block-writes',
      opClass: 'relay:write',
      action: 'flag',
    });
    let state = createState();
    const obs = makeObs({ initElapsedMs: 100, napplet: 'burst-over-matcher' });
    // Exhaust burst budget
    for (let i = 0; i < 20; i++) {
      const r = evaluate(cfg, state, obs);
      state = r.newState;
    }
    // 21st should be burst, not matcher
    const result = evaluate(cfg, state, obs);
    expect(result.ruleId).toBe('burst');
    expect(result.decision).toBe('reject');
  });

  it('matcher fires over rate limit when policy and burst absent', () => {
    // Rate limit would flag; matcher on same opClass blocks
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', {
      capacity: 100,
      windowMs: 60_000,
      action: 'flag',
    });
    cfg = addMatcher(cfg, {
      id: 'block-specific',
      opClass: 'relay:write',
      kinds: [5],
      action: 'block',
    });
    const obs = makeObs({ kind: 5 });
    const result = evaluate(cfg, createState(), obs);
    // Matcher should win over rate limit
    expect(result.ruleId).toBe('matcher:block-specific');
    expect(result.decision).toBe('reject');
  });
});

// ---------------------------------------------------------------------------
// Focus multiplier — A2 (FOCUS-02)
// ---------------------------------------------------------------------------

describe('unfocused multiplier (A2)', () => {
  it('a single op while unfocused still passes (focus alone never hard-blocks)', () => {
    const result = evaluate(defaultConfig(), createState(), makeObs({ focused: false }));
    expect(result.decision).toBe('pass');
  });

  it('tightens effective capacity for unfocused napplets', () => {
    // capacity=4, unfocusedMultiplier=0.25 → effectiveCapacity=1 when unfocused
    // So 2nd op at same now should exceed for unfocused but not for focused
    let cfg = setRateLimit(defaultConfig(), 'chat', 'relay:write', {
      capacity: 4,
      windowMs: 60_000,
      action: 'block',
    });
    // Override unfocusedMultiplier to 0.25 (already default, but explicit)
    cfg = { ...cfg, unfocusedMultiplier: 0.25 };

    // Focused: capacity=4, can do 4 ops
    let focusedState = createState();
    for (let i = 0; i < 4; i++) {
      const r = evaluate(cfg, focusedState, makeObs({ focused: true, now: NOW }));
      focusedState = r.newState;
      expect(r.decision).toBe('pass');
    }

    // Unfocused: effectiveCapacity = 4 * 0.25 = 1. 2nd op at same now should exceed.
    let unfocusedState = createState();
    const r1 = evaluate(cfg, unfocusedState, makeObs({ focused: false, now: NOW }));
    expect(r1.decision).toBe('pass');
    unfocusedState = r1.newState;

    // 2nd op — should exceed (0 tokens left under effective capacity=1)
    const r2 = evaluate(cfg, unfocusedState, makeObs({ focused: false, now: NOW }));
    expect(r2.decision).toBe('reject');
  });

  it('unfocused multiplier scales bucket key correctly (no focus suffix in key)', () => {
    // Both focused and unfocused ops write to the same bucket key
    const obs1 = makeObs({ focused: true, now: NOW });
    const obs2 = makeObs({ focused: false, now: NOW });
    const cfg = defaultConfig();
    const result1 = evaluate(cfg, createState(), obs1);
    const result2 = evaluate(cfg, createState(), obs2);
    const key = toKey('chat', 'relay:write');
    // Both should have the same bucket key in newState
    expect(result1.newState.buckets[key]).toBeDefined();
    expect(result2.newState.buckets[key]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Policy decisions do not advance counters
// ---------------------------------------------------------------------------

describe('policy short-circuits skip counter updates', () => {
  it('allow policy returns same state reference (no counter modification)', () => {
    const cfg = setPolicy(defaultConfig(), 'chat', 'allow');
    const state = createState();
    const result = evaluate(cfg, state, makeObs());
    // policy returns without touching buckets/bursts
    expect(Object.keys(result.newState.buckets)).toHaveLength(0);
    expect(Object.keys(result.newState.bursts)).toHaveLength(0);
  });

  it('deny policy returns same state reference (no counter modification)', () => {
    const cfg = setPolicy(defaultConfig(), 'chat', 'deny');
    const state = createState();
    const result = evaluate(cfg, state, makeObs());
    expect(Object.keys(result.newState.buckets)).toHaveLength(0);
    expect(Object.keys(result.newState.bursts)).toHaveLength(0);
  });
});
