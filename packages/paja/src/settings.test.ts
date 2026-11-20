import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PAJA_SETTING_DEFINITIONS,
  findPajaSettingDefinition,
  getActivePajaSettings,
  getPajaSetting,
  getPajaSettingDefault,
  normalizePajaSettings,
  setActivePajaSettings,
  type PajaSettingKey,
} from './settings.js';

afterEach(() => setActivePajaSettings({}));

describe('Paja settings registry', () => {
  it('registers unique keys whose shipped defaults sit inside their bounds', () => {
    const keys = PAJA_SETTING_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const definition of PAJA_SETTING_DEFINITIONS) {
      expect(definition.min, definition.key).toBeLessThanOrEqual(definition.defaultValue);
      expect(definition.defaultValue, definition.key).toBeLessThanOrEqual(definition.max);
      if (definition.unit !== 'ratio') expect(Number.isInteger(definition.defaultValue), definition.key).toBe(true);
    }
  });

  it('keeps the values Paja shipped with as defaults', () => {
    expect(getPajaSettingDefault('relay.liveQueryWaitMs')).toBe(4000);
    expect(getPajaSettingDefault('resource.maxBytes')).toBe(10 * 1024 * 1024);
    expect(getPajaSettingDefault('fs.maxWatchCount')).toBe(16);
    expect(getPajaSettingDefault('webrtc.iceGatherTimeoutMs')).toBe(8000);
    expect(getPajaSettingDefault('vault.pbkdf2Iterations')).toBe(600_000);
    expect(getPajaSettingDefault('gamepad.axisDeadzone')).toBe(0.12);
  });

  it('only lets security floors be raised', () => {
    for (const key of ['vault.minPasswordLength', 'vault.minDistinctChars', 'vault.pbkdf2Iterations', 'webrtc.roomMinChars'] as const) {
      const definition = findPajaSettingDefinition(key)!;
      expect(definition.min, key).toBe(definition.defaultValue);
    }
  });

  it('never allows a byte, count or length guard to be switched off', () => {
    for (const definition of PAJA_SETTING_DEFINITIONS) {
      if (definition.key.includes('max') && ['bytes', 'chars'].includes(definition.unit)) {
        expect(definition.min, definition.key).toBeGreaterThan(0);
      }
      expect(Number.isFinite(definition.max), definition.key).toBe(true);
    }
  });
});

describe('Paja settings documentation', () => {
  it.each(['../README.md', '../../../docs/packages/paja.md'])('lists every registered key with its default in %s', (path) => {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const definition of PAJA_SETTING_DEFINITIONS) {
      expect(text, definition.key).toMatch(new RegExp(`\\| \`${definition.key.replaceAll('.', '\\.')}\` \\| [^|]+ \\| ${String(definition.defaultValue)}\\b`, 'u'));
    }
  });
});

describe('normalizePajaSettings', () => {
  it('drops unknown keys, wrong types, fractions and out-of-range values instead of clamping', () => {
    const result = normalizePajaSettings({
      'fs.maxWatchCount': 32,
      'fs.maxReadBytes': 0,
      'relay.liveQueryWaitMs': '4000',
      'webrtc.maxPeers': 2.5,
      'gamepad.axisDeadzone': 0.3,
      'nope.missing': 1,
      'resource.maxBytes': Number.POSITIVE_INFINITY,
    });
    expect(result.values).toEqual({ 'fs.maxWatchCount': 32, 'gamepad.axisDeadzone': 0.3 });
    expect(result.rejected).toEqual([
      'fs.maxReadBytes: Use a value from 1 to 268435456.',
      'relay.liveQueryWaitMs: Enter a number.',
      'webrtc.maxPeers: Enter a whole number.',
      'nope.missing: unknown setting',
      'resource.maxBytes: Enter a number.',
    ]);
  });

  it('filters by consuming process and rejects non-objects', () => {
    expect(normalizePajaSettings({ 'server.resourceTimeoutMs': 5000, 'fs.maxWatchCount': 4 }, 'browser').values)
      .toEqual({ 'fs.maxWatchCount': 4 });
    expect(normalizePajaSettings([1, 2]).rejected).toEqual(['settings must be an object of numbers']);
    expect(normalizePajaSettings(undefined)).toEqual({ values: {}, rejected: [] });
  });
});

describe('active settings', () => {
  it('returns overrides at call time and falls back to defaults', () => {
    expect(getPajaSetting('mp.tickIntervalMs')).toBe(2000);
    setActivePajaSettings({ 'mp.tickIntervalMs': 500 });
    expect(getPajaSetting('mp.tickIntervalMs')).toBe(500);
    expect(getActivePajaSettings()).toEqual({ 'mp.tickIntervalMs': 500 });
    setActivePajaSettings({});
    expect(getPajaSetting('mp.tickIntervalMs')).toBe(2000);
  });

  it('refuses invalid values even when activated directly', () => {
    setActivePajaSettings({ 'fs.maxWatchCount': -1 });
    expect(getPajaSetting('fs.maxWatchCount')).toBe(16);
  });

  it('throws on an unregistered key so typos cannot read undefined', () => {
    expect(() => getPajaSetting('relay.typo' as PajaSettingKey)).toThrow('Unknown Paja setting relay.typo');
  });
});
