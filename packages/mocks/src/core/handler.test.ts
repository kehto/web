import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';

import { defineMockService, pushThrough, pushToWindow, resultType } from './handler.js';
import type { MockScheduler } from './types.js';

interface EchoState { seen: number; byWindow: Map<string, number> }

function echoService(options: Parameters<typeof defineMockService>[1] = {}) {
  return defineMockService<EchoState>({
    domain: 'echo',
    version: '0.1.0',
    kind: 'extension',
    capabilities: { 'echo.privileged': 'relay:read' },
    pushes: { 'echo.event': null, 'echo.secret': 'relay:read' },
    initialState: () => ({ seen: 0, byWindow: new Map() }),
    routes: {
      'echo.say': ({ message, reply, state, windowId }) => {
        state.seen += 1;
        state.byWindow.set(windowId, (state.byWindow.get(windowId) ?? 0) + 1);
        reply({ text: message.text });
      },
      'echo.boom': ({ fail }) => fail('nope', { code: 'boom' }),
      'echo.privileged': ({ reply }) => reply(),
    },
    onWindowDestroyed: (windowId, state) => { state.byWindow.delete(windowId); },
  }, options);
}

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

describe('defineMockService', () => {
  it('builds descriptor and extension capability map from routes', () => {
    const service = echoService();
    expect(service.descriptor).toEqual({ name: 'echo', version: '0.1.0' });
    expect(service.messageCapabilities).toEqual({ 'echo.say': null, 'echo.boom': null, 'echo.privileged': 'relay:read' });
    expect(service.pushCapabilities).toEqual({ 'echo.event': null, 'echo.secret': 'relay:read' });
    expect(Object.isFrozen(service.pushCapabilities)).toBe(true);
    expect(service.mock.routes).toEqual(['echo.say', 'echo.boom', 'echo.privileged']);
  });

  it('omits pushCapabilities when a definition declares no pushes', () => {
    const service = defineMockService<{ n: number }>({
      domain: 'quiet', version: '0.1.0', kind: 'extension', initialState: () => ({ n: 0 }), routes: { 'quiet.ping': ({ reply }) => reply() },
    });
    expect(service.pushCapabilities).toBeUndefined();
    expect(Object.hasOwn(service, 'pushCapabilities')).toBe(false);
  });

  it('omits messageCapabilities for built-in service kinds unless given', () => {
    const service = defineMockService({ domain: 'link', version: '1.0.0', kind: 'service', initialState: () => ({}), routes: {} });
    expect(service.messageCapabilities).toBeUndefined();
  });

  it('replies with <type>.result carrying the request id', () => {
    const service = echoService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'echo.say', id: 'r1', text: 'hi' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'echo.say.result', id: 'r1', text: 'hi' }]);
    expect(service.mock.sent).toEqual([{ windowId: 'w1', message: sent[0] }]);
    expect(service.mock.state().seen).toBe(1);
  });

  it('fails with an error field and ignores unknown types', () => {
    const service = echoService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'echo.boom', id: 'r2' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'echo.unknown', id: 'r3' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'toString', id: 'r4' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'echo.boom.result', id: 'r2', code: 'boom', error: 'nope' }]);
  });

  it('defers replies through the scheduler when latencyMs is set', () => {
    const queued: Array<() => void> = [];
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => {}; } };
    const service = echoService({ latencyMs: 10, scheduler });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'echo.say', id: 'r1', text: 'later' } as NappletMessage, send);
    expect(sent).toEqual([]);
    queued.forEach((fn) => fn());
    expect(sent).toEqual([{ type: 'echo.say.result', id: 'r1', text: 'later' }]);
  });

  it('resets state, sent log, and pending timers', () => {
    const cancel = vi.fn();
    const scheduler: MockScheduler = { schedule: () => cancel };
    const service = echoService({ latencyMs: 5, scheduler });
    service.handleMessage('w1', { type: 'echo.say', id: 'r1' } as NappletMessage, () => {});
    service.mock.reset();
    expect(cancel).toHaveBeenCalledOnce();
    expect(service.mock.state().seen).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });

  it('pushes through the runtime context when registered, else the last send', () => {
    const service = echoService();
    const { sent, send } = sink();
    expect(pushToWindow(service, 'w1', { type: 'echo.event' } as NappletMessage)).toBe(false);
    service.handleMessage('w1', { type: 'echo.say', id: 'r1' } as NappletMessage, send);
    expect(pushToWindow(service, 'w1', { type: 'echo.event' } as NappletMessage)).toBe(true);
    expect(sent.at(-1)).toEqual({ type: 'echo.event' });

    const runtime: ServiceRuntimeContext = {
      resolveDTag: () => 'dtag',
      listWindowIds: () => ['w1'],
      hasCapability: () => true,
      sendToEligibleNapplet: vi.fn(() => true),
    };
    service.onRegistered?.(runtime);
    expect(service.mock.runtime).toBe(runtime);
    expect(pushToWindow(service, 'w1', { type: 'echo.event', n: 2 } as NappletMessage)).toBe(true);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledWith('w1', { type: 'echo.event', n: 2 });
    expect(service.mock.sent.at(-1)).toEqual({ windowId: 'w1', message: { type: 'echo.event', n: 2 } });
    service.onUnregistered?.();
    expect(service.mock.runtime).toBeUndefined();
  });

  it('reports a refused runtime push and records nothing, without falling back to a stale send', () => {
    const service = echoService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'echo.say', id: 'r1' } as NappletMessage, send);
    const runtime: ServiceRuntimeContext = {
      resolveDTag: () => 'dtag',
      listWindowIds: () => ['w1'],
      hasCapability: () => true,
      sendToEligibleNapplet: vi.fn(() => false),
    };
    service.onRegistered?.(runtime);
    const before = service.mock.sent.length;
    expect(pushToWindow(service, 'w1', { type: 'echo.event', n: 3 } as NappletMessage)).toBe(false);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledOnce();
    expect(service.mock.sent).toHaveLength(before);
    expect(sent.some((msg) => msg.type === 'echo.event')).toBe(false);
  });

  it('pushThrough delivers via a caller-supplied send and records the envelope', () => {
    const service = echoService();
    const { sent, send } = sink();
    const message = { type: 'echo.event', n: 4 } as NappletMessage;
    expect(pushThrough(service, 'w9', message, send)).toBe(true);
    expect(sent).toEqual([message]);
    expect(service.mock.sent).toEqual([{ windowId: 'w9', message }]);
    const foreign = { descriptor: { name: 'x', version: '0' }, handleMessage() {}, mock: service.mock };
    expect(pushThrough(foreign, 'w9', message, send)).toBe(false);
  });

  it('cleans per-window state on destroy', () => {
    const service = echoService();
    service.handleMessage('w1', { type: 'echo.say', id: 'r1' } as NappletMessage, () => {});
    expect(service.mock.state().byWindow.get('w1')).toBe(1);
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().byWindow.has('w1')).toBe(false);
  });

  it('exposes resultType', () => {
    expect(resultType('link.open')).toBe('link.open.result');
  });
});
