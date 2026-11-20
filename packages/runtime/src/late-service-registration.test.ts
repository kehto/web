import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { ServiceHandler, ServiceRegistry } from './types.js';

declare const console: { warn(message: string): void };

const UNROUTED = '[KEHTO_UNROUTED_SERVICE_DOMAIN]';

function webrtcService(): ServiceHandler {
  return {
    descriptor: { name: 'webrtc', version: '1.0.0' },
    handleMessage: vi.fn((_windowId, message, send) => {
      send({ type: 'webrtc.open.result', id: (message as { id?: string }).id, session: { sessionId: 's1' } });
    }),
    onRegistered: vi.fn(),
    onUnregistered: vi.fn(),
  };
}

function setup(services: ServiceRegistry = {}) {
  const ctx = createMockRuntimeAdapter({ services });
  const runtime = createRuntime(ctx.hooks);
  runtime.sessionRegistry.register('w1', createNip5dSessionEntry('w1', 'app', 'a'.repeat(64)));
  const open = (id: string) => runtime.handleMessage('w1', { type: 'webrtc.open', id });
  return { ctx, runtime, open, services };
}

// kehto/web#428. NIP-5D (nostr-protocol/nips#2303 at
// dskvr/nips@f60550c3409d6d81a875088ec83e660571e10504): "Messages with an
// unrecognized `type` MUST be silently ignored", which also prevents capability
// probing. NAP-WEBRTC draft PR #59 at
// napplet/naps@fb4dd6f0e6294e1837733d2af61931e3e114bd97 requires a result for
// every request once the shell exposes the domain.
describe('late service registration (#428)', () => {
  const warn = vi.fn<(message: string) => void>();
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(warn); });
  afterEach(() => { vi.restoreAllMocks(); warn.mockClear(); });
  const unrouted = () => warn.mock.calls.filter(([text]) => text.startsWith(UNROUTED));

  it('does not route a handler added to the adapter object after creation', () => {
    const { ctx, runtime, open, services } = setup();
    const service = webrtcService();
    services.webrtc = service;

    expect(runtime.hasService('webrtc')).toBe(false);
    open('probe-1');
    open('probe-2');
    expect(service.handleMessage).not.toHaveBeenCalled();
    expect(service.onRegistered).not.toHaveBeenCalled();
    // Spec-mandated silence on the wire, one actionable line for the host.
    expect(ctx.sent).toEqual([]);
    expect(unrouted()).toHaveLength(1);
    expect(unrouted()[0][0]).toContain('runtime.registerService("webrtc", handler)');
    expect(unrouted()[0][0]).toContain('Warned once per domain per runtime');
    expect(unrouted()[0][0]).not.toContain('probe-1');
    runtime.destroy();
  });

  it('routes, reports and retires a service registered after creation', () => {
    const { ctx, runtime, open } = setup();
    const service = webrtcService();

    runtime.registerService('webrtc', service);
    expect(runtime.hasService('webrtc')).toBe(true);
    expect(service.onRegistered).toHaveBeenCalledTimes(1);
    open('open-1');
    expect(service.handleMessage).toHaveBeenCalledTimes(1);
    expect(findEnvelopeResponse(ctx.sent, 'webrtc.open.result')).toEqual(
      { type: 'webrtc.open.result', id: 'open-1', session: { sessionId: 's1' } });
    expect(unrouted()).toHaveLength(0);

    runtime.unregisterService('webrtc');
    expect(runtime.hasService('webrtc')).toBe(false);
    expect(service.onUnregistered).toHaveBeenCalledTimes(1);
    ctx.reset();
    open('open-2');
    expect(service.handleMessage).toHaveBeenCalledTimes(1);
    expect(ctx.sent).toEqual([]);
    expect(unrouted()).toHaveLength(1);
    runtime.destroy();
  });

  it('reports creation-time services and forgets them on destroy', () => {
    const { runtime, open } = setup({ webrtc: webrtcService() });
    expect(runtime.hasService('webrtc')).toBe(true);
    expect(runtime.hasService('toString')).toBe(false);
    open('open-1');
    expect(unrouted()).toHaveLength(0);
    runtime.destroy();
    expect(runtime.hasService('webrtc')).toBe(false);
  });

  it('never mutates the host-owned services object', () => {
    const { runtime, services } = setup();
    runtime.registerService('webrtc', webrtcService());
    expect(Object.keys(services)).toEqual([]);
    runtime.destroy();
  });
});
