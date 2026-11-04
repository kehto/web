import { describe, expect, it } from 'vitest';
import { createState, defaultConfig, deserialize, evaluate, serialize, setBurstGuard, setUnfocusedMultiplier } from './index.js';
import type { BurstGuard, FirewallConfig } from './index.js';

const guard: BurstGuard = { windowMs: 5000, maxOps: 2, action: 'block' };

/** Count how many unfocused ops pass with a budget of 8 and no refill between them. */
function unfocusedPasses(config: FirewallConfig): number {
  let state = createState();
  let passes = 0;
  for (let i = 0; i < 20; i += 1) {
    const result = evaluate(config, state, { napplet: 'chat', opClass: 'relay:write', focused: false, now: 1_000 });
    state = result.newState;
    if (result.decision === 'pass') passes += 1;
  }
  return passes;
}

function withBudget(multiplier: number): FirewallConfig {
  return setUnfocusedMultiplier(
    { ...defaultConfig(), defaultRate: { capacity: 8, windowMs: 60_000, action: 'block' } },
    multiplier,
  );
}

describe('setUnfocusedMultiplier (#400)', () => {
  it('scales the unfocused budget both ways', () => {
    expect(unfocusedPasses(withBudget(0.5))).toBe(4);
    expect(unfocusedPasses(withBudget(2))).toBe(16);
  });

  it('leaves the original config alone', () => {
    const config = defaultConfig();
    const next = setUnfocusedMultiplier(config, 0.5);
    expect(next.unfocusedMultiplier).toBe(0.5);
    expect(config.unfocusedMultiplier).toBe(defaultConfig().unfocusedMultiplier);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('refuses %s', (value) => {
    expect(() => setUnfocusedMultiplier(defaultConfig(), value)).toThrow(RangeError);
  });

  it('survives a serialize round trip', () => {
    const config = setUnfocusedMultiplier(defaultConfig(), 0.5);
    expect(deserialize(serialize(config)).unfocusedMultiplier).toBe(0.5);
  });
});

describe('setBurstGuard (#400)', () => {
  function decisions(config: FirewallConfig, count: number): string[] {
    let state = createState();
    const seen: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const result = evaluate(config, state, {
        napplet: 'chat', opClass: 'relay:write', focused: true, now: 1_000, initElapsedMs: 0, initKey: 'w',
      });
      state = result.newState;
      seen.push(result.ruleId);
    }
    return seen;
  }

  it('applies the new limit to startup operations', () => {
    expect(decisions(setBurstGuard(defaultConfig(), guard), 3)[2]).toBe('burst');
  });

  it('turns the guard off with a zero window', () => {
    const config = setBurstGuard(defaultConfig(), { ...guard, windowMs: 0, maxOps: 0 });
    expect(decisions(config, 3)).not.toContain('burst');
  });

  it('copies the guard rather than keeping the caller object', () => {
    const input = { ...guard };
    const config = setBurstGuard(defaultConfig(), input);
    input.maxOps = 99;
    expect(config.burstGuard.maxOps).toBe(2);
  });

  it.each([
    ['a negative window', { ...guard, windowMs: -1 }],
    ['a non-finite window', { ...guard, windowMs: Number.POSITIVE_INFINITY }],
    ['a negative limit', { ...guard, maxOps: -1 }],
    ['a fractional limit', { ...guard, maxOps: 1.5 }],
    ['an unknown action', { ...guard, action: 'drop' as BurstGuard['action'] }],
  ])('refuses %s', (_label, bad) => {
    expect(() => setBurstGuard(defaultConfig(), bad)).toThrow(RangeError);
  });

  it('survives a serialize round trip', () => {
    expect(deserialize(serialize(setBurstGuard(defaultConfig(), guard))).burstGuard).toEqual(guard);
  });
});
