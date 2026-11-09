/**
 * domains/motion.ts — Mock NAP-MOTION service.
 *
 * Spec: naps/NAP-MOTION.md @ napplet/naps PR #124 head 3069a945271f (draft)
 * Routes: motion.subscribe, motion.unsubscribe, motion.permission
 * Spec gaps / decisions:
 * - No `@napplet/nap/motion/types` in nap 0.32.0; shapes are local.
 * - The user's decision is simulated by `grant` (`granted` | `relative-only`
 *   | `denied`); an existing decision is returned without re-prompting.
 * - Input focus is runtime state: the first subscriber takes focus when no
 *   window holds it; `setFocus()` moves it. Samples flow only to a granted,
 *   focused subscriber; nobody else receives zero samples.
 * - Samples are a deterministic slow tilt (values quantized to 0.1); absolute
 *   `alpha` is coarsened to 10 degrees.
 * - Unchanged `motion.state` snapshots are not resent.
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_CLOCK, DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** NAP-MOTION document checked for this mock. */
export const MOTION_SPEC_REF: NapSpecRef = { nap: 'NAP-MOTION', status: 'draft', source: 'pr', pr: 124, sha: '3069a945271f', path: 'naps/NAP-MOTION.md' };

/** `MotionPermission` from the NAP. */
export type MockMotionPermission = 'prompt' | 'granted' | 'denied';

/** `Vector3` from the NAP (m/s²). */
export interface MockMotionVector3 {
  /** Device x axis. */
  x: number | null;
  /** Device y axis. */
  y: number | null;
  /** Device z axis. */
  z: number | null;
}

/** `RotationRate` from the NAP (deg/s). */
export interface MockMotionRotationRate {
  /** Around z. */
  alpha: number | null;
  /** Around x. */
  beta: number | null;
  /** Around y. */
  gamma: number | null;
}

/** `Orientation` from the NAP (degrees). */
export interface MockMotionOrientation {
  /** 0..360 around z. */
  alpha: number | null;
  /** -180..180 around x. */
  beta: number | null;
  /** -90..90 around y. */
  gamma: number | null;
  /** Earth-referenced frame. */
  absolute: boolean;
}

/** `MotionSample` pushed as `motion.sample`. */
export interface MockMotionSample {
  /** Runtime time of the reading (ms). */
  timestamp: number;
  /** Milliseconds between samples. */
  interval: number;
  /** Linear acceleration. */
  acceleration: MockMotionVector3 | null;
  /** Acceleration including gravity. */
  accelerationIncludingGravity: MockMotionVector3 | null;
  /** Gyroscope reading. */
  rotationRate: MockMotionRotationRate | null;
  /** Orientation. */
  orientation: MockMotionOrientation | null;
}

/** `MotionState` pushed as `motion.state`. */
export interface MockMotionSnapshot {
  /** Runtime can read sensors. */
  available: boolean;
  /** Unavailability reason. */
  reason?: 'blocked' | 'unavailable';
  /** This napplet's grant. */
  permission: MockMotionPermission;
  /** Absolute orientation granted. */
  absolute: boolean;
  /** Samples currently flow. */
  focused: boolean;
  /** Delivered samples per second. */
  frequency: number;
}

/** Per-window grant and subscription. */
export interface MockMotionWindow {
  /** Subscribed to state/samples. */
  subscribed: boolean;
  /** Requested upper bound (samples/s). */
  requestedFrequency: number;
  /** Grant. */
  permission: MockMotionPermission;
  /** Absolute grant. */
  absolute: boolean;
  /** Last delivered `motion.state` signature. */
  previous?: string;
}

/** In-memory state of the motion mock. */
export interface MockMotionState {
  /** Runtime can read sensors. */
  available: boolean;
  /** Unavailability reason. */
  reason?: 'blocked' | 'unavailable';
  /** Window holding input focus. */
  focusedWindow: string | null;
  /** Per-window state. */
  windows: Map<string, MockMotionWindow>;
  /** Samples emitted so far (drives the deterministic tilt). */
  sampleIndex: number;
  /** Cancel function of the autoplay loop. */
  timer?: () => void;
}

/**
 * Factory options for the motion mock.
 *
 * @example
 * ```ts
 * const motion = createMockMotionService({ grant: 'relative-only', autoplay: true });
 * ```
 */
export interface MockMotionOptions extends MockServiceOptions {
  /** Simulated user decision for `motion.permission`. Default `granted`. */
  grant?: 'granted' | 'relative-only' | 'denied';
  /** Report `available: false` with this reason. */
  unavailable?: 'blocked' | 'unavailable';
  /** Rate cap (samples/s). Default 60. */
  maxFrequency?: number;
  /** Push samples continuously through the scheduler at the delivered rate. */
  autoplay?: boolean;
}

/** Motion mock plus sensor and focus controls. */
export type MockMotionService = MockService<MockMotionState> & {
  /** Push one sample to the eligible (granted, focused, subscribed) window. Returns whether one was delivered. */
  emitSample(): boolean;
  /** Move input focus (or clear it with `null`); pushes changed states. */
  setFocus(windowId: string | null): void;
  /** User revokes a window's grant: new state, samples stop. */
  revoke(windowId: string): void;
};

const q = (value: number): number => { const rounded = Math.round(value * 10) / 10; return rounded === 0 ? 0 : rounded; };

/**
 * Deterministic tilt sample `index` (a slow sway around rest).
 *
 * @param index - Sample ordinal.
 * @param timestamp - Runtime time (ms).
 * @param interval - Delivery interval (ms).
 * @param absolute - Whether orientation is Earth-referenced (alpha coarsened to 10°).
 * @returns A `MotionSample`.
 * @example
 * ```ts
 * motionSampleAt(0, 0, 16.7, false).accelerationIncludingGravity?.z === 9.8;
 * ```
 */
export function motionSampleAt(index: number, timestamp: number, interval: number, absolute: boolean): MockMotionSample {
  const phase = index / 20;
  const tilt = Math.sin(phase);
  return {
    timestamp, interval,
    acceleration: { x: q(tilt * 0.3), y: q(Math.cos(phase) * 0.2), z: 0 },
    accelerationIncludingGravity: { x: q(tilt * 0.3), y: q(Math.cos(phase) * 0.2), z: 9.8 },
    rotationRate: { alpha: q(Math.cos(phase) * 1.5), beta: q(-tilt * 0.5), gamma: 0 },
    orientation: { alpha: absolute ? Math.round((112 + tilt * 5) / 10) * 10 : q(112.4 + tilt * 5), beta: q(3 + tilt * 2), gamma: q(-1.2 + tilt), absolute },
  };
}

/**
 * Create the NAP-MOTION mock.
 *
 * @param options - Grant decision, availability, rate cap, autoplay.
 * @returns A `motion` extension with `emitSample`, `setFocus`, `revoke`.
 * @example
 * ```ts
 * const motion = createMockMotionService();
 * motion.handleMessage('w1', { type: 'motion.subscribe', frequency: 60 }, send);      // → motion.state
 * motion.handleMessage('w1', { type: 'motion.permission', id: 'm1' }, send);          // → result + motion.state
 * motion.emitSample();                                                                 // → motion.sample
 * ```
 */
export function createMockMotionService(options: MockMotionOptions = {}): MockMotionService {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const maxFrequency = options.maxFrequency ?? 60;
  const mock = defineMockService<MockMotionState>({
    domain: 'motion',
    version: '0.1.0',
    description: 'Mock NAP-MOTION device motion and orientation',
    kind: 'extension',
    pushes: { 'motion.state': null, 'motion.sample': null },
    initialState: () => ({ available: options.unavailable === undefined, ...(options.unavailable ? { reason: options.unavailable } : {}), focusedWindow: null, windows: new Map(), sampleIndex: 0 }),
    routes: {
      'motion.subscribe': ({ message, state, windowId }) => {
        if (message.id !== undefined || (message.frequency !== undefined && typeof message.frequency !== 'number')) return;
        const entry = entryFor(state, windowId);
        entry.subscribed = true;
        if (typeof message.frequency === 'number' && message.frequency > 0) entry.requestedFrequency = message.frequency;
        if (state.focusedWindow === null) state.focusedWindow = windowId;
        deliverState(windowId, true);
        startLoop();
      },
      'motion.unsubscribe': ({ message, state, windowId }) => {
        if (message.id !== undefined) return;
        const entry = state.windows.get(windowId);
        if (entry) { entry.subscribed = false; delete entry.previous; }
        if (state.focusedWindow === windowId) state.focusedWindow = null;
      },
      'motion.permission': ({ message, state, windowId, reply }) => {
        const entry = entryFor(state, windowId);
        if (message.absolute !== undefined && typeof message.absolute !== 'boolean') return reply({ permission: entry.permission, absolute: entry.absolute, error: 'invalid request' });
        if (!state.available) return reply({ permission: entry.permission, absolute: entry.absolute, error: state.reason ?? 'unavailable' });
        if (entry.permission === 'prompt') {
          entry.permission = options.grant === 'denied' ? 'denied' : 'granted';
          entry.absolute = entry.permission === 'granted' && message.absolute === true && (options.grant ?? 'granted') === 'granted';
        }
        reply({ permission: entry.permission, absolute: entry.absolute });
        deliverState(windowId);
        startLoop();
      },
    },
    onWindowDestroyed: (windowId, state) => {
      state.windows.delete(windowId);
      if (state.focusedWindow === windowId) state.focusedWindow = null;
      if (state.windows.size === 0) stopLoop(state);
    },
    onCapabilityRevoked: (windowId) => revoke(windowId),
  }, options);

  function entryFor(state: MockMotionState, windowId: string): MockMotionWindow {
    let entry = state.windows.get(windowId);
    if (!entry) { entry = { subscribed: false, requestedFrequency: maxFrequency, permission: 'prompt', absolute: false }; state.windows.set(windowId, entry); }
    return entry;
  }
  function eligible(state: MockMotionState, windowId: string, entry: MockMotionWindow): boolean {
    return state.available && entry.subscribed && entry.permission === 'granted' && state.focusedWindow === windowId;
  }
  function snapshot(state: MockMotionState, windowId: string, entry: MockMotionWindow): MockMotionSnapshot {
    const focused = eligible(state, windowId, entry);
    return {
      available: state.available, ...(state.reason ? { reason: state.reason } : {}),
      permission: entry.permission, absolute: entry.absolute, focused,
      frequency: focused ? Math.min(entry.requestedFrequency, maxFrequency) : 0,
    };
  }
  function deliverState(windowId: string, force = false): void {
    const state = mock.mock.state();
    const entry = state.windows.get(windowId);
    if (!entry?.subscribed) return;
    const message = { type: 'motion.state', ...snapshot(state, windowId, entry) } as NappletMessage;
    const signature = JSON.stringify(message);
    if (!force && signature === entry.previous) return;
    if (pushToWindow(mock, windowId, message)) entry.previous = signature;
  }
  function deliverAll(): void { for (const windowId of mock.mock.state().windows.keys()) deliverState(windowId); }
  function emitSample(): boolean {
    const state = mock.mock.state();
    for (const [windowId, entry] of state.windows) {
      if (!eligible(state, windowId, entry)) continue;
      const interval = Math.round((1000 / Math.min(entry.requestedFrequency, maxFrequency)) * 10) / 10;
      const sample = motionSampleAt(state.sampleIndex, clock.now(), interval, entry.absolute);
      state.sampleIndex += 1;
      return pushToWindow(mock, windowId, { type: 'motion.sample', ...sample } as NappletMessage);
    }
    return false;
  }
  function revoke(windowId: string): void {
    const entry = mock.mock.state().windows.get(windowId);
    if (!entry) return;
    entry.permission = 'prompt';
    entry.absolute = false;
    deliverState(windowId);
  }
  function stopLoop(state: MockMotionState): void { state.timer?.(); delete state.timer; }
  function startLoop(): void {
    const state = mock.mock.state();
    if (!options.autoplay || state.timer) return;
    const target = [...state.windows].find(([windowId, entry]) => eligible(state, windowId, entry));
    if (!target) return;
    state.timer = scheduler.schedule(1000 / Math.min(target[1].requestedFrequency, maxFrequency), () => { delete state.timer; emitSample(); startLoop(); });
  }

  const baseReset = mock.mock.reset;
  mock.mock.reset = () => { stopLoop(mock.mock.state()); baseReset(); };
  return Object.assign(mock, {
    emitSample,
    setFocus(windowId: string | null) { mock.mock.state().focusedWindow = windowId; deliverAll(); startLoop(); },
    revoke,
  });
}

/** Registry row for the motion mock. */
export const MOTION_MOCK_ENTRY: MockDomainEntry = { domain: 'motion', kind: 'extension', spec: MOTION_SPEC_REF, create: (o) => createMockMotionService(o) };
