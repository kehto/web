import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extensionToggleEnabled,
  playgroundExtensionTestHooksEnabled,
  sanitizeStoredExtensionState,
} from '../../apps/playground/src/playground-extensions.js';

// Regressions for review findings IN-03, IN-04 and IN-05 (quick task 261031-k14).
// The x- naming is a Kehto spec-gap policy bounded by napplet/naps master 43cb3a4.

describe('playground extension localStorage (IN-03)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('keeps only string values, string d tags and string disabled domains (IN-03)', () => {
    expect(sanitizeStoredExtensionState({
      values: { 'x-echo': { prefix: 'ok', n: 5, o: {} }, 'x-bad': 'abc' },
      disabled: 'x-echo-other',
      deniedFor: { 'x-echo': ['chat', 7, null], 'x-two': 'chat' },
    })).toEqual({ values: { 'x-echo': { prefix: 'ok' } }, disabled: [], deniedFor: { 'x-echo': ['chat'] } });
    for (const value of [null, [], 'x', 3]) {
      const state = sanitizeStoredExtensionState(value);
      expect(state.values ?? {}).toEqual({});
      expect(state.disabled ?? []).toEqual([]);
      expect(state.deniedFor ?? {}).toEqual({});
    }
    expect(sanitizeStoredExtensionState({ disabled: ['x-echo', 4, null, 'x-two'] }).disabled).toEqual(['x-echo', 'x-two']);
  });

  it('ignores corrupt stored state at module load (IN-03)', async () => {
    const raw = JSON.stringify({ values: { 'x-echo': { prefix: 5 } }, disabled: 'x-echo-other' });
    vi.stubGlobal('localStorage', { getItem: () => raw, setItem: () => {}, removeItem: () => {} });
    vi.resetModules();
    const module = await import('../../apps/playground/src/playground-extensions.js');
    expect(module.getPlaygroundExtensions()[0]?.state?.()).toBe('unconfigured');
    expect(module.getDisabledPlaygroundExtensionDomains()).toEqual([]);
  });
});

describe('playground x- ACL toggles (IN-04)', () => {
  it('reads x- toggles from explicit decisions, else the default policy (IN-04)', () => {
    const neverCalled = vi.fn(() => true);
    expect(extensionToggleEnabled({ 'x-echo:send': false }, 'x-echo:send', neverCalled)).toBe(false);
    const deny = vi.fn(() => false);
    expect(extensionToggleEnabled({ 'x-echo:send': true }, 'x-echo:send', deny)).toBe(true);
    expect(neverCalled).not.toHaveBeenCalled();
    expect(deny).not.toHaveBeenCalled();
    const restrictiveDefault = vi.fn(() => false);
    expect(extensionToggleEnabled({}, 'x-echo:send', restrictiveDefault)).toBe(false);
    expect(extensionToggleEnabled(undefined, 'x-echo:send', restrictiveDefault)).toBe(false);
    expect(extensionToggleEnabled({ 'x-echo:ping': false }, 'x-echo:send', () => true)).toBe(true);
    expect(extensionToggleEnabled({}, 'constructor', () => false)).toBe(false);
    expect(restrictiveDefault).toHaveBeenCalledTimes(2);
  });
});

describe('playground extension test hook (IN-05)', () => {
  it('enables the extension test hook only in dev or with ?kehto-test (IN-05)', () => {
    expect(playgroundExtensionTestHooksEnabled('', false)).toBe(false);
    expect(playgroundExtensionTestHooksEnabled('?kehto-test', false)).toBe(true);
    expect(playgroundExtensionTestHooksEnabled('?a=1&kehto-test=1', false)).toBe(true);
    expect(playgroundExtensionTestHooksEnabled('', true)).toBe(true);
    expect(playgroundExtensionTestHooksEnabled('?kehto-testing', false)).toBe(false);
    expect(playgroundExtensionTestHooksEnabled('?x=kehto-test', false)).toBe(false);
  });
});
