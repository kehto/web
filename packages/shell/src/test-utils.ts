/**
 * Test-only NIP-5D transport helpers for @kehto/shell unit tests.
 *
 * NIP-5D (nostr-protocol/nips#2303) carries every NAP message over the port a
 * napplet hands over in its single `napplet.hello`. Real `MessageChannel`
 * delivery is asynchronous, so unit tests that assert synchronous dispatch
 * use a synchronous port double here. Transport semantics themselves are
 * proven with real `MessageChannel`s in `nip5d-port-binding.test.ts`.
 *
 * Not exported from the package entry point.
 */

import type { ShellBridge } from './shell-bridge.js';
import { originRegistry } from './origin-registry.js';

/** Outbound recorder shape shared by the fake iframe windows in shell tests. */
export type PortRecorder = Pick<Window, 'postMessage'>;

/** A synchronous shell-side port double. */
export interface FakeShellPort {
  /** The object passed to the bridge as the transferred port. */
  readonly port: MessagePort;
  /** Deliver one napplet → shell message on the port. */
  deliver(data: unknown): void;
  /** Whether the shell closed this port. */
  readonly closed: boolean;
  /** Fire the port's `close` event (napplet document went away). */
  fireClose(): void;
}

/**
 * Create a synchronous port double whose shell → napplet posts are recorded
 * on `recorder.postMessage(message, '*')`.
 *
 * @param recorder - Where shell → napplet messages are recorded
 * @returns The fake port controls
 */
export function createFakeShellPort(recorder: PortRecorder): FakeShellPort {
  const listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  let closed = false;
  const port = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage(message: unknown): void {
      if (!closed) recorder.postMessage(message, '*');
    },
    addEventListener(type: string, listener: (event: MessageEvent) => void): void {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
      listeners.get(type)?.delete(listener);
    },
    start(): void {},
    close(): void {
      closed = true;
    },
  };
  const emit = (type: string, event: MessageEvent): void => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  return {
    port: port as MessagePort,
    deliver(data: unknown): void {
      if (closed) return;
      const event = { data } as MessageEvent;
      port.onmessage?.(event);
      emit('message', event);
    },
    get closed() {
      return closed;
    },
    fireClose(): void {
      emit('close', {} as MessageEvent);
    },
  };
}

const ports = new WeakMap<object, FakeShellPort>();

/**
 * Send the NIP-5D `napplet.hello` for a registered fake iframe window.
 *
 * @param bridge - The bridge under test
 * @param win - The fake iframe window (also the outbound recorder)
 * @param origin - The window-level event origin
 * @returns The bound fake port
 */
export function sendHello(
  bridge: Pick<ShellBridge, 'handleMessage'>,
  win: PortRecorder,
  origin = 'null',
): FakeShellPort {
  const fake = createFakeShellPort(win);
  ports.set(win, fake);
  const hello: Pick<MessageEvent, 'source' | 'origin' | 'data' | 'ports'> = {
    source: win as Window,
    origin,
    data: { type: 'napplet.hello' },
    ports: [fake.port],
  };
  bridge.handleMessage(hello as MessageEvent);
  return fake;
}

/**
 * Deliver one napplet → shell envelope the way a NIP-5D napplet does: the
 * first delivery from a registered window performs `napplet.hello`, every
 * envelope then travels over the bound port. Unregistered sources fall back
 * to a raw window-level message so drop diagnostics stay observable.
 *
 * @param bridge - The bridge under test
 * @param event - `source`, `origin` and `data` of the napplet message
 */
export function deliverFromNapplet(
  bridge: Pick<ShellBridge, 'handleMessage'>,
  event: { source: unknown; origin?: string; data: unknown },
): void {
  const win = event.source as Window | null;
  if (!win || !originRegistry.getWindowId(win)) {
    bridge.handleMessage(event as MessageEvent);
    return;
  }
  const windowId = originRegistry.getWindowId(win)!;
  let fake = ports.get(win);
  if (!fake || fake.closed || originRegistry.getPort(windowId) !== fake.port) {
    fake = sendHello(bridge, win, event.origin ?? 'null');
  }
  fake.deliver(event.data);
}
