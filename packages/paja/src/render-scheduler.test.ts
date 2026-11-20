import { afterEach, describe, expect, it, vi } from 'vitest';
import { coalescePajaRender } from './render-scheduler.js';
import { appendPajaMessageLog, type PajaDevtoolsState } from './browser-devtools.js';
import { createPajaRelayEventCounter } from './browser-relay-panel.js';

// A Feed-sized outbox read logged thousands of messages and relay receipts in
// seconds; rendering each one froze Paja for about a minute.
describe('coalescePajaRender', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('runs one render per frame for any number of requests, with the latest state', () => {
    const frames: (() => void)[] = [];
    const seen: number[] = [];
    let value = 0;
    const request = coalescePajaRender(() => seen.push(value), (callback) => frames.push(callback));
    for (value = 1; value <= 1000; value += 1) request();
    expect(frames).toHaveLength(1);
    frames.shift()!();
    expect(seen).toEqual([1001]);
    request();
    expect(frames).toHaveLength(1);
  });

  it('logs every message synchronously but renders the log once per frame', () => {
    const frames: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { frames.push(callback); return frames.length; });
    const lookups = vi.fn((_id: string) => null);
    vi.stubGlobal('document', { getElementById: lookups });
    const state = { messageLog: [], messageFilter: '' } as unknown as PajaDevtoolsState;
    for (let index = 0; index < 2000; index += 1) {
      appendPajaMessageLog(state, 'shell->napplet', { type: 'outbox.event', subId: 's', index }, 'w');
    }
    expect(state.messageLog.length).toBeGreaterThan(0);
    expect(state.messageLog.at(-1)?.preview).toContain('"index":1999');
    expect(lookups).not.toHaveBeenCalledWith('message-log');
    expect(frames).toHaveLength(1);
    frames.shift()!();
    expect(lookups.mock.calls.filter(([id]) => id === 'message-log')).toHaveLength(1);
  });

  it('lets the relay counter count synchronously while its render is coalesced', () => {
    const frames: (() => void)[] = [];
    const render = vi.fn();
    const counter = createPajaRelayEventCounter(coalescePajaRender(render, (callback) => frames.push(callback)));
    for (let index = 0; index < 500; index += 1) {
      counter.recordEvent('outbox', { id: `e${index}`, kind: 1 }, [`wss://relay-${index % 50}.example`], 'nip65');
    }
    expect(counter.total).toBe(500);
    expect(render).not.toHaveBeenCalled();
    frames.shift()!();
    expect(render).toHaveBeenCalledTimes(1);
  });
});
