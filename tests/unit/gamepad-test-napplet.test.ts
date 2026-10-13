import { describe, expect, it } from 'vitest';
import { initialEvidence, observe, stateLabel, type ControllerState } from '../../apps/gamepad-test/src/state.js';

// Canonical NAP-GAMEPAD PR 108 example, including the null slot at index zero.
const live: ControllerState = {
  available: true, focused: true,
  pads: [null, { index: 1, id: 'Xbox Wireless Controller', mapping: 'standard', connected: true,
    timestamp: 18235.4, axes: [0, -1, 0, 0], buttons: [
      { value: 1, pressed: true, touched: true }, { value: 0, pressed: false, touched: false },
    ] }],
};
const idle: ControllerState = { available: true, focused: false, pads: [null, {
  ...live.pads[1]!, timestamp: 0, axes: [0, 0, 0, 0],
  buttons: [{ value: 0, pressed: false, touched: false }, { value: 0, pressed: false, touched: false }],
}] };

describe('controller tester evidence', () => {
  it('records actual live input and a connected neutral transition', () => {
    const first = observe(initialEvidence(), undefined, live);
    expect(first).toEqual({ snapshots: 1, liveInput: true, neutralAfterBlur: false, leakedInput: false });
    expect(observe(first, live, idle)).toEqual({ snapshots: 2, liveInput: true, neutralAfterBlur: true, leakedInput: false });
  });
  it('does not mistake empty, disconnected, blocked, or initial idle states for proof', () => {
    for (const state of [idle, { ...idle, pads: [] }, { ...idle, available: false, reason: 'blocked' as const, pads: [] }]) {
      expect(observe(initialEvidence(), undefined, state)).toMatchObject({ liveInput: false, neutralAfterBlur: false });
    }
    expect(observe(initialEvidence(), live, { ...idle, pads: [null, null] }).neutralAfterBlur).toBe(false);
  });
  it('detects unfocused axes, pressed/touched flags, and nonzero timestamps without hiding them', () => {
    for (const pad of [live.pads[1]!, { ...idle.pads[1]!, timestamp: 1 },
      { ...idle.pads[1]!, buttons: [{ value: 0, pressed: false, touched: true }] }]) {
      expect(observe(initialEvidence(), live, { ...idle, pads: [null, pad] })).toMatchObject({ leakedInput: true, neutralAfterBlur: false });
    }
  });
  it('keeps an observed failure visible after later neutral states', () => {
    const failed = observe(initialEvidence(), live, { ...live, focused: false });
    expect(observe(failed, live, idle).leakedInput).toBe(true);
  });
  it('distinguishes absence of a reader from host policy denial', () => {
    expect(stateLabel({ available: false, focused: false, reason: 'blocked', pads: [] })).toBe('Controller access blocked');
    expect(stateLabel({ available: false, focused: false, reason: 'unavailable', pads: [] })).toBe('Controller reader unavailable');
  });
});

// Inspect the deliverable, including the bytes a runtime verifies before injection.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
it('builds one content-addressed artifact with GAMEPAD required and THEME optional', () => {
  const html = readFileSync(new URL('../../apps/gamepad-test/dist/index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../../apps/gamepad-test/dist/.nip5a-manifest.json', import.meta.url), 'utf8'));
  expect(manifest.tags.filter((tag: string[]) => tag[0] === 'R')).toEqual([['R', 'gamepad']]);
  expect(manifest.tags.filter((tag: string[]) => tag[0] === 'O')).toEqual([['O', 'theme']]);
  expect(manifest.tags.filter((tag: string[]) => tag[0] === 'x')).toEqual([['x', createHash('sha256').update(html).digest('hex')]]);
  expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel=["']stylesheet/);
  expect(html).not.toMatch(/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|localStorage|sessionStorage|indexedDB)\b|navigator\s*\./);
});
