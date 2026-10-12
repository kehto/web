/** Host-owned controller snapshots, following https://github.com/napplet/naps/pull/108. */
import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';

/** Controller values supplied by the host's one native reader. */
export interface GamepadPadSample {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: boolean;
  readonly timestamp: number;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly value: number; readonly pressed: boolean; readonly touched?: boolean }[];
}

/** Host hooks for focus-scoped controller delivery; no device handles cross the wire. */
export interface GamepadServiceOptions {
  readGamepads?: () => readonly (GamepadPadSample | null)[];
  /** Return the host's current input owner; never use a napplet-supplied id. */
  getFocusedWindow?: () => string | null;
  /** Whether the host surface is visible and focused. */
  isHostActive?: () => boolean;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (frame: number) => void;
  /** Focus, visibility and connection events should refresh immediately. */
  subscribeChanges?: (refresh: () => void) => () => void;
  now?: () => number;
}

/** The host can refresh on focus loss without waiting for the next display frame. */
export interface GamepadService extends ServiceHandler {
  refresh(): void;
}

type Pad = {
  index: number; id: string; mapping: string; connected: true; timestamp: number;
  axes: number[]; buttons: { value: number; pressed: boolean; touched: boolean }[];
};
type Sample = { available: boolean; reason?: 'blocked' | 'unavailable'; pads: (Pad | null)[] };
type Recipient = { send: (message: NappletMessage) => void; previous?: string };
const SUBSCRIBE_WINDOW_MS = 1000;
const MAX_SUBSCRIPTIONS_PER_WINDOW = 32;

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : 0;
}

function readSample(read?: GamepadServiceOptions['readGamepads']): Sample {
  if (!read) return { available: false, reason: 'unavailable', pads: [] };
  try {
    return {
      available: true,
      pads: Array.from(read(), (pad) => !pad?.connected ? null : {
        index: pad.index, id: pad.id, mapping: pad.mapping, connected: true,
        timestamp: Number.isFinite(pad.timestamp) ? pad.timestamp : 0,
        axes: Array.from(pad.axes, (axis) => clamp(axis, -1, 1)),
        buttons: Array.from(pad.buttons, (button) => ({
          value: clamp(button.value, 0, 1), pressed: button.pressed,
          touched: button.touched ?? button.pressed,
        })),
      }),
    };
  } catch (error) {
    const blocked = typeof error === 'object' && error !== null && 'name' in error && error.name === 'SecurityError';
    if (!blocked) throw error;
    return { available: false, reason: 'blocked', pads: [] };
  }
}

function padsFor(sample: Sample, focused: boolean): (Pad | null)[] {
  return sample.pads.map((pad) => pad === null ? null : {
    index: pad.index, id: pad.id, mapping: pad.mapping, connected: true,
    timestamp: focused ? pad.timestamp : 0,
    axes: pad.axes.map((axis) => focused ? axis : 0),
    buttons: pad.buttons.map((button) => focused ? { ...button } : { value: 0, pressed: false, touched: false }),
  });
}

/**
 * Create one controller reader shared by all subscribed windows in a runtime.
 * @param options Trusted native reader, input-owner and lifecycle hooks.
 * @returns A gamepad service with immediate refresh and session cleanup.
 * @example const gamepad = createGamepadService({ readGamepads, getFocusedWindow, isHostActive });
 */
export function createGamepadService(options: GamepadServiceOptions = {}): GamepadService {
  const recipients = new Map<string, Recipient>();
  const changes = new Map<string, { start: number; count: number }>();
  const now = options.now ?? Date.now;
  let context: ServiceRuntimeContext | undefined;
  let frame: number | undefined;
  let generation = 0;
  let detach: (() => void) | undefined;
  let closed = false;
  let sample: Sample = { available: false, reason: 'unavailable', pads: [] };

  function cancel(): void {
    generation += 1;
    if (frame !== undefined) options.cancelFrame?.(frame);
    frame = undefined;
  }

  function schedule(): void {
    if (closed || recipients.size === 0 || !sample.available || frame !== undefined || !options.requestFrame) return;
    const scheduled = ++generation;
    frame = options.requestFrame(() => {
      if (scheduled !== generation) return;
      frame = undefined;
      refresh();
    });
  }

  function deliver(windowId: string, recipient: Recipient, force = false): void {
    const focused = sample.available && (options.isHostActive?.() ?? true) && options.getFocusedWindow?.() === windowId;
    const message = { type: 'gamepad.state', ...sample, focused, pads: padsFor(sample, focused) };
    const signature = JSON.stringify(message);
    if (!force && signature === recipient.previous) return;
    recipient.previous = signature;
    if (context) {
      if (!context.sendToEligibleNapplet(windowId, message)) recipients.delete(windowId);
    } else recipient.send(message);
  }

  function refresh(): void {
    if (closed || recipients.size === 0) return;
    sample = readSample(options.readGamepads);
    const current = [...recipients];
    for (const [windowId, recipient] of current) {
      if (recipients.get(windowId) === recipient) deliver(windowId, recipient);
    }
    if (recipients.size === 0 || !sample.available) cancel();
    schedule();
  }

  function unsubscribe(windowId: string): void {
    recipients.delete(windowId);
    if (recipients.size === 0) cancel();
  }

  function allowSubscribe(windowId: string): boolean {
    const time = now();
    let bucket = changes.get(windowId);
    if (!bucket || time < bucket.start || time - bucket.start >= SUBSCRIBE_WINDOW_MS) {
      bucket = { start: time, count: 0 };
      changes.set(windowId, bucket);
    }
    bucket.count += 1;
    return bucket.count <= MAX_SUBSCRIPTIONS_PER_WINDOW;
  }

  return {
    descriptor: { name: 'gamepad', version: '1.0.0', description: 'NAP-GAMEPAD focus-scoped controller snapshots' },
    refresh,
    onRegistered(runtime) {
      context = runtime;
      closed = false;
      detach?.();
      detach = options.subscribeChanges?.(refresh);
    },
    onUnregistered() {
      closed = true;
      cancel();
      detach?.(); detach = undefined;
      recipients.clear(); changes.clear();
      context = undefined;
    },
    handleMessage(windowId, message, send) {
      if (closed || !message || typeof message !== 'object' || Array.isArray(message) || 'id' in message) return;
      if (message.type === 'gamepad.unsubscribe') { unsubscribe(windowId); return; }
      if (message.type !== 'gamepad.subscribe' || !allowSubscribe(windowId)) return;
      const recipient = recipients.get(windowId) ?? { send };
      recipients.set(windowId, recipient);
      sample = readSample(options.readGamepads);
      deliver(windowId, recipient, true);
      schedule();
    },
    onWindowDestroyed(windowId) { unsubscribe(windowId); changes.delete(windowId); },
  };
}
