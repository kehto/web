/**
 * domains/gamepad.ts — Mock NAP-GAMEPAD service.
 *
 * Spec: naps/NAP-GAMEPAD.md @ napplet/naps PR #130 head 0b28f77e3dfa (draft)
 * Routes: gamepad.subscribe, gamepad.unsubscribe
 * Spec gaps / decisions:
 * - No `@napplet/nap/gamepad/types` in nap 0.32.0; shapes are local.
 * - Envelopes carrying `id` are ignored (the NAP says none carries `id`).
 * - Input focus is runtime state: the first subscriber takes focus when no
 *   window holds it; `setFocus()` moves it. Non-focused subscribers get
 *   neutral slots (zero axes/buttons, `timestamp: 0`).
 * - Unchanged snapshots are not resent (per-subscriber signature).
 * - `autoplay` drives an idle stick-drift loop through the scheduler so a
 *   shell UI sees periodic live samples without input.
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_CLOCK, DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** NAP-GAMEPAD document checked for this mock. */
export const GAMEPAD_SPEC_REF: NapSpecRef = { nap: 'NAP-GAMEPAD', status: 'draft', source: 'pr', pr: 130, sha: '0b28f77e3dfa', path: 'naps/NAP-GAMEPAD.md' };

/** `GamepadButton` from the NAP. */
export interface MockGamepadButton {
  /** 0..1 travel. */
  value: number;
  /** Device-reported pressed state. */
  pressed: boolean;
  /** Device-reported touch state. */
  touched: boolean;
}

/** `Gamepad` from the NAP (one connected slot). */
export interface MockGamepadPad {
  /** Slot position. */
  index: number;
  /** Controller description (not an identity). */
  id: string;
  /** `standard` or `""`. */
  mapping: string;
  /** Always `true` inside a snapshot. */
  connected: true;
  /** Runtime time of last change (ms); `0` in neutral slots. */
  timestamp: number;
  /** Axes, each -1..1. */
  axes: number[];
  /** Buttons in `mapping` order. */
  buttons: MockGamepadButton[];
}

/** `GamepadState` snapshot pushed as `gamepad.state`. */
export interface MockGamepadSnapshot {
  /** `false` when the runtime cannot read controllers. */
  available: boolean;
  /** Present only when `available` is false. */
  reason?: 'blocked' | 'unavailable';
  /** Whether the recipient receives live values. */
  focused: boolean;
  /** Complete slot list (`null` = empty slot). */
  pads: (MockGamepadPad | null)[];
}

/** In-memory state of the gamepad mock. */
export interface MockGamepadState {
  /** Physical slots as read by the runtime's single native reader. */
  pads: (MockGamepadPad | null)[];
  /** Whether the runtime can read controllers. */
  available: boolean;
  /** Unavailability reason. */
  reason?: 'blocked' | 'unavailable';
  /** Window holding input focus. */
  focusedWindow: string | null;
  /** Subscribed windows → last delivered snapshot signature. */
  subscribers: Map<string, string | undefined>;
  /** Idle-loop tick counter. */
  ticks: number;
  /** Cancel function of the autoplay loop. */
  timer?: () => void;
}

/**
 * Factory options for the gamepad mock.
 *
 * @example
 * ```ts
 * const pads = createMockGamepadService({ autoplay: true, tickMs: 16 });
 * ```
 */
export interface MockGamepadOptions extends MockServiceOptions {
  /** Initial slots. Default: two standard-mapping pads at slots 0 and 1. */
  pads?: readonly (MockGamepadPad | null)[];
  /** Report `available: false` with this reason. */
  unavailable?: 'blocked' | 'unavailable';
  /** Emit an idle stick-drift sample loop through the scheduler. */
  autoplay?: boolean;
  /** Loop interval for `autoplay`. Default 16. */
  tickMs?: number;
}

/** Gamepad mock plus input controls. */
export type MockGamepadService = MockService<MockGamepadState> & {
  /** Focus `windowId` and press `button` on slot `padIndex` (`value` 0..1, default 1). */
  press(windowId: string, padIndex: number, button: number, value?: number): void;
  /** Focus `windowId` and release `button` on slot `padIndex`. */
  release(windowId: string, padIndex: number, button: number): void;
  /** Focus `windowId` and set the axes of slot `padIndex`. */
  setAxes(windowId: string, padIndex: number, axes: readonly number[]): void;
  /** Move input focus (or clear it with `null`) and push changed snapshots. */
  setFocus(windowId: string | null): void;
  /** Connect a pad into its `index` slot and notify every subscriber. */
  connect(pad: MockGamepadPad): void;
  /** Empty slot `padIndex` and notify every subscriber. */
  disconnect(padIndex: number): void;
};

/** Standard-layout button count. */
const STANDARD_BUTTONS = 17;

/**
 * Build a neutral standard-mapping pad for slot `index`.
 *
 * @param index - Slot position.
 * @param id - Controller description.
 * @returns A connected pad with 4 axes and 17 released buttons.
 * @example
 * ```ts
 * const pad = standardGamepad(0, 'Example Wireless Controller');
 * pad.buttons.length === 17;
 * ```
 */
export function standardGamepad(index: number, id: string): MockGamepadPad {
  return {
    index, id, mapping: 'standard', connected: true, timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: STANDARD_BUTTONS }, () => ({ value: 0, pressed: false, touched: false })),
  };
}

/** Default seeded slots. */
export const MOCK_GAMEPADS: readonly MockGamepadPad[] = Object.freeze([
  standardGamepad(0, 'Example Wireless Controller (Vendor: 0000 Product: 0001)'),
  standardGamepad(1, 'Example Arcade Stick (Vendor: 0000 Product: 0002)'),
]);

const clamp = (value: number, min: number, max: number): number => (Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0);
const round = (value: number): number => { const rounded = Math.round(value * 100) / 100; return rounded === 0 ? 0 : rounded; };

function clonePad(pad: MockGamepadPad, live: boolean): MockGamepadPad {
  return {
    index: pad.index, id: pad.id, mapping: pad.mapping, connected: true,
    timestamp: live ? pad.timestamp : 0,
    axes: pad.axes.map((axis) => (live ? axis : 0)),
    buttons: pad.buttons.map((button) => (live ? { ...button } : { value: 0, pressed: false, touched: false })),
  };
}

/**
 * Create the NAP-GAMEPAD mock.
 *
 * @param options - Seeded pads, availability, autoplay loop.
 * @returns A `gamepad` service with press/axes/focus/connection controls.
 * @example
 * ```ts
 * const gamepad = createMockGamepadService();
 * gamepad.handleMessage('w1', { type: 'gamepad.subscribe' }, send); // → gamepad.state
 * gamepad.press('w1', 0, 0);                                         // → gamepad.state (button 0 pressed)
 * ```
 */
export function createMockGamepadService(options: MockGamepadOptions = {}): MockGamepadService {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const mock = defineMockService<MockGamepadState>({
    domain: 'gamepad',
    version: '1.0.0',
    description: 'Mock NAP-GAMEPAD focus-scoped controller snapshots',
    kind: 'service',
    initialState: () => ({
      pads: (options.pads ?? MOCK_GAMEPADS).map((pad) => (pad ? clonePad(pad, true) : null)),
      available: options.unavailable === undefined,
      ...(options.unavailable ? { reason: options.unavailable } : {}),
      focusedWindow: null, subscribers: new Map(), ticks: 0,
    }),
    routes: {
      'gamepad.subscribe': ({ message, state, windowId }) => {
        if (message.id !== undefined) return;
        if (!state.subscribers.has(windowId)) state.subscribers.set(windowId, undefined);
        if (state.focusedWindow === null) state.focusedWindow = windowId;
        deliver(windowId, true);
        startLoop();
      },
      'gamepad.unsubscribe': ({ message, state, windowId }) => {
        if (message.id === undefined) unsubscribe(state, windowId);
      },
    },
    onWindowDestroyed: (windowId, state) => unsubscribe(state, windowId),
  }, options);

  function snapshot(state: MockGamepadState, windowId: string): MockGamepadSnapshot {
    const focused = state.available && state.focusedWindow === windowId;
    return {
      available: state.available, ...(state.reason ? { reason: state.reason } : {}),
      focused, pads: state.available ? state.pads.map((pad) => (pad ? clonePad(pad, focused) : null)) : [],
    };
  }
  function deliver(windowId: string, force = false): void {
    const state = mock.mock.state();
    if (!state.subscribers.has(windowId)) return;
    const message = { type: 'gamepad.state', ...snapshot(state, windowId) } as NappletMessage;
    const signature = JSON.stringify(message);
    if (!force && signature === state.subscribers.get(windowId)) return;
    if (pushToWindow(mock, windowId, message)) state.subscribers.set(windowId, signature);
  }
  function broadcast(): void { for (const windowId of mock.mock.state().subscribers.keys()) deliver(windowId); }
  function unsubscribe(state: MockGamepadState, windowId: string): void {
    state.subscribers.delete(windowId);
    if (state.focusedWindow === windowId) state.focusedWindow = null;
    if (state.subscribers.size === 0) stopLoop(state);
  }
  function stopLoop(state: MockGamepadState): void { state.timer?.(); delete state.timer; }
  function startLoop(): void {
    const state = mock.mock.state();
    if (!options.autoplay || state.timer || state.subscribers.size === 0) return;
    state.timer = scheduler.schedule(options.tickMs ?? 16, () => {
      delete state.timer;
      state.ticks += 1;
      const pad = state.pads.find((item): item is MockGamepadPad => item !== null);
      if (pad) {
        pad.axes[0] = round(Math.sin(state.ticks / 30) * 0.05);
        pad.axes[1] = round(Math.cos(state.ticks / 30) * 0.05);
        pad.timestamp = clock.now();
        broadcast();
      }
      startLoop();
    });
  }
  function focusedPad(windowId: string, padIndex: number): MockGamepadPad | undefined {
    const state = mock.mock.state();
    state.focusedWindow = windowId;
    const pad = state.pads[padIndex];
    if (pad) pad.timestamp = clock.now();
    return pad ?? undefined;
  }

  const baseReset = mock.mock.reset;
  mock.mock.reset = () => { stopLoop(mock.mock.state()); baseReset(); };
  return Object.assign(mock, {
    press(windowId: string, padIndex: number, button: number, value = 1) {
      const pad = focusedPad(windowId, padIndex);
      const target = pad?.buttons[button];
      if (target) Object.assign(target, { value: clamp(value, 0, 1), pressed: value > 0, touched: true });
      broadcast();
    },
    release(windowId: string, padIndex: number, button: number) {
      const target = focusedPad(windowId, padIndex)?.buttons[button];
      if (target) Object.assign(target, { value: 0, pressed: false, touched: false });
      broadcast();
    },
    setAxes(windowId: string, padIndex: number, axes: readonly number[]) {
      const pad = focusedPad(windowId, padIndex);
      if (pad) pad.axes = axes.map((axis) => clamp(axis, -1, 1));
      broadcast();
    },
    setFocus(windowId: string | null) { mock.mock.state().focusedWindow = windowId; broadcast(); },
    connect(pad: MockGamepadPad) {
      const state = mock.mock.state();
      while (state.pads.length <= pad.index) state.pads.push(null);
      state.pads[pad.index] = clonePad({ ...pad, timestamp: clock.now() }, true);
      broadcast();
    },
    disconnect(padIndex: number) {
      const state = mock.mock.state();
      if (padIndex < state.pads.length) state.pads[padIndex] = null;
      broadcast();
    },
  });
}

/** Registry row for the gamepad mock. */
export const GAMEPAD_MOCK_ENTRY: MockDomainEntry = { domain: 'gamepad', kind: 'service', spec: GAMEPAD_SPEC_REF, create: (o) => createMockGamepadService(o) };
