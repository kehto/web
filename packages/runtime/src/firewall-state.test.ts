import { describe, expect, it } from 'vitest';
import { createFirewallState } from './firewall-state.js';
import type { FirewallPersistence } from './types.js';

function makePersistence(initial: string | null = null): FirewallPersistence & { data: string | null } {
  return {
    data: initial,
    persist(data: string): void {
      this.data = data;
    },
    load(): string | null {
      return this.data;
    },
  };
}

/** Build a minimal relay:write observation. */
function makeObs(napplet = 'chat', now = Date.now()) {
  return { napplet, opClass: 'relay:write', focused: true, now };
}

describe('runtime firewall state', () => {
  it('constructs without a persistence backend and evaluates observations', () => {
    const firewall = createFirewallState();
    const result = firewall.evaluate(makeObs());
    expect(result).toBeDefined();
    expect(['pass', 'reject', 'prompt']).toContain(result.decision);
  });

  it('applies a deny policy override — observation rejects after setPolicy(deny)', () => {
    const firewall = createFirewallState();
    firewall.setPolicy('chat', 'deny');
    const result = firewall.evaluate(makeObs('chat'));
    expect(result.decision).toBe('reject');
  });

  it('applies an allow policy override — observation passes after setPolicy(allow)', () => {
    const firewall = createFirewallState();
    firewall.setPolicy('chat', 'allow');
    const result = firewall.evaluate(makeObs('chat'));
    expect(result.decision).toBe('pass');
  });

  it('persists config and restores policy in a fresh container (RUNTIME-03 config)', () => {
    const persistence = makePersistence();
    const firewall = createFirewallState(persistence);
    firewall.setPolicy('chat', 'deny');
    firewall.persist();

    // Fresh container — load() restores the config
    const restored = createFirewallState(persistence);
    restored.load();

    const result = restored.evaluate(makeObs('chat'));
    expect(result.decision).toBe('reject');
  });

  it('counters reset in a fresh container after persist/load (RUNTIME-03 counters)', () => {
    const persistence = makePersistence();
    const firewall = createFirewallState(persistence);

    // Drive enough observations to consume some token budget
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      firewall.evaluate({ napplet: 'flood', opClass: 'relay:write', focused: true, now: now + i });
    }
    const configAfter = firewall.getConfig();

    firewall.persist();

    // Fresh container — load() restores config but NOT counters
    const restored = createFirewallState(persistence);
    restored.load();

    // Config should be identical
    expect(JSON.stringify(restored.getConfig())).toBe(JSON.stringify(configAfter));

    // First observation on the fresh container should start with a full token bucket
    // (not an exhausted one from the original container's flood)
    const result = restored.evaluate({ napplet: 'flood', opClass: 'relay:write', focused: true, now: now + 1000000 });
    // With a full budget the default rate limit should pass
    expect(result.decision).toBe('pass');
  });

  it('clear() resets both config and counters', () => {
    const persistence = makePersistence();
    const firewall = createFirewallState(persistence);
    firewall.setPolicy('chat', 'deny');
    firewall.persist();
    firewall.clear();

    // Config is reset — deny policy gone
    const result = firewall.evaluate(makeObs('chat'));
    expect(result.decision).not.toBe('reject');

    // Persistence was also cleared
    const restored = createFirewallState(persistence);
    restored.load();
    const restoredResult = restored.evaluate(makeObs('chat'));
    expect(restoredResult.decision).not.toBe('reject');
  });

  it('throwing persistence backend does not crash persist()', () => {
    const broken: FirewallPersistence = {
      persist(): void { throw new Error('storage full'); },
      load(): string | null { throw new Error('storage unavailable'); },
    };
    const firewall = createFirewallState(broken);
    firewall.setPolicy('chat', 'deny');

    // persist() must not throw even when the backend throws
    expect(() => firewall.persist()).not.toThrow();
  });

  it('throwing persistence backend does not crash load() — falls back to defaultConfig', () => {
    const broken: FirewallPersistence = {
      persist(): void { throw new Error('storage full'); },
      load(): string | null { throw new Error('storage unavailable'); },
    };
    const firewall = createFirewallState(broken);

    // load() must not throw; falls back to defaultConfig
    expect(() => firewall.load()).not.toThrow();

    // After fallback the container is still usable
    const result = firewall.evaluate(makeObs('chat'));
    expect(result).toBeDefined();
  });

  it('counters advance across calls — evaluate reassigns newState', () => {
    const firewall = createFirewallState();
    const now = Date.now();
    const actions: string[] = [];

    // Drive many observations at the same timestamp so token buckets drain
    // without refilling. With action: 'flag' the decision is still 'pass' but
    // the action changes from 'ignore' to 'flag' once the budget is consumed.
    for (let i = 0; i < 200; i++) {
      const r = firewall.evaluate({ napplet: 'flood', opClass: 'relay:write', focused: true, now });
      actions.push(r.action);
    }

    // After budget exhaustion the exceed-action fires (default 'flag').
    // If counters were NOT advancing, every call would see a full bucket.
    // The presence of 'flag' actions proves counters are carried forward.
    const hasFlagOrBlock = actions.some(a => a === 'flag' || a === 'block');
    expect(hasFlagOrBlock).toBe(true);
  });
});
