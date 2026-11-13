import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EXCEED_ACTION,
  DEFAULT_BURST_ACTION,
  DEFAULT_UNFOCUSED_MULTIPLIER,
  DEFAULT_RATE_CAPACITY,
  DEFAULT_RATE_WINDOW_MS,
  DEFAULT_BURST_WINDOW_MS,
  DEFAULT_BURST_MAX_OPS,
  defaultConfig,
  createState,
} from './defaults.js';

describe('DEFAULT constants', () => {
  it('DEFAULT_EXCEED_ACTION is flag (CORE-04 — conservative allow+audit default)', () => {
    expect(DEFAULT_EXCEED_ACTION).toBe('flag');
  });

  it('DEFAULT_BURST_ACTION is block (BURST-02 — documented exception)', () => {
    expect(DEFAULT_BURST_ACTION).toBe('block');
  });

  it('DEFAULT_UNFOCUSED_MULTIPLIER is strictly between 0 and 1 (FOCUS-02 — never zeroes budget)', () => {
    expect(DEFAULT_UNFOCUSED_MULTIPLIER).toBeGreaterThan(0);
    expect(DEFAULT_UNFOCUSED_MULTIPLIER).toBeLessThan(1);
  });

  it('DEFAULT_RATE_CAPACITY is a positive finite number', () => {
    expect(typeof DEFAULT_RATE_CAPACITY).toBe('number');
    expect(DEFAULT_RATE_CAPACITY).toBeGreaterThan(0);
    expect(isFinite(DEFAULT_RATE_CAPACITY)).toBe(true);
  });

  it('DEFAULT_RATE_WINDOW_MS is a positive finite number', () => {
    expect(typeof DEFAULT_RATE_WINDOW_MS).toBe('number');
    expect(DEFAULT_RATE_WINDOW_MS).toBeGreaterThan(0);
    expect(isFinite(DEFAULT_RATE_WINDOW_MS)).toBe(true);
  });

  it('DEFAULT_BURST_WINDOW_MS is a positive finite number', () => {
    expect(typeof DEFAULT_BURST_WINDOW_MS).toBe('number');
    expect(DEFAULT_BURST_WINDOW_MS).toBeGreaterThan(0);
    expect(isFinite(DEFAULT_BURST_WINDOW_MS)).toBe(true);
  });

  it('DEFAULT_BURST_MAX_OPS is a positive finite number', () => {
    expect(typeof DEFAULT_BURST_MAX_OPS).toBe('number');
    expect(DEFAULT_BURST_MAX_OPS).toBeGreaterThan(0);
    expect(isFinite(DEFAULT_BURST_MAX_OPS)).toBe(true);
  });
});

describe('defaultConfig', () => {
  it('returns a FirewallConfig with defaultRate.action === flag (CORE-04)', () => {
    const cfg = defaultConfig();
    expect(cfg.defaultRate.action).toBe('flag');
  });

  it('returns a FirewallConfig with burstGuard.action === block (BURST-02)', () => {
    const cfg = defaultConfig();
    expect(cfg.burstGuard.action).toBe('block');
  });

  it('returns a FirewallConfig with unfocusedMultiplier strictly between 0 and 1 (FOCUS-02)', () => {
    const cfg = defaultConfig();
    expect(cfg.unfocusedMultiplier).toBeGreaterThan(0);
    expect(cfg.unfocusedMultiplier).toBeLessThan(1);
  });

  it('returns a FirewallConfig with positive finite defaultRate.capacity (CORE-04)', () => {
    const cfg = defaultConfig();
    expect(cfg.defaultRate.capacity).toBeGreaterThan(0);
    expect(isFinite(cfg.defaultRate.capacity)).toBe(true);
  });

  it('returns a FirewallConfig with positive finite defaultRate.windowMs (CORE-04)', () => {
    const cfg = defaultConfig();
    expect(cfg.defaultRate.windowMs).toBeGreaterThan(0);
    expect(isFinite(cfg.defaultRate.windowMs)).toBe(true);
  });

  it('returns a FirewallConfig with empty napplets map', () => {
    const cfg = defaultConfig();
    expect(cfg.napplets).toEqual({});
  });

  it('returns a FirewallConfig with empty matchers array', () => {
    const cfg = defaultConfig();
    expect(cfg.matchers).toEqual([]);
  });

  it('returns a new object on each call (not the same reference)', () => {
    const cfg1 = defaultConfig();
    const cfg2 = defaultConfig();
    expect(cfg1).not.toBe(cfg2);
  });
});

describe('createState', () => {
  it('returns { buckets: {}, bursts: {} } with both maps empty', () => {
    const state = createState();
    expect(state.buckets).toEqual({});
    expect(state.bursts).toEqual({});
  });

  it('returns a new object on each call (not the same reference)', () => {
    const s1 = createState();
    const s2 = createState();
    expect(s1).not.toBe(s2);
  });
});
