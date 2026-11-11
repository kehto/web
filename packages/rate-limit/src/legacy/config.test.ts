import { describe, it, expect } from 'vitest';
import {
  setPolicy,
  setRateLimit,
  setGlobalRate,
  addMatcher,
  serialize,
  deserialize,
} from './config.js';
import { defaultConfig } from './defaults.js';
import type { FirewallConfig, RateLimit, ContentMatcher } from './types.js';

// Shared fixtures
const baseConfig: FirewallConfig = defaultConfig();

const testLimit: RateLimit = { capacity: 10, windowMs: 5_000, action: 'block' };
const testLimit2: RateLimit = { capacity: 30, windowMs: 30_000, action: 'flag' };

const testMatcher: ContentMatcher = {
  id: 'delete-spam',
  opClass: 'relay:write',
  kinds: [5],
  action: 'block',
};

describe('setPolicy', () => {
  it('returns a new config with napplets[napplet].policy set', () => {
    const cfg2 = setPolicy(baseConfig, 'chat', 'deny');
    expect(cfg2.napplets['chat'].policy).toBe('deny');
  });

  it('does not modify original config (immutability)', () => {
    setPolicy(baseConfig, 'chat', 'deny');
    expect(baseConfig.napplets['chat']).toBeUndefined();
  });

  it('preserves existing rateLimits when setting policy on new napplet', () => {
    const cfg2 = setPolicy(baseConfig, 'feed', 'allow');
    expect(cfg2.napplets['feed'].rateLimits).toEqual({});
  });

  it('preserves existing rateLimits when updating policy on existing napplet', () => {
    const cfg2 = setRateLimit(baseConfig, 'chat', 'relay:write', testLimit);
    const cfg3 = setPolicy(cfg2, 'chat', 'ask');
    expect(cfg3.napplets['chat'].rateLimits['relay:write']).toEqual(testLimit);
    expect(cfg3.napplets['chat'].policy).toBe('ask');
  });

  it('returns a new object reference (not the same as input)', () => {
    const cfg2 = setPolicy(baseConfig, 'chat', 'allow');
    expect(cfg2).not.toBe(baseConfig);
  });
});

describe('setRateLimit', () => {
  it('returns a new config with napplets[napplet].rateLimits[opClass] set', () => {
    const cfg2 = setRateLimit(baseConfig, 'chat', 'relay:write', testLimit);
    expect(cfg2.napplets['chat'].rateLimits['relay:write']).toEqual(testLimit);
  });

  it('does not modify original config (immutability)', () => {
    setRateLimit(baseConfig, 'chat', 'relay:write', testLimit);
    expect(baseConfig.napplets['chat']).toBeUndefined();
  });

  it('preserves other rateLimits on the same napplet', () => {
    const cfg2 = setRateLimit(baseConfig, 'chat', 'relay:write', testLimit);
    const cfg3 = setRateLimit(cfg2, 'chat', 'outbox:write', testLimit2);
    expect(cfg3.napplets['chat'].rateLimits['relay:write']).toEqual(testLimit);
    expect(cfg3.napplets['chat'].rateLimits['outbox:write']).toEqual(testLimit2);
  });

  it('does not affect other napplets', () => {
    const cfg2 = setRateLimit(baseConfig, 'chat', 'relay:write', testLimit);
    expect(cfg2.napplets['feed']).toBeUndefined();
  });

  it('returns a new object reference', () => {
    const cfg2 = setRateLimit(baseConfig, 'chat', 'relay:write', testLimit);
    expect(cfg2).not.toBe(baseConfig);
  });
});

describe('setGlobalRate', () => {
  it('returns a new config with napplets[napplet].globalRate set (RATE-03)', () => {
    const cfg2 = setGlobalRate(baseConfig, 'chat', testLimit2);
    expect(cfg2.napplets['chat'].globalRate).toEqual(testLimit2);
  });

  it('does not modify original config (immutability)', () => {
    setGlobalRate(baseConfig, 'chat', testLimit2);
    expect(baseConfig.napplets['chat']).toBeUndefined();
  });

  it('preserves existing rateLimits when setting globalRate', () => {
    const cfg2 = setRateLimit(baseConfig, 'chat', 'relay:write', testLimit);
    const cfg3 = setGlobalRate(cfg2, 'chat', testLimit2);
    expect(cfg3.napplets['chat'].rateLimits['relay:write']).toEqual(testLimit);
    expect(cfg3.napplets['chat'].globalRate).toEqual(testLimit2);
  });

  it('returns a new object reference', () => {
    const cfg2 = setGlobalRate(baseConfig, 'chat', testLimit);
    expect(cfg2).not.toBe(baseConfig);
  });
});

describe('addMatcher', () => {
  it('returns a new config with the matcher appended to matchers', () => {
    const cfg2 = addMatcher(baseConfig, testMatcher);
    expect(cfg2.matchers).toHaveLength(1);
    expect(cfg2.matchers[0]).toEqual(testMatcher);
  });

  it('does not modify the original config matchers array (immutability)', () => {
    addMatcher(baseConfig, testMatcher);
    expect(baseConfig.matchers).toHaveLength(0);
  });

  it('appends matchers in order', () => {
    const matcher2: ContentMatcher = { id: 'large-payload', minSize: 64_000, action: 'flag' };
    const cfg2 = addMatcher(baseConfig, testMatcher);
    const cfg3 = addMatcher(cfg2, matcher2);
    expect(cfg3.matchers).toHaveLength(2);
    expect(cfg3.matchers[0]).toEqual(testMatcher);
    expect(cfg3.matchers[1]).toEqual(matcher2);
  });

  it('preserves all other config fields', () => {
    const cfg2 = addMatcher(baseConfig, testMatcher);
    expect(cfg2.napplets).toEqual(baseConfig.napplets);
    expect(cfg2.burstGuard).toEqual(baseConfig.burstGuard);
    expect(cfg2.defaultRate).toEqual(baseConfig.defaultRate);
    expect(cfg2.unfocusedMultiplier).toBe(baseConfig.unfocusedMultiplier);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips a default config losslessly (CORE-03)', () => {
    const json = serialize(baseConfig);
    const restored = deserialize(json);
    expect(restored).toEqual(baseConfig);
  });

  it('round-trips a config with policy + op-class rate limit + globalRate + kind-5 matcher (CORE-03)', () => {
    const cfg = addMatcher(
      setGlobalRate(
        setRateLimit(
          setPolicy(baseConfig, 'chat', 'deny'),
          'chat',
          'relay:write',
          testLimit,
        ),
        'chat',
        testLimit2,
      ),
      testMatcher,
    );
    const restored = deserialize(serialize(cfg));
    expect(restored).toEqual(cfg);
    expect(restored.napplets['chat'].policy).toBe('deny');
    expect(restored.napplets['chat'].rateLimits['relay:write']).toEqual(testLimit);
    expect(restored.napplets['chat'].globalRate).toEqual(testLimit2);
    expect(restored.matchers[0]).toEqual(testMatcher);
  });

  it('serialize produces a parseable JSON string', () => {
    const json = serialize(baseConfig);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('deserialize("not-json") returns defaultConfig() (T-80-01 poisoned input)', () => {
    const fallback = deserialize('not-json');
    expect(fallback).toEqual(defaultConfig());
  });

  it('deserialize("") returns defaultConfig()', () => {
    const fallback = deserialize('');
    expect(fallback).toEqual(defaultConfig());
  });

  it('deserialize of structurally-wrong-but-valid JSON returns defaultConfig() (T-80-01)', () => {
    // Valid JSON but missing required fields (no burstGuard, no defaultRate)
    const bad = JSON.stringify({ napplets: {}, matchers: [] });
    const fallback = deserialize(bad);
    expect(fallback).toEqual(defaultConfig());
  });

  it('deserialize of JSON with wrong field types returns defaultConfig() (T-80-01)', () => {
    // burstGuard present but windowMs is a string — should fail shape validation
    const bad = JSON.stringify({
      napplets: {},
      matchers: [],
      burstGuard: { windowMs: 'bad', maxOps: 20, action: 'block' },
      defaultRate: { capacity: 60, windowMs: 60_000, action: 'flag' },
      unfocusedMultiplier: 0.25,
    });
    const fallback = deserialize(bad);
    expect(fallback).toEqual(defaultConfig());
  });

  it('deserialize of JSON with invalid action value returns defaultConfig() (T-80-01)', () => {
    const bad = JSON.stringify({
      napplets: {},
      matchers: [],
      burstGuard: { windowMs: 3_000, maxOps: 20, action: 'invalid' },
      defaultRate: { capacity: 60, windowMs: 60_000, action: 'flag' },
      unfocusedMultiplier: 0.25,
    });
    const fallback = deserialize(bad);
    expect(fallback).toEqual(defaultConfig());
  });

  it('deserialize never throws', () => {
    expect(() => deserialize('not-json')).not.toThrow();
    expect(() => deserialize('')).not.toThrow();
    expect(() => deserialize('{}')).not.toThrow();
    expect(() => deserialize('null')).not.toThrow();
    expect(() => deserialize('[]')).not.toThrow();
  });
});
